import { writeFile } from 'node:fs/promises';
import { format } from 'prettier';
import { getOption } from './lib/cli';
import { nowIso, readJson, readOptionalJson } from './lib/io';
import { fromRoot } from './lib/paths';
import type { AudioManifestEntry } from './lib/pipeline-types';
import { audioManifestEntrySchema } from './lib/schemas';
import type { AudioCredits } from '../src/types';

const manifestPath = getOption(
  'manifest',
  fromRoot('data/curated/audio-manifest.json'),
)!;
const outputPath = getOption(
  'output',
  fromRoot('src/data/audio-credits.json'),
)!;
const exampleAudioPath = getOption(
  'example-audio',
  fromRoot('data/curated/example-audio-manifest.json'),
)!;

const rawManifest = await readJson<unknown[]>(manifestPath);
const entries = rawManifest.map((record, index) => {
  const parsed = audioManifestEntrySchema.safeParse(record);
  if (!parsed.success) {
    throw new Error(`Invalid manifest entry ${index}: ${parsed.error.message}`);
  }
  return parsed.data as AudioManifestEntry;
});

// the licence reference is stored as "CC BY-SA 4.0 (https://...)" so the credits page
// can show the licence name and link separately
function splitLicense(reference: string): { name: string; url: string | null } {
  const match = /^(.*?)\s*\((https?:\/\/[^)]+)\)\s*$/.exec(reference);
  if (!match) return { name: reference.trim(), url: null };
  return { name: match[1]!.trim(), url: match[2]! };
}

const providerCounts = new Map<string, { kind: string; recordings: number }>();
const speakerCounts = new Map<
  string,
  { recordings: number; license: string; profileUrl: string | null }
>();
const licenseCounts = new Map<
  string,
  { url: string | null; recordings: number }
>();
const voiceCounts = new Map<
  string,
  { recordings: number; licenseReference: string }
>();

for (const entry of entries) {
  const provider = providerCounts.get(entry.provider);
  if (provider) provider.recordings += 1;
  else providerCounts.set(entry.provider, { kind: entry.kind, recordings: 1 });

  const license = splitLicense(entry.licenseReference);
  if (entry.provider !== 'browser-speech') {
    const existingLicense = licenseCounts.get(license.name);
    if (existingLicense) existingLicense.recordings += 1;
    else licenseCounts.set(license.name, { url: license.url, recordings: 1 });
  }

  if (entry.speaker) {
    const existing = speakerCounts.get(entry.speaker);
    if (existing) existing.recordings += 1;
    else {
      speakerCounts.set(entry.speaker, {
        recordings: 1,
        license: license.name,
        profileUrl: `https://commons.wikimedia.org/wiki/User:${encodeURIComponent(
          entry.speaker.replaceAll(' ', '_'),
        )}`,
      });
    }
  }

  if (entry.voiceName) {
    const existing = voiceCounts.get(entry.voiceName);
    if (existing) existing.recordings += 1;
    else {
      voiceCounts.set(entry.voiceName, {
        recordings: 1,
        licenseReference: entry.licenseReference,
      });
    }
  }
}

// the spoken example sentences use their own voice, which needs crediting too
type ExampleAudioEntry = { voiceName: string; licenseReference: string };
for (const entry of await readOptionalJson<ExampleAudioEntry[]>(
  exampleAudioPath,
  [],
)) {
  const existing = voiceCounts.get(entry.voiceName);
  if (existing) existing.recordings += 1;
  else {
    voiceCounts.set(entry.voiceName, {
      recordings: 1,
      licenseReference: entry.licenseReference,
    });
  }
}

const credits: AudioCredits = {
  generatedAt: nowIso(),
  totalRecordings: entries.length,
  providers: [...providerCounts.entries()]
    .map(([provider, value]) => ({
      provider: provider as AudioCredits['providers'][number]['provider'],
      kind: value.kind as AudioCredits['providers'][number]['kind'],
      recordings: value.recordings,
    }))
    .toSorted((a, b) => b.recordings - a.recordings),
  speakers: [...speakerCounts.entries()]
    .map(([speaker, value]) => ({ speaker, ...value }))
    .toSorted(
      (a, b) =>
        b.recordings - a.recordings || a.speaker.localeCompare(b.speaker),
    ),
  licenses: [...licenseCounts.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .toSorted((a, b) => b.recordings - a.recordings),
  synthesizedVoices: [...voiceCounts.entries()]
    .map(([voiceName, value]) => ({ voiceName, ...value }))
    .toSorted((a, b) => b.recordings - a.recordings),
};

await writeFile(
  outputPath,
  await format(JSON.stringify(credits), { parser: 'json' }),
  'utf8',
);
console.log(
  `Wrote credits for ${credits.speakers.length} speakers and ${credits.licenses.length} licences.`,
);
