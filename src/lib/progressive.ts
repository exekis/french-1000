import { startTransition, useCallback, useEffect, useState } from 'react';

// enough rows to cover the tallest phone on the first paint. the rest arrive in the gaps
// between frames, so the list is whole within about a second and find-in-page, rank links
// and printing still see all thousand words
const FIRST_PAINT = 60;
// a table relays out as a whole every time rows are added, so a few larger bands measured
// cheaper than many small ones. the generous idle timeout is only a backstop for a page
// that never falls quiet, not the normal path
const CHUNK = 140;

type IdleHandle = { cancel(): void };

// requestIdleCallback only reached safari recently, so the timeout is the fallback rather
// than the exception
function whenIdle(run: () => void): IdleHandle {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(run, { timeout: 2000 });
    return { cancel: () => cancelIdleCallback(id) };
  }
  const id = setTimeout(run, 32);
  return { cancel: () => clearTimeout(id) };
}

export function useProgressiveRows(total: number) {
  const [count, setCount] = useState(() => Math.min(total, FIRST_PAINT));

  useEffect(() => {
    if (count >= total) return;
    // a transition tells react this render may be interrupted, so typing wins over
    // filling in rows the reader has not scrolled to yet
    const idle = whenIdle(() =>
      startTransition(() => setCount((current) => current + CHUNK)),
    );
    return () => idle.cancel();
  }, [count, total]);

  // a rank jump can land past the filled-in part, so the list is grown to meet it rather
  // than making the reader wait for the idle chunks to catch up
  const ensure = useCallback((wanted: number) => {
    setCount((current) => (wanted > current ? wanted : current));
  }, []);

  return [Math.min(count, total), ensure] as const;
}
