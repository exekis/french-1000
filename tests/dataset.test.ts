// @vitest-environment node

import { describe, expect, test } from 'vitest';
import { validateWordDataset } from '../scripts/lib/dataset-validation';
import { makeWord } from './fixtures';

describe('dataset validation', () => {
  test('accepts a complete ordered fixture', () => {
    const result = validateWordDataset(
      [makeWord(1), makeWord(2), makeWord(3)],
      { expectedCount: 3 },
    );
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('rejects gaps, duplicate French terms, and mismatched ids', () => {
    const result = validateWordDataset(
      [makeWord(1), makeWord(3, { id: '0099', french: 'mot1' }), makeWord(3)],
      { expectedCount: 3 },
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toMatch(/rank 3, expected 2/);
    expect(result.errors.join('\n')).toMatch(/expected 0099|id 0099/);
    expect(result.errors.join('\n')).toMatch(
      /duplicate normalized French term/,
    );
  });

  test('rejects pending reviews and provider-kind mismatches', () => {
    const result = validateWordDataset(
      [
        makeWord(1, {
          audio: {
            path: '/audio/0001-test.mp3',
            provider: 'forvo',
            kind: 'neural',
            licenseReference: 'test',
          },
          review: {
            meaning: 'imported',
            example: 'pending',
            pronunciation: 'pending',
            flags: [],
          },
        }),
      ],
      { expectedCount: 1 },
    );
    expect(result.errors.join('\n')).toMatch(/example review is pending/);
    expect(result.errors.join('\n')).toMatch(/pronunciation review is pending/);
    expect(result.errors.join('\n')).toMatch(/Forvo audio must be human/);
  });

  test('keeps accent-distinct French terms unique', () => {
    const result = validateWordDataset(
      [makeWord(1, { french: 'ou' }), makeWord(2, { french: 'où' })],
      { expectedCount: 2 },
    );

    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('accepts browser speech without a static audio file', () => {
    const result = validateWordDataset(
      [
        makeWord(1, {
          audio: {
            path: 'browser-speech:fr-FR',
            provider: 'browser-speech',
            kind: 'neural',
            licenseReference: 'runtime-test',
          },
        }),
      ],
      { expectedCount: 1, audioRoot: '/missing', checkAudioFiles: true },
    );

    expect(result).toEqual({ valid: true, errors: [] });
  });
  test('accepts a Wikimedia Commons recording that carries its attribution', () => {
    const result = validateWordDataset(
      [
        makeWord(1, {
          audio: {
            path: '/audio/0001-test.mp3',
            provider: 'wikimedia-commons',
            kind: 'human',
            licenseReference:
              'CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0)',
            attribution: 'Sartus85 / Wikimedia Commons / CC BY-SA 4.0',
            sourceUrl: 'https://commons.wikimedia.org/wiki/File:Example.wav',
          },
        }),
      ],
      { expectedCount: 1 },
    );
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('rejects a Commons recording published without attribution', () => {
    const result = validateWordDataset(
      [
        makeWord(1, {
          audio: {
            path: '/audio/0001-test.mp3',
            provider: 'wikimedia-commons',
            kind: 'human',
            licenseReference: 'CC BY-SA 4.0',
          },
        }),
      ],
      { expectedCount: 1 },
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toMatch(/needs an attribution line/);
  });

  test('rejects Commons audio that claims to be synthesized', () => {
    const result = validateWordDataset(
      [
        makeWord(1, {
          audio: {
            path: '/audio/0001-test.mp3',
            provider: 'wikimedia-commons',
            kind: 'neural',
            licenseReference: 'CC BY-SA 4.0',
            attribution: 'Someone / Wikimedia Commons / CC BY-SA 4.0',
          },
        }),
      ],
      { expectedCount: 1 },
    );
    expect(result.errors.join('\n')).toMatch(
      /Wikimedia Commons audio must be human/,
    );
  });

  test('rejects Piper audio that claims to be a human recording', () => {
    const result = validateWordDataset(
      [
        makeWord(1, {
          audio: {
            path: '/audio/0001-test.mp3',
            provider: 'piper-neural',
            kind: 'human',
            licenseReference: 'test',
          },
        }),
      ],
      { expectedCount: 1 },
    );
    expect(result.errors.join('\n')).toMatch(/Piper audio must be neural/);
  });
});
