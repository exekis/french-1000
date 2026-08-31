import { isRecord } from './storage';

export const PRACTICE_STORAGE_KEY = 'french-1000:practice';

export type PracticeSettings = {
  enabled: boolean;
  hideExample: boolean;
};

export const defaultPracticeSettings: PracticeSettings = {
  enabled: false,
  hideExample: false,
};

export function parsePracticeSettings(raw: unknown): PracticeSettings | null {
  if (!isRecord(raw)) return null;
  return {
    enabled: raw.enabled === true,
    hideExample: raw.hideExample === true,
  };
}

// reading a meaning next to the word teaches recognition; recall needs the meaning
// covered until the reader has committed to an answer
export function isMeaningHidden(
  settings: PracticeSettings,
  revealed: ReadonlySet<string>,
  wordId: string,
): boolean {
  return settings.enabled && !revealed.has(wordId);
}

export function isExampleHidden(
  settings: PracticeSettings,
  revealed: ReadonlySet<string>,
  wordId: string,
): boolean {
  return settings.hideExample && isMeaningHidden(settings, revealed, wordId);
}
