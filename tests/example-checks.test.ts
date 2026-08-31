// @vitest-environment node

import { describe, expect, test } from 'vitest';
import {
  checkExample,
  containsExampleTarget,
  findDuplicateExamples,
} from '../scripts/lib/example-checks';

describe('example checks', () => {
  test('accepts a short punctuated example containing its target', () => {
    expect(
      checkExample(
        { exampleFrench: 'Je veux être ici.', exampleTarget: 'être' },
        { french: 'être' },
      ),
    ).toEqual({ passed: true, flags: [], wordCount: 4 });
  });

  test('flags missing targets, placeholders, and punctuation', () => {
    const result = checkExample(
      { exampleFrench: 'TODO phrase simple', exampleTarget: 'être' },
      { french: 'être' },
    );
    expect(result.flags).toEqual(
      expect.arrayContaining([
        'target-not-present',
        'missing-sentence-punctuation',
        'placeholder',
      ]),
    );
  });

  test('does not accept a target hidden inside another French word', () => {
    expect(
      checkExample(
        { exampleFrench: 'Il reste ici.', exampleTarget: 'est' },
        { french: 'est' },
      ).flags,
    ).toContain('target-not-present');
  });

  test('accepts presentation-equivalent apostrophes in the target', () => {
    expect(containsExampleTarget('L’un des garçons joue.', "l'un")).toBe(true);
  });

  test('does not erase accents when checking the demonstrated surface form', () => {
    expect(containsExampleTarget('Il marche sur la route.', 'sûr')).toBe(false);
  });

  test('finds duplicate normalized sentences', () => {
    const duplicates = findDuplicateExamples([
      { id: '0001', exampleFrench: 'Voilà l’été.' },
      { id: '0002', exampleFrench: 'Voila l’ete.' },
    ]);
    expect([...duplicates.values()]).toEqual([['0001', '0002']]);
  });
});
