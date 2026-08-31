import { execFile } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type AudioProbe = {
  durationSeconds: number;
  formatName: string;
  codecName: string;
  sampleRate: number;
  channels: number;
  loudnessLufs: number | null;
  truePeakDbfs: number | null;
};

export async function normalizeMp3(
  sourcePath: string,
  destinationPath: string,
): Promise<void> {
  await mkdir(dirname(destinationPath), { recursive: true });
  await execFileAsync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      sourcePath,
      '-af',
      'loudnorm=I=-18:LRA=7:TP=-2',
      '-codec:a',
      'libmp3lame',
      '-b:a',
      '96k',
      '-ar',
      '24000',
      '-ac',
      '1',
      destinationPath,
    ],
    { maxBuffer: 10 * 1024 * 1024 },
  );
}

// human recordings arrive with uneven lead-in and tail silence, so trim both ends
// before matching levels to keep single-word playback snappy
const trimSilence =
  'silenceremove=start_periods=1:start_silence=0.06:start_threshold=-45dB:detection=peak';

function parseMeasurement(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function measureLoudness(
  path: string,
): Promise<{ integrated: number | null; peak: number | null }> {
  const { stderr } = await execFileAsync(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostats',
      '-i',
      path,
      '-filter_complex',
      'ebur128=peak=true',
      '-f',
      'null',
      '-',
    ],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  const integrated = [...stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1)?.[1];
  const peak = [...stderr.matchAll(/Peak:\s+(-?[\d.]+) dBFS/g)].at(-1)?.[1];
  const measured = parseMeasurement(integrated);
  return {
    // a clip shorter than the R128 gating window reports the -70 LUFS floor instead of
    // a real reading, and treating that as a measurement asks for a 50 dB boost
    integrated: measured === null || measured <= -60 ? null : measured,
    peak: parseMeasurement(peak),
  };
}

async function measurePeak(path: string): Promise<number | null> {
  const { stderr } = await execFileAsync(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostats',
      '-i',
      path,
      '-af',
      'volumedetect',
      '-f',
      'null',
      '-',
    ],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  const max = /max_volume:\s+(-?[\d.]+) dB/.exec(stderr)?.[1];
  if (max === undefined) return null;
  const parsed = Number(max);
  return Number.isFinite(parsed) ? parsed : null;
}

// single words are far too short for loudnorm's one-pass gating to settle, so measure
// the trimmed clip first and then apply a plain corrective gain
export async function normalizeSpokenWordMp3(
  sourcePath: string,
  destinationPath: string,
  targetLufs = -18,
  // leaves headroom for the true-peak overshoot mp3 encoding adds
  peakCeilingDb = -2.5,
): Promise<void> {
  await mkdir(dirname(destinationPath), { recursive: true });
  const trimmedPath = `${destinationPath}.trimmed.wav`;

  await execFileAsync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      sourcePath,
      '-af',
      // the tail pad gives playback a moment to breathe, and whole_dur keeps even the
      // shortest words above the 400 ms window EBU R128 needs to measure anything
      `${trimSilence},areverse,${trimSilence},areverse,apad=pad_dur=0.12,apad=whole_dur=0.5`,
      '-ar',
      '24000',
      '-ac',
      '1',
      trimmedPath,
    ],
    { maxBuffer: 10 * 1024 * 1024 },
  );

  try {
    const { integrated } = await measureLoudness(trimmedPath);
    const peak = await measurePeak(trimmedPath);
    const loudnessGain = integrated === null ? 0 : targetLufs - integrated;
    const peakGain = peak === null ? loudnessGain : peakCeilingDb - peak;
    // a word with a sharp transient cannot reach the loudness target on plain gain alone,
    // so those get the full gain plus a limiter instead of being left far too quiet
    const peakConstrained = peakGain < loudnessGain;
    const clampedGain = Math.max(-30, Math.min(30, loudnessGain));
    const ceilingLinear = 10 ** (peakCeilingDb / 20);
    const filter = peakConstrained
      ? `volume=${clampedGain.toFixed(2)}dB,alimiter=limit=${ceilingLinear.toFixed(4)}:attack=5:release=50:level=disabled`
      : `volume=${clampedGain.toFixed(2)}dB`;

    await execFileAsync(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        trimmedPath,
        '-af',
        filter,
        '-codec:a',
        'libmp3lame',
        '-b:a',
        '96k',
        '-ar',
        '24000',
        '-ac',
        '1',
        destinationPath,
      ],
      { maxBuffer: 10 * 1024 * 1024 },
    );
  } finally {
    await rm(trimmedPath, { force: true });
  }
}

export async function probeAudio(path: string): Promise<AudioProbe> {
  const { stdout } = await execFileAsync(
    'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration,format_name:stream=codec_name,sample_rate,channels',
      '-of',
      'json',
      path,
    ],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  const parsed = JSON.parse(stdout) as {
    format?: { duration?: string; format_name?: string };
    streams?: Array<{
      codec_name?: string;
      sample_rate?: string;
      channels?: number;
    }>;
  };
  const stream = parsed.streams?.[0];

  const { stderr } = await execFileAsync(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostats',
      '-i',
      path,
      '-filter_complex',
      'ebur128=peak=true',
      '-f',
      'null',
      '-',
    ],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  const loudnessMatches = [...stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)];
  const peakMatches = [...stderr.matchAll(/Peak:\s+(-?[\d.]+) dBFS/g)];
  const loudness = loudnessMatches.at(-1)?.[1];
  const peak = peakMatches.at(-1)?.[1];

  return {
    durationSeconds: Number(parsed.format?.duration ?? 0),
    formatName: parsed.format?.format_name ?? '',
    codecName: stream?.codec_name ?? '',
    sampleRate: Number(stream?.sample_rate ?? 0),
    channels: stream?.channels ?? 0,
    loudnessLufs: loudness === undefined ? null : Number(loudness),
    truePeakDbfs: peak === undefined ? null : Number(peak),
  };
}

export async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = Array.from({ length: values.length }) as R[];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () =>
      worker(),
    ),
  );
  return results;
}
