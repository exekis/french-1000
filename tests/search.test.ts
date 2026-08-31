import { describe, expect, test } from 'vitest';
import { filterWords, normalizeSearchText } from '../src/lib/search';
import { makeWord } from './fixtures';

const words = [
  makeWord(1, {
    french: 'être',
    english: 'to be',
    persian: 'بودن',
    exampleFrench: 'Je veux être ici.',
    exampleTarget: 'être',
  }),
  makeWord(2, {
    french: 'maison',
    english: 'house; home',
    persian: 'خانه',
    exampleFrench: 'Ma maison est calme.',
    exampleTarget: 'maison',
  }),
];

describe('search', () => {
  test('normalizes accents, case, whitespace, and apostrophes', () => {
    expect(normalizeSearchText('  L’ÉTÉ  ')).toBe("l'ete");
  });

  test('finds accented French with an unaccented query', () => {
    expect(filterWords(words, 'etre').map((word) => word.id)).toEqual(['0001']);
  });

  test('searches English, Persian, and example text', () => {
    expect(filterWords(words, 'home')[0]?.id).toBe('0002');
    expect(filterWords(words, 'بودن')[0]?.id).toBe('0001');
    expect(filterWords(words, 'calme')[0]?.id).toBe('0002');
  });

  test('preserves source rank order', () => {
    expect(filterWords(words, '').map((word) => word.rank)).toEqual([1, 2]);
  });
});
