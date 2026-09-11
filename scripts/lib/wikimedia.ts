import { setTimeout as delay } from 'node:timers/promises';

const WIKTIONARY_API = 'https://fr.wiktionary.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

// wikimedia asks every automated client to identify itself with a contactable agent
export const USER_AGENT =
  'lang-1000-audio/1.0 (https://github.com/exekis/lang-1000; kiarashsotoudeh@gmail.com)';

// lingua libre tags french recordings with the wikidata id for the french language
const LINGUA_LIBRE_FRENCH = 'LL-Q150 (fra)';
const linguaLibrePattern = /^LL-Q150 \(fra\)-(.+)-(.+)$/;
const legacyFrenchPattern = /^[Ff]r-(.+)$/;
const legacyRegionSuffix = /-(fr|be|ca|ch|qc|ouest|paris|suisse)(-.*)?$/;
const audioExtensions = ['.ogg', '.wav', '.mp3', '.flac', '.oga'];

// only licences that allow redistribution of the shipped mp3 with attribution
const allowedLicensePrefixes = [
  'cc0',
  'cc-by-1.0',
  'cc-by-2.0',
  'cc-by-2.5',
  'cc-by-3.0',
  'cc-by-4.0',
  'cc-by-sa-1.0',
  'cc-by-sa-2.0',
  'cc-by-sa-2.5',
  'cc-by-sa-3.0',
  'cc-by-sa-4.0',
  'pd',
  'public domain',
];

export type CommonsFileInfo = {
  title: string;
  downloadUrl: string;
  descriptionUrl: string;
  mime: string;
  size: number;
  licenseShortName: string;
  licenseCode: string;
  licenseUrl: string;
  artist: string;
  uploader: string;
};

export type AudioCandidate = {
  title: string;
  speaker: string | null;
  source: 'lingua-libre' | 'legacy-wiktionary';
};

type QueryParameters = Record<string, string>;

function stripHtml(value: string): string {
  return value
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

async function apiGet<T>(
  endpoint: string,
  parameters: QueryParameters,
  attempts = 5,
): Promise<T> {
  const url = `${endpoint}?${new URLSearchParams({
    format: 'json',
    formatversion: '2',
    ...parameters,
  })}`;

  let wait = 1500;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
      // 429 and 503 are the throttling responses the wikimedia api documents
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`transient HTTP ${response.status}`);
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${endpoint}`);
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await delay(wait);
        wait *= 2;
      }
    }
  }
  throw lastError;
}

export async function downloadBinary(url: string): Promise<Buffer> {
  let wait = 1500;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
      });
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`transient HTTP ${response.status}`);
      }
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < 5) {
        await delay(wait);
        wait *= 2;
      }
    }
  }
  throw lastError;
}

function normalizeWord(value: string): string {
  return value
    .replaceAll('’', "'")
    .replaceAll('_', ' ')
    .normalize('NFC')
    .trim()
    .toLocaleLowerCase('fr');
}

// fr.wiktionary reports files in its localised Fichier: namespace but commons only
// resolves the canonical File: prefix, so every title is normalised before lookup
export function toCommonsTitle(fileTitle: string): string {
  const withoutNamespace = fileTitle.includes(':')
    ? fileTitle.slice(fileTitle.indexOf(':') + 1)
    : fileTitle;
  return `File:${withoutNamespace}`;
}

export function classifyAudioFile(
  fileTitle: string,
  french: string,
): AudioCandidate | null {
  const withoutNamespace = fileTitle.includes(':')
    ? fileTitle.slice(fileTitle.indexOf(':') + 1)
    : fileTitle;
  const lowered = withoutNamespace.toLowerCase();
  if (!audioExtensions.some((extension) => lowered.endsWith(extension))) {
    return null;
  }

  const base = withoutNamespace
    .slice(0, withoutNamespace.lastIndexOf('.'))
    .replaceAll('_', ' ');
  const target = normalizeWord(french);

  const linguaLibre = linguaLibrePattern.exec(base);
  if (linguaLibre && normalizeWord(linguaLibre[2]!) === target) {
    return {
      title: toCommonsTitle(fileTitle),
      speaker: linguaLibre[1]!,
      source: 'lingua-libre',
    };
  }

  // the older hand-uploaded recordings are named Fr-<word>.ogg with an optional accent tag
  const legacy = legacyFrenchPattern.exec(base);
  if (legacy && !base.startsWith(LINGUA_LIBRE_FRENCH)) {
    const spoken = normalizeWord(legacy[1]!).replace(legacyRegionSuffix, '');
    if (spoken.trim() === target) {
      return {
        title: toCommonsTitle(fileTitle),
        speaker: null,
        source: 'legacy-wiktionary',
      };
    }
  }

  return null;
}

export async function fetchPageAudioTitles(
  titles: readonly string[],
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>(titles.map((t) => [t, []]));
  const normalizedFrom = new Map<string, string>();
  let continuation: QueryParameters = {};

  for (;;) {
    const payload = await apiGet<{
      query?: {
        normalized?: { from: string; to: string }[];
        pages?: { title: string; images?: { title: string }[] }[];
      };
      continue?: QueryParameters;
    }>(WIKTIONARY_API, {
      action: 'query',
      prop: 'images',
      imlimit: 'max',
      titles: titles.join('|'),
      ...continuation,
    });

    for (const entry of payload.query?.normalized ?? []) {
      normalizedFrom.set(entry.to, entry.from);
    }
    for (const page of payload.query?.pages ?? []) {
      const original = normalizedFrom.get(page.title) ?? page.title;
      const bucket = result.get(original);
      if (!bucket) continue;
      for (const image of page.images ?? []) bucket.push(image.title);
    }

    // prop=images caps results across the whole batch, so the continuation is required
    if (!payload.continue) return result;
    continuation = payload.continue;
    await delay(400);
  }
}

export function isRedistributableLicense(licenseCode: string): boolean {
  const code = licenseCode.trim().toLowerCase();
  if (code.includes('nc') || code.includes('nd')) return false;
  return allowedLicensePrefixes.some(
    (allowed) => code === allowed || code.startsWith(`${allowed}`),
  );
}

export async function fetchCommonsFileInfo(
  fileTitles: readonly string[],
): Promise<Map<string, CommonsFileInfo>> {
  const info = new Map<string, CommonsFileInfo>();
  if (fileTitles.length === 0) return info;

  const payload = await apiGet<{
    query?: {
      normalized?: { from: string; to: string }[];
      pages?: {
        title: string;
        missing?: boolean;
        imageinfo?: {
          url: string;
          descriptionurl: string;
          mime: string;
          size: number;
          user?: string;
          extmetadata?: Record<string, { value?: string }>;
        }[];
      }[];
    };
  }>(COMMONS_API, {
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime|size|user',
    iiextmetadatafilter:
      'LicenseShortName|License|UsageTerms|Artist|LicenseUrl|Credit',
    titles: fileTitles.join('|'),
  });

  const normalizedFrom = new Map<string, string>();
  for (const entry of payload.query?.normalized ?? []) {
    normalizedFrom.set(entry.to, entry.from);
  }

  for (const page of payload.query?.pages ?? []) {
    const original = normalizedFrom.get(page.title) ?? page.title;
    const first = page.imageinfo?.[0];
    if (page.missing || !first) continue;
    const meta = first.extmetadata ?? {};
    info.set(original, {
      title: original,
      // the api decorates the url with campaign tracking parameters we do not want to fetch with
      downloadUrl: first.url.split('?')[0]!,
      descriptionUrl: first.descriptionurl,
      mime: first.mime,
      size: first.size,
      licenseShortName: stripHtml(meta.LicenseShortName?.value ?? ''),
      licenseCode: (meta.License?.value ?? '').trim().toLowerCase(),
      licenseUrl: (meta.LicenseUrl?.value ?? '').trim(),
      artist: stripHtml(meta.Artist?.value ?? ''),
      uploader: first.user ?? '',
    });
  }

  return info;
}

export function commonsFilePageUrl(fileTitle: string): string {
  const slug = fileTitle.replaceAll(' ', '_');
  return `https://commons.wikimedia.org/wiki/${encodeURIComponent(slug).replaceAll('%3A', ':').replaceAll('%2F', '/')}`;
}
