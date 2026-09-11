import type { Word } from '../src/types';

export function makeWord(rank: number, overrides: Partial<Word> = {}): Word {
  const id = String(rank).padStart(4, '0');
  const french = `mot${rank}`;
  return {
    id,
    rank,
    french,
    english: `meaning ${rank}`,
    persian: `معنی ${rank}`,
    exampleFrench: `Voici le ${french}.`,
    exampleEnglish: `Here is the ${french}.`,
    exampleTarget: french,
    pronunciationTarget: french,
    audio: {
      path: `/audio/${id}-${french}.mp3`,
      provider: 'google-cloud-tts',
      kind: 'neural',
      licenseReference: 'test-licence',
    },
    review: {
      meaning: 'reviewed',
      example: 'human-reviewed',
      pronunciation: 'human-reviewed',
      flags: [],
    },
    ...overrides,
  };
}

// a spanish record carries its own headword pair and no recorded clip, so a test that
// needs one cannot just override the french fixture
export function makeSpanishWord(
  rank: number,
  overrides: Partial<Word> = {},
): Word {
  const id = String(rank).padStart(4, '0');
  const spanish = `palabra${rank}`;
  return {
    id,
    rank,
    spanish,
    english: `meaning ${rank}`,
    persian: `معنی ${rank}`,
    exampleSpanish: `Aquí está la ${spanish}.`,
    exampleEnglish: `Here is the ${spanish}.`,
    exampleTarget: spanish,
    pronunciationTarget: spanish,
    audio: {
      path: 'browser-speech:es-ES',
      provider: 'browser-speech',
      kind: 'neural',
      licenseReference: 'test-licence',
    },
    review: {
      meaning: 'reviewed',
      example: 'human-reviewed',
      pronunciation: 'human-reviewed',
      flags: [],
    },
    ...overrides,
  };
}
