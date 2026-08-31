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
import { requirePassedImportAudit } from './lib/pipeline-gates';
import type { AudioManifestEntry, ImportedWord } from './lib/pipeline-types';
import { audioManifestEntrySchema, importedWordSchema } from './lib/schemas';
import { filenameSlug } from './lib/text';

// piper reads the line to speak from stdin, which execFile cannot feed
function runPiper(
  command: string,
  args: readonly string[],
  text: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'ignore', 'pipe'] });
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

const wordsPath = getOption(
  'words',
  fromRoot('data/curated/imported-words.json'),
)!;
const manifestPath = getOption(
  'manifest',
  fromRoot('data/curated/audio-manifest.json'),
)!;
const limit = getNumberOption('limit', Number.POSITIVE_INFINITY);
const voiceName = getOption(
  'voice',
  process.env.PIPER_VOICE ?? 'fr_FR-siwis-medium',
)!;
const piperBin = getOption('piper-bin', process.env.PIPER_BIN ?? 'piper')!;
const voiceDirectory = getOption('voice-dir', process.env.PIPER_VOICE_DIR)!;
const licenseReference = getOption(
  'license',
  process.env.PIPER_LICENSE_REFERENCE,
);

if (!voiceDirectory) {
  throw new Error(
    '--voice-dir or PIPER_VOICE_DIR is required so the voice model in use is auditable',
  );
}
if (!licenseReference) {
  throw new Error(
    '--license or PIPER_LICENSE_REFERENCE is required so generated files have an auditable terms record',
  );
}

const rawWords = await readJson<unknown[]>(wordsPath);
const words = rawWords.map((record, index) => {
  const parsed = importedWordSchema.safeParse(record);
  if (!parsed.success) {
    throw new Error(`Invalid imported word ${index}: ${parsed.error.message}`);
  }
  return parsed.data as ImportedWord;
});
await requirePassedImportAudit(
  fromRoot('data/curated/import-audit.json'),
  words.length,
);

const rawManifest = await readOptionalJson<unknown[]>(manifestPath, []);
const manifestById = new Map<string, AudioManifestEntry>();
rawManifest.forEach((record, index) => {
  const parsed = audioManifestEntrySchema.safeParse(record);
  if (!parsed.success) {
    throw new Error(`Invalid manifest entry ${index}: ${parsed.error.message}`);
  }
  manifestById.set(parsed.data.id, parsed.data as AudioManifestEntry);
});

// anything that still has no playable static file is a gap the human fetch left behind
const pending = words
  .filter((word) => {
    const existing = manifestById.get(word.id);
    if (!existing) return true;
    if (existing.path === 'browser-speech:fr-FR') return true;
    return !existsSync(fromRoot('public', existing.path.replace(/^\//, '')));
  })
  .slice(0, limit);

console.log(`${pending.length} words need synthesized audio.`);

const rawDirectory = fromRoot('data/local/piper-raw');
await mkdir(rawDirectory, { recursive: true });
let generated = 0;

for (const word of pending) {
  const filename = `${word.id}-${filenameSlug(word.french)}.mp3`;
  const rawPath = fromRoot('data/local/piper-raw', `${word.id}.wav`);
  const destination = fromRoot('public/audio', filename);

  await runPiper(
    piperBin,
    ['-m', voiceName, '--data-dir', voiceDirectory, '-f', rawPath],
    word.french,
  );
  await normalizeSpokenWordMp3(rawPath, destination);
  await rm(rawPath, { force: true });

  manifestById.set(word.id, {
    id: word.id,
    path: `/audio/${filename}`,
    provider: 'piper-neural',
    kind: 'neural',
    licenseReference,
    pronunciationTarget: word.french,
    reviewStatus: 'auto-checked',
    voiceName,
    requestTextHash: sha256(word.french),
    generatedAt: nowIso(),
  });
  generated += 1;
  console.log(`Synthesized ${word.id} ${word.french}.`);
}

await writeJson(
  manifestPath,
  [...manifestById.values()].toSorted((a, b) => a.id.localeCompare(b.id)),
);
console.log(
  `Synthesized ${generated} fallback pronunciations with ${voiceName}.`,
);
