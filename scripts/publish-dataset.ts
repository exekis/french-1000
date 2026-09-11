import { writeFile } from 'node:fs/promises';
import { format } from 'prettier';
import { getOption } from './lib/cli';
import { validateWordDataset } from './lib/dataset-validation';
import { readJson, readOptionalJson } from './lib/io';
import { fromRoot } from './lib/paths';
import { requirePassedImportAudit } from './lib/pipeline-gates';
import type {
  AudioManifestEntry,
  ExampleApproval,
  ImportedWord,
  PublishedWord,
} from './lib/pipeline-types';
import {
  audioManifestEntrySchema,
  exampleApprovalSchema,
  importedWordSchema,
} from './lib/schemas';

const wordsPath = getOption(
  'words',
  fromRoot('data/curated/imported-words.json'),
)!;
const automaticApprovalsPath = getOption(
  'auto-approvals',
  fromRoot('data/curated/example-approvals.auto.json'),
)!;
const humanApprovalsPath = getOption(
  'human-approvals',
  fromRoot('data/curated/example-approvals.json'),
)!;
const audioManifestPath = getOption(
  'audio-manifest',
  fromRoot('data/curated/audio-manifest.json'),
)!;
const outputPath = getOption('output', fromRoot('src/data/words.json'))!;
const exampleAudioPath = getOption(
  'example-audio',
  fromRoot('data/curated/example-audio-manifest.json'),
)!;

// the english reading of each example is generated against the published list rather
// than the curation chain, so it is read back here and re-attached below
const shippedRaw = await readOptionalJson<PublishedWord[]>(outputPath, []);
const shippedById = new Map(shippedRaw.map((word) => [word.id, word]));

const importedRaw = await readJson<unknown[]>(wordsPath);
const importedWords = importedRaw.map((record, index) => {
  const result = importedWordSchema.safeParse(record);
  if (!result.success) {
    throw new Error(
      `Invalid imported word at index ${index}: ${result.error.message}`,
    );
  }
  return result.data as ImportedWord;
});
await requirePassedImportAudit(
  fromRoot('data/curated/import-audit.json'),
  importedWords.length,
);

const automaticRaw = await readOptionalJson<unknown[]>(
  automaticApprovalsPath,
  [],
);
const humanRaw = await readOptionalJson<unknown[]>(humanApprovalsPath, []);
const parseApproval = (record: unknown, source: string): ExampleApproval => {
  const result = exampleApprovalSchema.safeParse(record);
  if (!result.success)
    throw new Error(`Invalid ${source} approval: ${result.error.message}`);
  return result.data as ExampleApproval;
};
const approvalsById = new Map<string, ExampleApproval>();
automaticRaw.forEach((record) => {
  const approval = parseApproval(record, 'automatic');
  if (approvalsById.has(approval.id)) {
    throw new Error(`Duplicate automatic approval ${approval.id}`);
  }
  approvalsById.set(approval.id, approval);
});
humanRaw.forEach((record) => {
  const approval = parseApproval(record, 'human');
  if (approval.status !== 'human-reviewed') {
    throw new Error(
      `Human approval ${approval.id} must use human-reviewed status`,
    );
  }
  approvalsById.set(approval.id, approval);
});

const audioRaw = await readJson<unknown[]>(audioManifestPath);
const audioById = new Map<string, AudioManifestEntry>();
audioRaw.forEach((record, index) => {
  const result = audioManifestEntrySchema.safeParse(record);
  if (!result.success) {
    throw new Error(
      `Invalid audio manifest entry ${index}: ${result.error.message}`,
    );
  }
  if (audioById.has(result.data.id)) {
    throw new Error(`Duplicate audio manifest entry ${result.data.id}`);
  }
  audioById.set(result.data.id, result.data as AudioManifestEntry);
});

type ExampleAudioEntry = {
  id: string;
  path: string;
  provider: 'piper-neural';
  voiceName: string;
  licenseReference: string;
  sentence: string;
};
const exampleAudioRaw = await readOptionalJson<ExampleAudioEntry[]>(
  exampleAudioPath,
  [],
);
const exampleAudioById = new Map(
  exampleAudioRaw.map((entry) => [entry.id, entry]),
);

const errors: string[] = [];
const published: PublishedWord[] = [];
for (const imported of importedWords) {
  const example = approvalsById.get(imported.id);
  const audio = audioById.get(imported.id);
  if (!example) errors.push(`${imported.id} has no approved example`);
  if (!audio)
    errors.push(`${imported.id} has no approved audio manifest entry`);
  if (!example || !audio) continue;

  published.push({
    id: imported.id,
    rank: imported.rank,
    french: imported.french,
    english: imported.english,
    persian: imported.persian,
    exampleFrench: example.exampleFrench,
    ...(() => {
      const shipped = shippedById.get(imported.id);
      // a reading belongs to one sentence, so a changed example drops its old reading
      if (!shipped?.exampleEnglish) return {};
      if (shipped.exampleFrench !== example.exampleFrench) return {};
      return { exampleEnglish: shipped.exampleEnglish };
    })(),
    exampleTarget: example.exampleTarget,
    pronunciationTarget: audio.pronunciationTarget,
    ...(audio.pronunciationIpa
      ? { pronunciationIpa: audio.pronunciationIpa }
      : {}),
    audio: {
      path: audio.path,
      provider: audio.provider,
      kind: audio.kind,
      licenseReference: audio.licenseReference,
      ...(audio.attribution ? { attribution: audio.attribution } : {}),
      ...(audio.sourceUrl ? { sourceUrl: audio.sourceUrl } : {}),
    },
    ...(() => {
      const spoken = exampleAudioById.get(imported.id);
      // only attach it when the recording still matches the sentence on the page
      if (!spoken || spoken.sentence !== example.exampleFrench) return {};
      return {
        exampleAudio: {
          path: spoken.path,
          provider: spoken.provider,
          voiceName: spoken.voiceName,
          licenseReference: spoken.licenseReference,
        },
      };
    })(),
    review: {
      meaning: 'imported',
      example: example.status,
      pronunciation: audio.reviewStatus,
      flags: imported.riskFlags,
    },
  });
}

if (errors.length > 0) {
  throw new Error(`Dataset publication blocked:\n${errors.join('\n')}`);
}

const validation = validateWordDataset(published, {
  expectedCount: 1000,
  audioRoot: fromRoot('public/audio'),
  checkAudioFiles: true,
});
if (!validation.valid) {
  throw new Error(
    `Dataset publication blocked:\n${validation.errors.join('\n')}`,
  );
}

await writeFile(
  outputPath,
  await format(JSON.stringify(published), { parser: 'json' }),
  'utf8',
);
console.log(`Published ${published.length} reviewed words to ${outputPath}.`);
