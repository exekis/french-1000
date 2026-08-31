import { existsSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { getNumberOption, getOption } from './lib/cli';
import { normalizeSpokenWordMp3 } from './lib/audio-tools';
import { nowIso, readJson, readOptionalJson, writeJson } from './lib/io';
import { fromRoot } from './lib/paths';
import { requirePassedImportAudit } from './lib/pipeline-gates';
import type { AudioManifestEntry, ImportedWord } from './lib/pipeline-types';
import { audioManifestEntrySchema, importedWordSchema } from './lib/schemas';
import { filenameSlug } from './lib/text';
import {
  type AudioCandidate,
  classifyAudioFile,
  commonsFilePageUrl,
  type CommonsFileInfo,
  downloadBinary,
  fetchCommonsFileInfo,
  fetchPageAudioTitles,
  isRedistributableLicense,
} from './lib/wikimedia';

const wordsPath = getOption(
  'words',
  fromRoot('data/curated/imported-words.json'),
)!;
const manifestPath = getOption(
  'manifest',
  fromRoot('data/curated/audio-manifest.json'),
)!;
const reportPath = getOption(
  'report',
  fromRoot('data/curated/wikimedia-audio-report.json'),
)!;
const limit = getNumberOption('limit', Number.POSITIVE_INFINITY);
const startRank = getNumberOption('start-rank', 1);
const batchSize = getNumberOption('batch-size', 20);

// leading the ranking with the highest-coverage lingua libre contributors keeps
// most of the list on a small set of voices instead of a thousand different ones
const defaultSpeakerPreference = [
  'Sartus85',
  'Poslovitch',
  'LoquaxFR',
  'WikiLucas00',
  'Lepticed7',
  'Jérémy-Günther-Heinz Jähnick',
  'Guilhelma',
  'GrandCelinien',
  'Eihel',
  'Mecanautes',
  'Mathieu Kappler',
  '0x010C',
];
const speakerPreference = (
  getOption('prefer-speakers')
    ?.split(',')
    .map((name) => name.trim()) ?? defaultSpeakerPreference
).filter(Boolean);

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

function alreadyDownloaded(word: ImportedWord): boolean {
  const existing = manifestById.get(word.id);
  if (!existing || existing.provider !== 'wikimedia-commons') return false;
  return existsSync(fromRoot('public', existing.path.replace(/^\//, '')));
}

const pending = words
  .filter((word) => word.rank >= startRank && !alreadyDownloaded(word))
  .slice(0, limit);

console.log(
  `${words.length} words total, ${pending.length} still need a Commons recording.`,
);

function rankCandidate(
  candidate: AudioCandidate,
  info: CommonsFileInfo,
): number {
  // lower sorts first
  let score = candidate.source === 'lingua-libre' ? 0 : 5000;
  const preferenceIndex = candidate.speaker
    ? speakerPreference.indexOf(candidate.speaker)
    : -1;
  score += preferenceIndex >= 0 ? preferenceIndex : speakerPreference.length;
  // a file that is far too small is usually a truncated or empty recording
  if (info.size < 8000) score += 1000;
  return score;
}

type Gap = {
  id: string;
  rank: number;
  french: string;
  reason: string;
  inspectedFiles?: string[];
};

const gaps: Gap[] = [];
const rejectedLicenses: Record<string, string>[] = [];
let downloaded = 0;

for (let index = 0; index < pending.length; index += batchSize) {
  const batch = pending.slice(index, index + batchSize);
  const audioTitlesByWord = await fetchPageAudioTitles(
    batch.map((word) => word.french),
  );

  const candidatesByWord = new Map<string, AudioCandidate[]>();
  const filesToInspect = new Set<string>();
  for (const word of batch) {
    const candidates = (audioTitlesByWord.get(word.french) ?? [])
      .map((title) => classifyAudioFile(title, word.french))
      .filter((candidate): candidate is AudioCandidate => candidate !== null);
    candidatesByWord.set(word.id, candidates);
    candidates.forEach((candidate) => filesToInspect.add(candidate.title));
  }

  const infoByTitle = new Map<string, CommonsFileInfo>();
  const inspectList = [...filesToInspect];
  for (let start = 0; start < inspectList.length; start += 50) {
    const slice = inspectList.slice(start, start + 50);
    const fetched = await fetchCommonsFileInfo(slice);
    fetched.forEach((value, key) => infoByTitle.set(key, value));
    await delay(300);
  }

  for (const word of batch) {
    const candidates = candidatesByWord.get(word.id) ?? [];
    if (candidates.length === 0) {
      gaps.push({
        id: word.id,
        rank: word.rank,
        french: word.french,
        reason: 'no French recording found on fr.wiktionary',
      });
      continue;
    }

    const usable = candidates
      .map((candidate) => ({
        candidate,
        info: infoByTitle.get(candidate.title),
      }))
      .filter(
        (
          entry,
        ): entry is { candidate: AudioCandidate; info: CommonsFileInfo } => {
          if (!entry.info) return false;
          if (
            !entry.info.mime.startsWith('audio/') &&
            entry.info.mime !== 'application/ogg'
          ) {
            return false;
          }
          if (!isRedistributableLicense(entry.info.licenseCode)) {
            rejectedLicenses.push({
              file: entry.candidate.title,
              license: entry.info.licenseCode || 'unknown',
            });
            return false;
          }
          return true;
        },
      )
      .toSorted(
        (a, b) =>
          rankCandidate(a.candidate, a.info) -
            rankCandidate(b.candidate, b.info) ||
          a.candidate.title.localeCompare(b.candidate.title),
      );

    if (usable.length === 0) {
      gaps.push({
        id: word.id,
        rank: word.rank,
        french: word.french,
        reason: 'no candidate carried a redistributable licence',
        inspectedFiles: candidates.map((candidate) => candidate.title),
      });
      continue;
    }

    const { candidate, info } = usable[0]!;
    const filename = `${word.id}-${filenameSlug(word.french)}.mp3`;
    const sourceExtension =
      info.downloadUrl.slice(info.downloadUrl.lastIndexOf('.')) || '.ogg';
    const rawDirectory = fromRoot('data/local/commons-raw');
    const rawPath = fromRoot(
      'data/local/commons-raw',
      `${word.id}${sourceExtension}`,
    );
    const destination = fromRoot('public/audio', filename);

    try {
      const bytes = await downloadBinary(info.downloadUrl);
      await mkdir(rawDirectory, { recursive: true });
      await writeFile(rawPath, bytes);
      await normalizeSpokenWordMp3(rawPath, destination);
      await unlink(rawPath);
    } catch (error) {
      gaps.push({
        id: word.id,
        rank: word.rank,
        french: word.french,
        reason: `download or transcode failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        inspectedFiles: [candidate.title],
      });
      continue;
    }

    const speaker = candidate.speaker ?? info.artist ?? info.uploader;
    const licenseShort = info.licenseShortName || info.licenseCode;
    const entry: AudioManifestEntry = {
      id: word.id,
      path: `/audio/${filename}`,
      provider: 'wikimedia-commons',
      kind: 'human',
      licenseReference: `${licenseShort}${
        info.licenseUrl ? ` (${info.licenseUrl})` : ''
      }`,
      pronunciationTarget: word.french,
      reviewStatus: 'auto-checked',
      sourceId: candidate.title,
      sourceUrl: commonsFilePageUrl(candidate.title),
      attribution: `${speaker} / Wikimedia Commons / ${licenseShort}`,
      speaker,
      retrievedAt: nowIso(),
    };
    manifestById.set(word.id, entry);
    downloaded += 1;

    if (downloaded % 25 === 0) {
      await writeJson(
        manifestPath,
        [...manifestById.values()].toSorted((a, b) => a.id.localeCompare(b.id)),
      );
      console.log(`  saved progress at ${downloaded} recordings`);
    }
  }

  console.log(
    `Processed ${Math.min(index + batchSize, pending.length)}/${pending.length}`,
  );
  await delay(500);
}

await writeJson(
  manifestPath,
  [...manifestById.values()].toSorted((a, b) => a.id.localeCompare(b.id)),
);
await writeJson(reportPath, {
  generatedAt: nowIso(),
  requested: pending.length,
  downloaded,
  gapCount: gaps.length,
  speakerPreference,
  gaps,
  rejectedLicenses,
});

console.log(
  `Downloaded ${downloaded} human recordings. ${gaps.length} words still need a fallback.`,
);
