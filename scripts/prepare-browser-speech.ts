import { existsSync } from 'node:fs';
import { getOption } from './lib/cli';
import { nowIso, readJson, readOptionalJson, writeJson } from './lib/io';
import { fromRoot } from './lib/paths';
import { requirePassedImportAudit } from './lib/pipeline-gates';
import type { AudioManifestEntry, ImportedWord } from './lib/pipeline-types';
import { audioManifestEntrySchema, importedWordSchema } from './lib/schemas';

const wordsPath = getOption(
  'words',
  fromRoot('data/curated/imported-words.json'),
)!;
const manifestPath = getOption(
  'manifest',
  fromRoot('data/curated/audio-manifest.json'),
)!;

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

// recorded audio always wins, so this only backfills words that have no playable file
const existingRaw = await readOptionalJson<unknown[]>(manifestPath, []);
const existingById = new Map<string, AudioManifestEntry>();
existingRaw.forEach((record, index) => {
  const parsed = audioManifestEntrySchema.safeParse(record);
  if (!parsed.success) {
    throw new Error(`Invalid manifest entry ${index}: ${parsed.error.message}`);
  }
  existingById.set(parsed.data.id, parsed.data as AudioManifestEntry);
});

const generatedAt = nowIso();
let backfilled = 0;
let kept = 0;

for (const word of words) {
  const existing = existingById.get(word.id);
  const hasStaticFile =
    existing !== undefined &&
    existing.path !== 'browser-speech:fr-FR' &&
    existsSync(fromRoot('public', existing.path.replace(/^\//, '')));
  if (hasStaticFile) {
    kept += 1;
    continue;
  }

  existingById.set(word.id, {
    id: word.id,
    path: 'browser-speech:fr-FR',
    provider: 'browser-speech',
    kind: 'neural',
    licenseReference: 'runtime-browser-speech:no-static-audio-distributed',
    pronunciationTarget: word.french,
    reviewStatus: 'auto-checked',
    generatedAt,
  });
  backfilled += 1;
}

await writeJson(
  manifestPath,
  [...existingById.values()].toSorted((a, b) => a.id.localeCompare(b.id)),
);
console.log(
  `Kept ${kept} recorded pronunciations and backfilled ${backfilled} with browser speech.`,
);
