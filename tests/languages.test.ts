// @vitest-environment node

import { describe, expect, test } from 'vitest';
import {
  DEFAULT_LANGUAGES,
  bundledLanguages,
  isLanguageCode,
  languageByCode,
  languages,
  orderLanguages,
} from '../src/lib/languages';
import { checkMeaning } from '../scripts/lib/meaning-checks';
import { createSearchKey, filterWords } from '../src/lib/search';
import { makeWord } from './fixtures';

describe('language registry', () => {
  test('only the two reviewed baseline meanings ship inside the word list', () => {
    expect(bundledLanguages.map((language) => language.code)).toEqual([
      'en',
      'fa',
    ]);
    expect(DEFAULT_LANGUAGES).toEqual(['en', 'fa']);
  });

  test('every right-to-left language carries a font stack', () => {
    const missingFont = languages
      .filter((language) => language.direction === 'rtl')
      .filter((language) => !language.fontStack)
      .map((language) => language.code);
    expect(missingFont).toEqual([]);
  });

  test('non-Latin languages carry a font stack so they do not render as boxes', () => {
    expect(languageByCode.get('zh')?.fontStack).toBeTruthy();
    expect(languageByCode.get('ar')?.fontStack).toBeTruthy();
  });

  test('recognises its own codes and nothing else', () => {
    expect(isLanguageCode('de')).toBe(true);
    expect(isLanguageCode('klingon')).toBe(false);
    expect(isLanguageCode(7)).toBe(false);
  });

  test('always returns columns in registry order, however they were picked', () => {
    expect(orderLanguages(['zh', 'en', 'de'])).toEqual(['en', 'de', 'zh']);
    expect(orderLanguages(['de', 'en'])).toEqual(['en', 'de']);
  });

  test('drops duplicates', () => {
    expect(orderLanguages(['de', 'de'])).toEqual(['de']);
  });
});

describe('searching across languages', () => {
  const word = makeWord(1, {
    french: 'maison',
    english: 'house',
    persian: 'خانه',
  });
  const loaded = { es: { '0001': 'casa' }, de: { '0001': 'Haus' } } as const;

  test('finds a word by a meaning in a loaded language', () => {
    expect(filterWords([word], 'casa', ['es'], loaded)).toHaveLength(1);
  });

  test('does not find a language that is not loaded', () => {
    expect(filterWords([word], 'casa', ['de'], loaded)).toHaveLength(0);
  });

  test('still finds the baseline meanings with no languages passed', () => {
    expect(filterWords([word], 'house')).toHaveLength(1);
    expect(filterWords([word], 'خانه')).toHaveLength(1);
  });

  test('folds accents in an added language', () => {
    const key = createSearchKey(word, ['es'], { es: { '0001': 'habitación' } });
    expect(key).toContain('habitacion');
  });
});

describe('meaning checks', () => {
  test('accepts a normal translation', () => {
    expect(checkMeaning('casa', 'maison', 'es').passed).toBe(true);
    expect(checkMeaning('房子', 'maison', 'zh').passed).toBe(true);
    expect(checkMeaning('منزل', 'maison', 'ar').passed).toBe(true);
  });

  test('lets a real cognate through, since French shares many forms', () => {
    // que, tu, venir, entre and Moment are all correct translations that happen to
    // match the French spelling, so identity cannot be a blocking failure
    for (const [value, french, code] of [
      ['que', 'que', 'es'],
      ['venir', 'venir', 'es'],
      ['entre', 'entre', 'pt'],
      ['Moment', 'moment', 'de'],
      ['mille', 'mille', 'it'],
    ] as const) {
      expect(checkMeaning(value, french, code).passed).toBe(true);
    }
  });

  test('still records a match with the French as worth reviewing', () => {
    expect(checkMeaning('mot', 'mot', 'es').warnings).toContain(
      'matches-the-french',
    );
    // accents and case must not hide a match
    expect(checkMeaning('Étre', 'être', 'it').warnings).toContain(
      'matches-the-french',
    );
  });

  test('catches an answer in the wrong script', () => {
    expect(checkMeaning('casa', 'maison', 'zh').flags).toContain(
      'missing-han-script',
    );
    expect(checkMeaning('房子', 'maison', 'es').flags).toContain(
      'unexpected-cjk',
    );
    expect(checkMeaning('casa', 'maison', 'ar').flags).toContain(
      'missing-arabic-script',
    );
  });

  test('catches an explanation instead of a term', () => {
    const long =
      'a building where people live, usually with rooms and a roof for shelter';
    expect(checkMeaning(long, 'maison', 'en').flags).toContain('too-long');
  });

  test('catches empty and multi-line answers', () => {
    expect(checkMeaning('   ', 'maison', 'es').flags).toContain('empty');
    expect(checkMeaning('casa\nhogar', 'maison', 'es').flags).toContain(
      'contains-line-breaks',
    );
  });
});
