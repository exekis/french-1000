// @vitest-environment node

import { describe, expect, test } from 'vitest';
import { z } from 'zod/v4';
import { parseStructuredJson } from '../scripts/lib/structured-output';

describe('compatible structured output', () => {
  const schema = z.object({ sentence: z.string() });

  test('parses a JSON object wrapped in model reasoning text', () => {
    expect(
      parseStructuredJson(
        'reasoning before\n{"sentence":"Bonjour !"}\nreasoning after',
        schema,
      ),
    ).toEqual({ sentence: 'Bonjour !' });
  });

  test('rejects text without a JSON object', () => {
    expect(() => parseStructuredJson('Bonjour !', schema)).toThrow(
      /did not contain a JSON object/,
    );
  });
});
