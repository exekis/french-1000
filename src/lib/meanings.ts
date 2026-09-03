import { useEffect, useMemo, useState } from 'react';
import type { Word } from '../types';
import type { LanguageCode } from './languages';
import type { CourseId } from './courses';

export type MeaningMap = Record<string, string>;

type MeaningFile = {
  code: string;
  meanings: MeaningMap;
};

// a static map keeps these as separate chunks Vite can split, so a reader only ever
// downloads the languages they turned on
const frenchLoaders: Partial<
  Record<LanguageCode, () => Promise<{ default: MeaningFile }>>
> = {
  es: () => import('../data/meanings/es.json'),
  de: () => import('../data/meanings/de.json'),
  it: () => import('../data/meanings/it.json'),
  pt: () => import('../data/meanings/pt.json'),
  ar: () => import('../data/meanings/ar.json'),
  zh: () => import('../data/meanings/zh.json'),
};

const spanishLoaders: Partial<
  Record<LanguageCode, () => Promise<{ default: MeaningFile }>>
> = {
  fr: () => import('../data/spanish/meanings/fr.json'),
  de: () => import('../data/spanish/meanings/de.json'),
  it: () => import('../data/spanish/meanings/it.json'),
  pt: () => import('../data/spanish/meanings/pt.json'),
  ar: () => import('../data/spanish/meanings/ar.json'),
  zh: () => import('../data/spanish/meanings/zh.json'),
};

// module scope so turning a language off and on again does not fetch it twice
const cache = new Map<string, MeaningMap>();
const inFlight = new Set<string>();

export type MeaningState = {
  loaded: Partial<Record<LanguageCode, MeaningMap>>;
  pending: LanguageCode[];
  failed: LanguageCode[];
};

export function useMeanings(
  codes: readonly LanguageCode[],
  courseId: CourseId = 'french',
): MeaningState {
  const loaders = courseId === 'spanish' ? spanishLoaders : frenchLoaders;
  const [loaded, setLoaded] = useState<
    Partial<Record<LanguageCode, MeaningMap>>
  >({});
  const [failed, setFailed] = useState<LanguageCode[]>([]);

  useEffect(() => {
    const missing = codes.filter(
      (code) =>
        loaders[code] &&
        !cache.has(`${courseId}:${code}`) &&
        !inFlight.has(`${courseId}:${code}`),
    );
    if (missing.length === 0) return;

    missing.forEach((code) => inFlight.add(`${courseId}:${code}`));
    void Promise.all(
      missing.map(async (code) => {
        try {
          const file = await loaders[code]!();
          cache.set(`${courseId}:${code}`, file.default.meanings ?? {});
          setLoaded((current) => ({
            ...current,
            [code]: cache.get(`${courseId}:${code}`)!,
          }));
        } catch {
          setFailed((current) => [...new Set([...current, code])]);
        } finally {
          inFlight.delete(`${courseId}:${code}`);
        }
      }),
    );
  }, [codes, courseId, loaders]);

  const activeLoaded = useMemo(() => {
    const merged = { ...loaded };
    for (const code of codes) {
      const cached = cache.get(`${courseId}:${code}`);
      if (cached && !merged[code]) {
        merged[code] = cached;
      }
    }
    return merged;
  }, [loaded, codes, courseId]);

  const pending = codes.filter(
    (code) => loaders[code] && !activeLoaded[code] && !failed.includes(code),
  );

  return { loaded: activeLoaded, pending, failed };
}

export function meaningFor(
  word: Word,
  code: LanguageCode,
  loaded: Partial<Record<LanguageCode, MeaningMap>>,
): string | undefined {
  // the two reviewed baseline meanings live on the record itself
  if (code === 'en') return word.english;
  if (code === 'fa') return word.persian;
  return loaded[code]?.[word.id];
}
