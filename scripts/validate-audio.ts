import { existsSync } from 'node:fs';
import { getNumberOption, getOption } from './lib/cli';
import { mapWithConcurrency, probeAudio } from './lib/audio-tools';
import { nowIso, readOptionalJson, writeJson } from './lib/io';
import { fromRoot } from './lib/paths';
import type { AudioManifestEntry } from './lib/pipeline-types';
import { audioManifestEntrySchema } from './lib/schemas';
import { zeroPadRank } from './lib/text';

const manifestPath = getOption(
  'manifest',
  fromRoot('data/curated/audio-manifest.json'),
)!;
const outputPath = getOption(
  'output',
  fromRoot('data/curated/audio-audit.json'),
)!;
const concurrency = getNumberOption('concurrency', 6);
const rawManifest = await readOptionalJson<unknown[]>(manifestPath, []);
const failures: string[] = [];
const entries: AudioManifestEntry[] = [];

rawManifest.forEach((record, index) => {
  const parsed = audioManifestEntrySchema.safeParse(record);
  if (!parsed.success) {
    failures.push(
      `manifest entry ${index + 1} is invalid: ${parsed.error.message}`,
    );
    return;
  }
  entries.push(parsed.data as AudioManifestEntry);
});

if (entries.length !== 1000) {
  failures.push(
    `expected 1000 audio manifest entries, found ${entries.length}`,
  );
}
const ids = new Set(entries.map((entry) => entry.id));
for (let rank = 1; rank <= 1000; rank += 1) {
  const id = zeroPadRank(rank);
  if (!ids.has(id)) failures.push(`audio manifest is missing ${id}`);
}
if (ids.size !== entries.length)
  failures.push('audio manifest has duplicate ids');

const records = await mapWithConcurrency(
  entries,
  concurrency,
  async (entry) => {
    if (entry.provider === 'browser-speech') {
      return {
        id: entry.id,
        path: entry.path,
        provider: entry.provider,
        kind: entry.kind,
        valid: true,
        runtimeGenerated: true,
      };
    }

    const path = fromRoot('public', entry.path.replace(/^\//, ''));
    if (!existsSync(path)) {
      failures.push(`${entry.id} is missing ${entry.path}`);
      return { id: entry.id, path: entry.path, valid: false, error: 'missing' };
    }

    try {
      const probe = await probeAudio(path);
      const errors: string[] = [];
      if (!probe.formatName.includes('mp3') || probe.codecName !== 'mp3') {
        errors.push('not a decodable MP3');
      }
      if (probe.durationSeconds <= 0 || probe.durationSeconds > 10) {
        errors.push(`unexpected duration ${probe.durationSeconds}`);
      }
      if (probe.sampleRate <= 0 || probe.channels <= 0) {
        errors.push('invalid audio stream metadata');
      }
      if (probe.loudnessLufs === null) {
        errors.push('integrated loudness could not be measured');
      } else if (probe.loudnessLufs < -24 || probe.loudnessLufs > -12) {
        errors.push(
          `integrated loudness ${probe.loudnessLufs} LUFS is outside -24 to -12`,
        );
      }
      if (probe.truePeakDbfs !== null && probe.truePeakDbfs > -1) {
        errors.push(`true peak ${probe.truePeakDbfs} dBFS is too high`);
      }
      if (entry.provider === 'forvo' && entry.kind !== 'human') {
        errors.push('Forvo audio must be human');
      }
      if (entry.provider === 'wikimedia-commons' && entry.kind !== 'human') {
        errors.push('Wikimedia Commons audio must be human');
      }
      if (entry.provider === 'google-cloud-tts' && entry.kind !== 'neural') {
        errors.push('Google Cloud TTS audio must be neural');
      }
      if (entry.provider === 'piper-neural' && entry.kind !== 'neural') {
        errors.push('Piper audio must be neural');
      }
      failures.push(...errors.map((error) => `${entry.id}: ${error}`));
      return {
        id: entry.id,
        path: entry.path,
        provider: entry.provider,
        kind: entry.kind,
        valid: errors.length === 0,
        errors,
        ...probe,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${entry.id}: ${message}`);
      return { id: entry.id, path: entry.path, valid: false, error: message };
    }
  },
);

const audit = {
  status: failures.length === 0 ? 'passed' : 'blocked',
  generatedAt: nowIso(),
  expectedCount: 1000,
  checkedCount: records.length,
  providerCounts: Object.fromEntries(
    [
      'forvo',
      'wikimedia-commons',
      'google-cloud-tts',
      'piper-neural',
      'browser-speech',
    ].map((provider) => [
      provider,
      entries.filter((entry) => entry.provider === provider).length,
    ]),
  ),
  kindCounts: Object.fromEntries(
    ['human', 'neural'].map((kind) => [
      kind,
      entries.filter((entry) => entry.kind === kind).length,
    ]),
  ),
  failures,
  records,
};
await writeJson(outputPath, audit);

if (failures.length > 0) {
  console.error(`Audio validation blocked with ${failures.length} failures.`);
  failures.slice(0, 30).forEach((failure) => console.error(`- ${failure}`));
  if (failures.length > 30) console.error(`- and ${failures.length - 30} more`);
  process.exitCode = 1;
} else {
  console.log('Validated all 1000 pronunciation sources.');
}
