import type { LanguageCode } from './languages';
import type { Word } from '../types';

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
  const parts = [word.french, word.english, word.persian, word.exampleFrench];
  for (const code of languages) {
    const value = meanings[code]?.[word.id];
    if (value) parts.push(value);
  }
  return normalizeSearchText(parts.join(' '));
}

export function filterWords(
  words: readonly Word[],
  query: string,
  languages: readonly LanguageCode[] = [],
  meanings: LoadedMeanings = {},
): Word[] {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return [...words];
  }

  return words.filter((word) =>
    createSearchKey(word, languages, meanings).includes(normalizedQuery),
  );
}
