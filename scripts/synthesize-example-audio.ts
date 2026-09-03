import 'dotenv/config';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { getNumberOption, getOption } from './lib/cli';
import { normalizeSpokenWordMp3 } from './lib/audio-tools';
import {
  nowIso,
  readJson,
  readOptionalJson,
  sha256,
  writeJson,
} from './lib/io';
import { fromRoot } from './lib/paths';
import type { Word } from '../src/types';

const wordsPath = getOption('words', fromRoot('src/data/words.json'))!;
const manifestPath = getOption(
  'manifest',
  fromRoot('data/curated/example-audio-manifest.json'),
)!;
const limit = getNumberOption('limit', Number.POSITIVE_INFINITY);
const startRank = getNumberOption('start-rank', 1);
const voiceName = getOption(
  'voice',
  process.env.PIPER_VOICE ?? 'fr_FR-siwis-medium',
)!;
const speaker = getOption('speaker');
const piperBin = getOption('piper-bin', process.env.PIPER_BIN ?? 'piper')!;
const voiceDirectory = getOption('voice-dir', process.env.PIPER_VOICE_DIR)!;
const licenseReference = getOption(
  'license',
  process.env.PIPER_LICENSE_REFERENCE,
);

if (!voiceDirectory) {
  throw new Error('--voice-dir or PIPER_VOICE_DIR is required');
}
if (!licenseReference) {
  throw new Error('--license or PIPER_LICENSE_REFERENCE is required');
}

type ExampleAudioEntry = {
  id: string;
  path: string;
  provider: 'piper-neural';
  voiceName: string;
  speaker?: string;
  licenseReference: string;
  sentence: string;
  requestTextHash: string;
  generatedAt: string;
};

// piper reads the line to speak from stdin
function runPiper(args: readonly string[], text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(piperBin, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`piper exited with ${code}: ${stderr.trim()}`));
    });
    child.stdin.end(`${text}\n`);
  });
}

const words = await readJson<(Word & { exampleFrench: string })[]>(wordsPath);
const existing = await readOptionalJson<ExampleAudioEntry[]>(manifestPath, []);
const byId = new Map(existing.map((entry) => [entry.id, entry]));

const pending = words
  .filter((word) => word.rank >= startRank)
  .filter((word) => {
    const entry = byId.get(word.id);
    if (!entry) return true;
    // a changed sentence or a changed voice has to be spoken again
    if (entry.requestTextHash !== sha256(word.exampleFrench)) return true;
    if (entry.voiceName !== voiceName) return true;
    return !existsSync(fromRoot('public', entry.path.replace(/^\//, '')));
  })
  .slice(0, limit);

console.log(
  `${pending.length} example sentences need audio with ${voiceName}.`,
);

const rawDirectory = fromRoot('data/local/example-tts-raw');
await mkdir(rawDirectory, { recursive: true });
await mkdir(fromRoot('public/audio/examples'), { recursive: true });

let generated = 0;
for (const word of pending) {
  const rawPath = fromRoot('data/local/example-tts-raw', `${word.id}.wav`);
  const destination = fromRoot('public/audio/examples', `${word.id}.mp3`);

  const args = ['-m', voiceName, '--data-dir', voiceDirectory, '-f', rawPath];
  if (speaker) args.push('-s', speaker);
  // the sentence keeps its punctuation so the voice phrases and pauses naturally
  await runPiper(args, word.exampleFrench);
  await normalizeSpokenWordMp3(rawPath, destination);
  await rm(rawPath, { force: true });

  byId.set(word.id, {
    id: word.id,
    path: `/audio/examples/${word.id}.mp3`,
    provider: 'piper-neural',
    voiceName,
    ...(speaker ? { speaker } : {}),
    licenseReference,
    sentence: word.exampleFrench,
    requestTextHash: sha256(word.exampleFrench),
    generatedAt: nowIso(),
  });
  generated += 1;

  if (generated % 50 === 0) {
    await writeJson(
      manifestPath,
      [...byId.values()].toSorted((a, b) => a.id.localeCompare(b.id)),
    );
    console.log(`  ${generated}/${pending.length} sentences spoken`);
  }
}

await writeJson(
  manifestPath,
  [...byId.values()].toSorted((a, b) => a.id.localeCompare(b.id)),
);
console.log(`Spoke ${generated} example sentences with ${voiceName}.`);
