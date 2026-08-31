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
