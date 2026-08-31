import { useCallback, useEffect, useState } from 'react';

// the site is static and has no accounts, so everything a reader marks lives in their
// own browser. every access is guarded because storage throws outright in some
// privacy modes rather than simply being empty
export function readStored<T>(
  key: string,
  parse: (raw: unknown) => T | null,
): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    return parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function useStoredState<T>(
  key: string,
  fallback: T,
  parse: (raw: unknown) => T | null,
): [T, (next: T | ((current: T) => T)) => void] {
  const [value, setValue] = useState<T>(fallback);

  // the first paint uses the fallback so the server and client markup agree, then the
  // stored value is adopted straight after mount
  useEffect(() => {
    const stored = readStored(key, parse);
    if (stored !== null) setValue(stored);
    // parse is defined at module scope by every caller, so it is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T | ((current: T) => T)) => {
      setValue((current) => {
        const resolved =
          typeof next === 'function'
            ? (next as (current: T) => T)(current)
            : next;
        writeStored(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  return [value, update];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}
