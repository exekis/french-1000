import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Word } from '../../src/types';
import { containsExampleTarget } from './example-checks';
import { wordSchema } from './schemas';
import { normalizeFrenchIdentity, zeroPadRank } from './text';

export type DatasetValidationOptions = {
  expectedCount?: number;
  audioRoot?: string;
  checkAudioFiles?: boolean;
};

export type DatasetValidationResult = {
  valid: boolean;
  errors: string[];
};

export function validateWordDataset(
  input: unknown,
  options: DatasetValidationOptions = {},
): DatasetValidationResult {
  const expectedCount = options.expectedCount ?? 1000;
  const errors: string[] = [];

  if (!Array.isArray(input)) {
    return { valid: false, errors: ['dataset must be an array'] };
  }

  if (input.length !== expectedCount) {
    errors.push(`expected ${expectedCount} records, found ${input.length}`);
  }

  const words: Word[] = [];
  input.forEach((record, index) => {
    const parsed = wordSchema.safeParse(record);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      errors.push(`record ${index + 1} is invalid: ${details}`);
      return;
    }
    words.push(parsed.data);
  });

  const seenIds = new Set<string>();
  const seenRanks = new Set<number>();
  const seenFrench = new Set<string>();

  words.forEach((word, index) => {
    const expectedRank = index + 1;
    if (word.rank !== expectedRank) {
      errors.push(
        `record ${index + 1} has rank ${word.rank}, expected ${expectedRank}`,
      );
    }
    if (word.id !== zeroPadRank(word.rank)) {
      errors.push(
        `rank ${word.rank} has id ${word.id}, expected ${zeroPadRank(word.rank)}`,
      );
    }
    if (seenIds.has(word.id)) errors.push(`duplicate id ${word.id}`);
    if (seenRanks.has(word.rank)) errors.push(`duplicate rank ${word.rank}`);
    seenIds.add(word.id);
    seenRanks.add(word.rank);

    const frenchKey = normalizeFrenchIdentity(word.french);
    if (seenFrench.has(frenchKey)) {
      errors.push(`duplicate normalized French term ${word.french}`);
    }
    seenFrench.add(frenchKey);

    if (!containsExampleTarget(word.exampleFrench, word.exampleTarget)) {
      errors.push(
        `rank ${word.rank} example does not contain ${word.exampleTarget}`,
      );
    }
    if (!/[.!?…]$/u.test(word.exampleFrench.trim())) {
      errors.push(`rank ${word.rank} example has no sentence punctuation`);
    }
    if (word.review.example === 'pending') {
      errors.push(`rank ${word.rank} example review is pending`);
    }
    if (word.review.pronunciation === 'pending') {
      errors.push(`rank ${word.rank} pronunciation review is pending`);
    }
    if (word.audio.provider === 'forvo' && word.audio.kind !== 'human') {
      errors.push(`rank ${word.rank} Forvo audio must be human`);
    }
    if (
      word.audio.provider === 'wikimedia-commons' &&
      word.audio.kind !== 'human'
    ) {
      errors.push(`rank ${word.rank} Wikimedia Commons audio must be human`);
    }
    if (
      word.audio.provider === 'wikimedia-commons' &&
      !word.audio.attribution
    ) {
      errors.push(
        `rank ${word.rank} Wikimedia Commons audio needs an attribution line`,
      );
    }
    if (
      word.audio.provider === 'google-cloud-tts' &&
      word.audio.kind !== 'neural'
    ) {
      errors.push(`rank ${word.rank} Google Cloud TTS audio must be neural`);
    }
    if (
      word.audio.provider === 'piper-neural' &&
      word.audio.kind !== 'neural'
    ) {
      errors.push(`rank ${word.rank} Piper audio must be neural`);
    }
    if (
      word.audio.provider === 'browser-speech' &&
      word.audio.kind !== 'neural'
    ) {
      errors.push(`rank ${word.rank} browser speech must be neural`);
    }

    if (
      options.checkAudioFiles &&
      options.audioRoot &&
      word.audio.provider !== 'browser-speech'
    ) {
      const relativePath = word.audio.path.replace(/^\/audio\//, '');
      if (!existsSync(resolve(options.audioRoot, relativePath))) {
        errors.push(
          `rank ${word.rank} audio file is missing: ${word.audio.path}`,
        );
      }
    }
  });

  return { valid: errors.length === 0, errors };
}
