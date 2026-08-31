import { useEffect, useState } from 'react';
import type { Word } from '../types';
import type { LanguageCode } from './languages';

export type MeaningMap = Record<string, string>;

type MeaningFile = {
  code: string;
  meanings: MeaningMap;
};

// a static map keeps these as separate chunks Vite can split, so a reader only ever
// downloads the languages they turned on
const loaders: Partial<
  Record<LanguageCode, () => Promise<{ default: MeaningFile }>>
> = {
  es: () => import('../data/meanings/es.json'),
  de: () => import('../data/meanings/de.json'),
  it: () => import('../data/meanings/it.json'),
  pt: () => import('../data/meanings/pt.json'),
  ar: () => import('../data/meanings/ar.json'),
  zh: () => import('../data/meanings/zh.json'),
};

// module scope so turning a language off and on again does not fetch it twice
const cache = new Map<LanguageCode, MeaningMap>();
const inFlight = new Set<LanguageCode>();

export type MeaningState = {
  loaded: Partial<Record<LanguageCode, MeaningMap>>;
  pending: LanguageCode[];
  failed: LanguageCode[];
};

export function useMeanings(codes: readonly LanguageCode[]): MeaningState {
  const [loaded, setLoaded] = useState<
    Partial<Record<LanguageCode, MeaningMap>>
  >(() => Object.fromEntries(cache));
  const [failed, setFailed] = useState<LanguageCode[]>([]);

  const key = codes.join(',');

  useEffect(() => {
    const wanted = key ? (key.split(',') as LanguageCode[]) : [];
    const missing = wanted.filter(
      (code) => loaders[code] && !cache.has(code) && !inFlight.has(code),
    );
    if (missing.length === 0) return;

    missing.forEach((code) => inFlight.add(code));
    // the result is adopted even if the reader has since switched this language off.
    // cancelling the state write here would strand a finished file in the module cache,
    // where no later effect would pick it up because the cache already holds it
    void Promise.all(
      missing.map(async (code) => {
        try {
          const file = await loaders[code]!();
          cache.set(code, file.default.meanings ?? {});
          setLoaded((current) => ({ ...current, [code]: cache.get(code)! }));
        } catch {
          setFailed((current) => [...new Set([...current, code])]);
        } finally {
          inFlight.delete(code);
        }
      }),
    );
  }, [key]);

  // pending is simply what is still wanted and not yet here, so it needs no state of
  // its own and never has to be written from inside the effect
  const pending = codes.filter(
    (code) => loaders[code] && !loaded[code] && !failed.includes(code),
  );

  return { loaded, pending, failed };
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
