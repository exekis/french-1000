import 'dotenv/config';
import { existsSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import textToSpeech from '@google-cloud/text-to-speech';
import { getNumberOption, getOption } from './lib/cli';
import { normalizeMp3 } from './lib/audio-tools';
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

type PronunciationReview = {
  id: string;
  pronunciationTarget: string;
  pronunciationIpa?: string;
  status: 'auto-checked' | 'human-reviewed';
  reviewerReference: string;
};

const wordsPath = getOption(
  'words',
  fromRoot('data/curated/imported-words.json'),
)!;
const reviewsPath = getOption(
  'pronunciation-reviews',
  fromRoot('data/curated/pronunciation-reviews.json'),
)!;
const manifestPath = getOption(
  'manifest',
  fromRoot('data/curated/audio-manifest.json'),
)!;
const limit = getNumberOption('limit', Number.POSITIVE_INFINITY);
const startRank = getNumberOption('start-rank', 1);
const voiceName = getOption(
  'voice',
  process.env.GOOGLE_TTS_VOICE ?? 'fr-FR-Neural2-F',
)!;
const licenseReference = process.env.GOOGLE_TTS_LICENSE_REFERENCE;

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error('GOOGLE_APPLICATION_CREDENTIALS is required');
}
if (!licenseReference) {
  throw new Error(
    'GOOGLE_TTS_LICENSE_REFERENCE is required so generated files have an auditable terms record',
  );
}

const rawWords = await readJson<unknown[]>(wordsPath);
const words = rawWords.map((record, index) => {
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
  words.length,
);
const pronunciationReviews = await readOptionalJson<PronunciationReview[]>(
  reviewsPath,
  [],
);
const reviewsById = new Map(
  pronunciationReviews.map((review) => [review.id, review]),
);

const rawManifest = await readOptionalJson<unknown[]>(manifestPath, []);
const manifestById = new Map<string, AudioManifestEntry>();
rawManifest.forEach((record, index) => {
  const result = audioManifestEntrySchema.safeParse(record);
  if (!result.success) {
    throw new Error(
      `Invalid existing audio manifest entry ${index}: ${result.error.message}`,
    );
  }
  manifestById.set(result.data.id, result.data as AudioManifestEntry);
});

const reviewQueue: Record<string, unknown>[] = [];
const eligible = words.filter((word) => {
  if (word.rank < startRank) return false;
  const existing = manifestById.get(word.id);
  if (
    existing &&
    existsSync(fromRoot('public', existing.path.replace(/^\//, '')))
  ) {
    return false;
  }

  if (word.riskFlags.includes('ordinary-lexical-item')) return true;
  if (reviewsById.has(word.id)) return true;
  reviewQueue.push({
    id: word.id,
    rank: word.rank,
    french: word.french,
    proposedPronunciationTarget: word.french,
    riskFlags: word.riskFlags,
    reason: 'manual pronunciation review required before synthesis',
  });
  return false;
});
await writeJson(
  fromRoot('data/curated/pronunciation-review-queue.json'),
  reviewQueue,
);

const client = new textToSpeech.TextToSpeechClient();
const [voiceResponse] = await client.listVoices({ languageCode: 'fr-FR' });
if (!voiceResponse.voices?.some((voice) => voice.name === voiceName)) {
  throw new Error(
    `Google Cloud TTS voice ${voiceName} is not currently available for fr-FR`,
  );
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

const selected = eligible.slice(0, limit);
for (const word of selected) {
  const review = reviewsById.get(word.id);
  const pronunciationTarget = review?.pronunciationTarget ?? word.french;
  const pronunciationIpa = review?.pronunciationIpa;
  const spoken = pronunciationIpa
    ? `<phoneme alphabet="ipa" ph="${escapeXml(pronunciationIpa)}">${escapeXml(
        pronunciationTarget,
      )}</phoneme>`
    : escapeXml(pronunciationTarget);
  const ssml = `<speak>${spoken}</speak>`;

  const [response] = await client.synthesizeSpeech({
    input: { ssml },
    voice: { languageCode: 'fr-FR', name: voiceName },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: 0.95,
    },
  });
  if (!response.audioContent) {
    throw new Error(`Google Cloud TTS returned no audio for ${word.id}`);
  }

  const filename = `${word.id}-${filenameSlug(word.french)}.mp3`;
  const localDirectory = fromRoot('data/local/tts-raw');
  const rawPath = fromRoot('data/local/tts-raw', filename);
  const destination = fromRoot('public/audio', filename);
  await mkdir(localDirectory, { recursive: true });
  await writeFile(rawPath, Buffer.from(response.audioContent as Uint8Array));
  await normalizeMp3(rawPath, destination);
  await unlink(rawPath);

  const entry: AudioManifestEntry = {
    id: word.id,
    path: `/audio/${filename}`,
    provider: 'google-cloud-tts',
    kind: 'neural',
    licenseReference,
    pronunciationTarget,
    ...(pronunciationIpa ? { pronunciationIpa } : {}),
    reviewStatus: review?.status ?? 'auto-checked',
    voiceName,
    requestTextHash: sha256(ssml),
    generatedAt: nowIso(),
  };
  manifestById.set(word.id, entry);
  await writeJson(
    manifestPath,
    [...manifestById.values()].toSorted((a, b) => a.id.localeCompare(b.id)),
  );
  console.log(`Synthesized ${word.id} ${word.french}.`);
}

console.log(
  `Synthesis complete: ${selected.length} files generated, ${reviewQueue.length} pronunciations queued for manual review.`,
);
