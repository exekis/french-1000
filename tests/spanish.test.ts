import { describe, expect, test } from 'vitest';
import spanishWords from '../src/data/spanish/words.json';
import { selectSpanishVoice, type VoiceLike } from '../src/lib/audio';
import { filterWords } from '../src/lib/search';
import type { Word } from '../src/types';

describe('spanish dataset', () => {
  test('contains exactly 1000 words in contiguous rank order', () => {
    expect(spanishWords).toHaveLength(1000);
    spanishWords.forEach((word, index) => {
      const expectedRank = index + 1;
      const expectedId = String(expectedRank).padStart(4, '0');
      expect(word.rank).toBe(expectedRank);
      expect(word.id).toBe(expectedId);
      expect(word.spanish).toBeTruthy();
      expect(word.english).toBeTruthy();
      expect(word.persian).toBeTruthy();
      expect(word.exampleSpanish).toBeTruthy();
      expect(word.exampleTarget).toBe(word.spanish);
      expect(word.pronunciationTarget).toBe(word.spanish);
      expect(word.audio.provider).toBe('browser-speech');
    });
  });

  test('example sentences contain target word and terminate with punctuation', () => {
    const punctuation = /[.!?…]$/u;
    spanishWords.slice(0, 100).forEach((word) => {
      expect(word.exampleSpanish).toMatch(punctuation);
      const normalizedSentence = word.exampleSpanish.toLowerCase();
      const normalizedTarget = word.spanish.toLowerCase();
      expect(normalizedSentence).toContain(normalizedTarget);
    });
  });

  test('filters Spanish words with and without accents', () => {
    const words = [
      {
        id: '0001',
        rank: 1,
        spanish: 'año',
        english: 'year',
        persian: 'سال',
        exampleSpanish: 'Feliz año nuevo.',
        exampleTarget: 'año',
        pronunciationTarget: 'año',
        audio: {
          path: '/audio/test.mp3',
          provider: 'browser-speech',
          kind: 'neural',
          licenseReference: 'test',
        },
        review: {
          meaning: 'reviewed',
          example: 'auto-checked',
          pronunciation: 'auto-checked',
          flags: [],
        },
      },
      {
        id: '0002',
        rank: 2,
        spanish: 'está',
        english: 'is (location/state)',
        persian: 'است؛ قرار دارد',
        exampleSpanish: 'Él está en casa hoy.',
        exampleTarget: 'está',
        pronunciationTarget: 'está',
        audio: {
          path: '/audio/test.mp3',
          provider: 'browser-speech',
          kind: 'neural',
          licenseReference: 'test',
        },
        review: {
          meaning: 'reviewed',
          example: 'auto-checked',
          pronunciation: 'auto-checked',
          flags: [],
        },
      },
    ] as Word[];

    // searching without accents should find the accented word
    const matchYear = filterWords(words, 'ano');
    expect(matchYear).toHaveLength(1);
    expect(matchYear[0]!.spanish).toBe('año');

    const matchIs = filterWords(words, 'esta');
    expect(matchIs).toHaveLength(1);
    expect(matchIs[0]!.spanish).toBe('está');
  });

  test('selectSpanishVoice prefers neural and es-ES voices', () => {
    const voices: VoiceLike[] = [
      { name: 'Jorge Compact', lang: 'es-MX', localService: true },
      { name: 'Google español', lang: 'es-ES', localService: false },
      { name: 'Mónica Natural', lang: 'es-ES', localService: false },
      { name: 'Spanish Legacy Desktop', lang: 'es-ES', localService: true },
    ];

    const chosen = selectSpanishVoice(voices);
    expect(chosen?.name).toBe('Google español');
  });
});
