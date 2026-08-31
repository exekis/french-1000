import { execFile } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { format } from 'prettier';
import { getNumberOption, getOption } from './lib/cli';
import { nowIso, sha256, writeJson } from './lib/io';
import { fromRoot } from './lib/paths';
import { filenameSlug } from './lib/text';
import {
  commonsFilePageUrl,
  downloadBinary,
  isRedistributableLicense,
  USER_AGENT,
} from './lib/wikimedia';

const execFileAsync = promisify(execFile);

// scanned plates and photographs from the public domain, cut off their paper so they
// paste onto the site the way the reference collages do. searched rather than hard
// coded to file names, so a re-run can pick up better scans as they are uploaded
type Source = {
  query: string;
  take: number;
  kind: string;
  gain: number;
  softness: number;
  maxWidth: number;
  // key lifts art off its paper; card keeps a print whole the way one is pasted down
  mode: 'key' | 'card';
};

const sources: Source[] = [
  {
    query: "Edwards's botanical register plate",
    take: 10,
    kind: 'botanical',
    mode: 'key',
    gain: 1.65,
    softness: 0.42,
    maxWidth: 330,
  },
  {
    query: 'Curtis botanical magazine plate flower',
    take: 10,
    kind: 'botanical',
    mode: 'key',
    gain: 1.65,
    softness: 0.42,
    maxWidth: 330,
  },
  {
    query: 'Flore des serres et des jardins plate',
    take: 6,
    kind: 'botanical',
    mode: 'key',
    gain: 1.65,
    softness: 0.42,
    maxWidth: 330,
  },
  {
    query: 'Redoute Les Roses plate engraving',
    take: 5,
    kind: 'botanical',
    mode: 'key',
    gain: 1.6,
    softness: 0.45,
    maxWidth: 320,
  },
  {
    query: 'butterfly plate lithograph lepidoptera',
    take: 8,
    kind: 'insect',
    mode: 'key',
    gain: 1.7,
    softness: 0.4,
    maxWidth: 280,
  },
  {
    query: 'moth plate natural history illustration',
    take: 5,
    kind: 'insect',
    mode: 'key',
    gain: 1.7,
    softness: 0.4,
    maxWidth: 260,
  },
  {
    query: 'seashell conchology plate engraving',
    take: 5,
    kind: 'shell',
    mode: 'key',
    gain: 1.65,
    softness: 0.42,
    maxWidth: 260,
  },
  {
    query: 'bird plate ornithology hand coloured',
    take: 6,
    kind: 'bird',
    mode: 'key',
    gain: 1.65,
    softness: 0.42,
    maxWidth: 300,
  },
  {
    query: 'Brehms Tierleben plate animal',
    take: 6,
    kind: 'animal',
    mode: 'key',
    gain: 1.7,
    softness: 0.4,
    maxWidth: 280,
  },
  {
    query: 'Bewick History of British Birds woodcut',
    take: 5,
    kind: 'animal',
    mode: 'key',
    gain: 1.75,
    softness: 0.35,
    maxWidth: 240,
  },
  {
    query: 'Costume Parisien fashion plate',
    take: 8,
    kind: 'fashion',
    mode: 'key',
    gain: 1.6,
    softness: 0.45,
    maxWidth: 300,
  },
  {
    query: 'Journal des dames et des modes plate',
    take: 6,
    kind: 'fashion',
    mode: 'key',
    gain: 1.6,
    softness: 0.45,
    maxWidth: 300,
  },
  {
    query: 'fashion plate 1820 dress',
    take: 6,
    kind: 'fashion',
    mode: 'key',
    gain: 1.6,
    softness: 0.45,
    maxWidth: 300,
  },
  {
    query: 'robe mode gravure 1830',
    take: 5,
    kind: 'fashion',
    mode: 'key',
    gain: 1.6,
    softness: 0.45,
    maxWidth: 300,
  },
  {
    query: 'Type Sage France postage stamp',
    take: 4,
    kind: 'stamp',
    mode: 'card',
    gain: 1.5,
    softness: 0.5,
    maxWidth: 170,
  },
  {
    query: 'France Ceres Napoleon postage stamp 19th century',
    take: 5,
    kind: 'stamp',
    mode: 'card',
    gain: 1.5,
    softness: 0.5,
    maxWidth: 170,
  },
  {
    query: 'Liebig trade card chromolithograph',
    take: 6,
    kind: 'label',
    mode: 'card',
    gain: 1.5,
    softness: 0.5,
    maxWidth: 240,
  },
  {
    query: 'lettre autographe manuscrite',
    take: 5,
    kind: 'letter',
    mode: 'card',
    gain: 1.5,
    softness: 0.5,
    maxWidth: 280,
  },
  {
    query: 'Exposition Universelle 1900 Paris photograph',
    take: 6,
    kind: 'paris',
    mode: 'card',
    gain: 1.45,
    softness: 0.55,
    maxWidth: 320,
  },
  {
    query: 'Eiffel Tower 1889 construction photograph',
    take: 5,
    kind: 'paris',
    mode: 'card',
    gain: 1.45,
    softness: 0.55,
    maxWidth: 300,
  },
  {
    query: 'Paris street photograph 1900 Marville',
    take: 5,
    kind: 'paris',
    mode: 'card',
    gain: 1.45,
    softness: 0.55,
    maxWidth: 320,
  },
  {
    query: 'plan de Paris ancien map engraving',
    take: 4,
    kind: 'map',
    mode: 'key',
    gain: 1.55,
    softness: 0.5,
    maxWidth: 340,
  },
  {
    query: 'typographic ornament vignette engraving',
    take: 6,
    kind: 'ornament',
    mode: 'key',
    gain: 1.75,
    softness: 0.35,
    maxWidth: 240,
  },
  {
    query: 'decorative initial letter woodcut ornament',
    take: 5,
    kind: 'ornament',
    mode: 'key',
    gain: 1.75,
    softness: 0.35,
    maxWidth: 200,
  },
  {
    query: 'moon phases astronomical plate engraving',
    take: 4,
    kind: 'sky',
    mode: 'key',
    gain: 1.6,
    softness: 0.45,
    maxWidth: 260,
  },
];

const outputDirectory = getOption('out', fromRoot('public/art'))!;
const manifestPath = getOption('manifest', fromRoot('src/data/stickers.json'))!;
const perQuery = getNumberOption('per-query', 0);

const API = 'https://commons.wikimedia.org/w/api.php';

async function api<T>(parameters: Record<string, string>): Promise<T> {
  const url = `${API}?${new URLSearchParams({
    format: 'json',
    formatversion: '2',
    ...parameters,
  })}`;
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status} from Commons`);
  return (await response.json()) as T;
}

function stripHtml(value: string): string {
  return value
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll('&amp;', '&')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

type Sticker = {
  id: string;
  file: string;
  kind: string;
  mode: string;
  width: number;
  height: number;
  title: string;
  attribution: string;
  license: string;
  licenseUrl: string | null;
  sourceUrl: string;
  retrievedAt: string;
};

await mkdir(outputDirectory, { recursive: true });
const rawDirectory = fromRoot('data/local/art-raw');
await mkdir(rawDirectory, { recursive: true });

const stickers: Sticker[] = [];
const skipped: { title: string; reason: string }[] = [];
const seen = new Set<string>();

for (const source of sources) {
  const wanted = perQuery > 0 ? perQuery : source.take;
  const search = await api<{
    query?: { search?: { title: string }[] };
  }>({
    action: 'query',
    list: 'search',
    srsearch: `${source.query} filetype:bitmap`,
    srnamespace: '6',
    srlimit: String(wanted * 3),
  });

  const titles = (search.query?.search ?? []).map((entry) => entry.title);
  if (titles.length === 0) continue;

  const info = await api<{
    query?: {
      pages?: {
        title: string;
        imageinfo?: {
          thumburl?: string;
          descriptionurl: string;
          extmetadata?: Record<string, { value?: string }>;
        }[];
      }[];
    };
  }>({
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '900',
    iiextmetadatafilter:
      'LicenseShortName|License|Artist|LicenseUrl|ObjectName',
    titles: titles.join('|'),
  });

  let taken = 0;
  for (const page of info.query?.pages ?? []) {
    if (taken >= wanted) break;
    const first = page.imageinfo?.[0];
    if (!first?.thumburl) continue;
    if (seen.has(page.title)) continue;

    const meta = first.extmetadata ?? {};
    const licenseCode = (meta.License?.value ?? '').trim().toLowerCase();
    if (!isRedistributableLicense(licenseCode)) {
      skipped.push({
        title: page.title,
        reason: `licence ${licenseCode || 'unknown'}`,
      });
      continue;
    }

    // long plate titles all truncate to the same slug, which had seven different
    // plates writing over one file and six wrong credits, so the id carries a digest
    // of the full Commons title
    const slug = filenameSlug(page.title.replace(/^File:/, '')).slice(0, 40);
    const id = `${source.kind}-${slug}-${sha256(page.title).slice(0, 6)}`;
    const rawPath = `${rawDirectory}/${id}.src`;
    const outFile = `${id}.webp`;

    try {
      await writeFile(rawPath, await downloadBinary(first.thumburl));
      const { stdout } = await execFileAsync('python3', [
        fromRoot('scripts/lib/cutout.py'),
        rawPath,
        `${outputDirectory}/${outFile}`,
        String(source.gain),
        String(source.softness),
        String(source.maxWidth),
        source.mode,
      ]);
      const size = JSON.parse(stdout) as { width: number; height: number };

      const artist = stripHtml(meta.Artist?.value ?? '');
      const licenseName = stripHtml(
        meta.LicenseShortName?.value ?? licenseCode,
      );
      stickers.push({
        id,
        file: `/art/${outFile}`,
        kind: source.kind,
        mode: source.mode,
        width: size.width,
        height: size.height,
        title: stripHtml(
          meta.ObjectName?.value ?? page.title.replace(/^File:/, ''),
        ),
        attribution: artist || 'Unknown',
        license: licenseName,
        licenseUrl: (meta.LicenseUrl?.value ?? '').trim() || null,
        sourceUrl: first.descriptionurl ?? commonsFilePageUrl(page.title),
        retrievedAt: nowIso(),
      });
      seen.add(page.title);
      taken += 1;
      console.log(`Cut out ${id} (${size.width}x${size.height}).`);
    } catch (error) {
      skipped.push({
        title: page.title,
        reason: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await rm(rawPath, { force: true });
    }
  }
  await delay(400);
}

await writeFile(
  manifestPath,
  await format(JSON.stringify({ generatedAt: nowIso(), stickers }), {
    parser: 'json',
  }),
  'utf8',
);
await writeJson(fromRoot('data/curated/sticker-art-report.json'), {
  generatedAt: nowIso(),
  cutOut: stickers.length,
  skipped,
});

console.log(`Cut out ${stickers.length} stickers, skipped ${skipped.length}.`);
