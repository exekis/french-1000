import type { LanguageCode } from './languages';
import { getWordExample, getWordTerm, type Word } from '../types';

const combiningMarks = /\p{M}/gu;
const apostrophes = /[’‘`´]/g;
const whitespace = /\s+/g;

// declared here rather than imported so the build scripts that reuse this module do
// not pull the React side of the app in with it
type LoadedMeanings = Partial<Record<LanguageCode, Record<string, string>>>;

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(combiningMarks, '')
    .replace(apostrophes, "'")
    .toLocaleLowerCase('fr')
    .replace(whitespace, ' ')
    .trim();
}

export function createSearchKey(
  word: Word,
  languages: readonly LanguageCode[] = [],
  meanings: LoadedMeanings = {},
): string {
  // the two baseline meanings are always searchable, whether or not their column is
  // showing, so a reader can find a word by a meaning they are not currently reading
  const parts = [
    getWordTerm(word),
    word.english,
    word.persian,
    getWordExample(word),
  ];
  for (const code of languages) {
    const value = meanings[code]?.[word.id];
    if (value) parts.push(value);
  }
  return normalizeSearchText(parts.join(' '));
}

// a key costs a unicode normalisation, three replacements and a locale lowercase, and it
// only changes when the reader adds a language or a meanings file arrives. holding the
// last set means typing compares against strings that are already built rather than
// rebuilding all thousand of them on every keystroke
let indexCache: {
  words: readonly Word[];
  languages: readonly LanguageCode[];
  meanings: LoadedMeanings;
  keys: readonly string[];
} | null = null;

export function searchIndexFor(
  words: readonly Word[],
  languages: readonly LanguageCode[],
  meanings: LoadedMeanings,
): readonly string[] {
  if (
    indexCache &&
    indexCache.words === words &&
    indexCache.languages === languages &&
    indexCache.meanings === meanings
  ) {
    return indexCache.keys;
  }

  const keys = words.map((word) => createSearchKey(word, languages, meanings));
  indexCache = { words, languages, meanings, keys };
  return keys;
}

export function filterWords(
  words: readonly Word[],
  query: string,
  languages: readonly LanguageCode[] = [],
  meanings: LoadedMeanings = {},
): Word[] {
  const normalizedQuery = normalizeSearchText(query);

  // an empty box returns everything, so the index is never built until someone searches
  if (!normalizedQuery) {
    return [...words];
  }

  const keys = searchIndexFor(words, languages, meanings);
  return words.filter((_, index) => keys[index]!.includes(normalizedQuery));
}
