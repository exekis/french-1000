import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { LanguageCode } from '../src/lib/languages';
import { meaningFor, useMeanings } from '../src/lib/meanings';
import { makeWord } from './fixtures';

vi.mock('../src/data/meanings/es.json', () => ({
  default: { code: 'es', meanings: { '0001': 'casa' } },
}));
vi.mock('../src/data/meanings/de.json', () => ({
  default: { code: 'de', meanings: { '0001': 'Haus' } },
}));

describe('reading a meaning', () => {
  const word = makeWord(1, {
    french: 'maison',
    english: 'house',
    persian: 'خانه',
  });

  test('takes the baseline meanings straight off the record', () => {
    expect(meaningFor(word, 'en', {})).toBe('house');
    expect(meaningFor(word, 'fa', {})).toBe('خانه');
  });

  test('takes an added language from what has been loaded', () => {
    expect(meaningFor(word, 'es', { es: { '0001': 'casa' } })).toBe('casa');
  });

  test('reports nothing rather than an empty string when a language is absent', () => {
    expect(meaningFor(word, 'es', {})).toBeUndefined();
    expect(meaningFor(word, 'es', { es: {} })).toBeUndefined();
  });
});

describe('loading meaning files', () => {
  test('fetches a language that was turned on', async () => {
    const { result } = renderHook(() => useMeanings(['es']));
    await waitFor(() => expect(result.current.loaded.es).toBeDefined());
    expect(result.current.loaded.es?.['0001']).toBe('casa');
    expect(result.current.pending).toEqual([]);
  });

  test('reports a language as pending until its file arrives', () => {
    const { result } = renderHook(() => useMeanings(['de']));
    expect(result.current.pending).toContain('de');
  });

  test('never asks for the bundled baseline languages', async () => {
    const { result } = renderHook(() => useMeanings(['en', 'fa']));
    await waitFor(() => expect(result.current.pending).toEqual([]));
    expect(result.current.loaded.en).toBeUndefined();
  });

  // a language switched off mid-load used to finish into the module cache and never
  // reach state, leaving its column permanently blank once it was switched back on.
  // the module is reset first so the shared cache cannot make this pass for free
  test('keeps a file that finished loading after its language was switched off', async () => {
    vi.resetModules();
    const fresh = await import('../src/lib/meanings');

    const { result, rerender } = renderHook(
      ({ codes }: { codes: LanguageCode[] }) => fresh.useMeanings(codes),
      { initialProps: { codes: ['es'] as LanguageCode[] } },
    );
    expect(result.current.loaded.es).toBeUndefined();

    rerender({ codes: ['fa'] });
    rerender({ codes: ['es'] });

    await waitFor(() => expect(result.current.loaded.es).toBeDefined());
    expect(result.current.loaded.es?.['0001']).toBe('casa');
  });
});
