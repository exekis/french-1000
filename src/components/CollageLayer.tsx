import { useEffect, useMemo, useRef, useState } from 'react';
import { resolveAssetPath } from '../lib/assets';
import stickerManifest from '../data/stickers.json';

export type Sticker = {
  id: string;
  file: string;
  kind: string;
  mode: string;
  width: number;
  height: number;
};

// scanned public domain plates, prints and stamps, cut off their paper at build time
export const stickers = (stickerManifest.stickers ?? []) as Sticker[];

export type Placement = {
  piece: number;
  side: 'left' | 'right';
  top: number;
  inset: number;
  rotate: number;
  width: number;
  opacity: number;
};

// a band every SPACING pixels, with a scrap pasted in both margins, so the album reads
// as a full page rather than a few pieces floating in white space
const SPACING = 165;
const FIRST_OFFSET = 90;
export const MAX_PIECES = 620;
// below this there is no real margin to paste anything into, so the collage sits out
const MIN_GUTTER = 62;

// a stable hash rather than Math.random, so the page looks identical on every visit
// and never reshuffles when React re-renders
function noise(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function readContentWidth(): number {
  if (typeof window === 'undefined') return 1120;
  const declared = getComputedStyle(document.documentElement).getPropertyValue(
    '--content-width',
  );
  const parsed = Number.parseFloat(declared);
  return Number.isFinite(parsed) ? parsed : 1120;
}

export function buildPlacements(height: number, width: number): Placement[] {
  // the scraps live in the margins either side of the column, so everything is sized
  // from whatever gutter is actually left over at this viewport
  const gutter = (width - readContentWidth()) / 2;
  if (height <= 0 || gutter < MIN_GUTTER || stickers.length === 0) return [];

  const maxWidth = Math.min(265, gutter * 1.35);
  const bands = Math.max(3, Math.floor((height - FIRST_OFFSET) / SPACING));
  const count = Math.min(MAX_PIECES, bands * 2);
  // once the cap bites, the bands are stretched so the pieces still reach the bottom
  const usable = Math.max(1, height - FIRST_OFFSET - 160);
  const step = usable / Math.max(1, Math.ceil(count / 2));

  return Array.from({ length: count }, (_, index) => {
    const a = noise(index + 1);
    const b = noise(index + 41);
    const c = noise(index + 97);
    const d = noise(index + 151);
    const band = Math.floor(index / 2);

    const pieceWidth = Math.round(Math.max(62, maxWidth * (0.38 + c * 0.62)));
    // a scrap may tuck a third of its width under the column, which is what gives the
    // page its layered look. the outer edge is what must never be crossed
    const deepest = Math.max(0, gutter - pieceWidth * 0.66);
    const room = Math.max(0, Math.min(deepest, gutter - pieceWidth * 0.66));

    return {
      piece: Math.floor(a * stickers.length) % stickers.length,
      side: index % 2 === 0 ? 'right' : 'left',
      top: Math.round(FIRST_OFFSET + band * step + (b - 0.5) * step * 0.7),
      inset: Math.round(d * room),
      rotate: Math.round((b - 0.5) * 22),
      width: pieceWidth,
      opacity: 0.62 + a * 0.33,
    };
  });
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function CollageLayer() {
  const layer = useRef<HTMLDivElement | null>(null);
  const nodes = useRef(new Map<number, Element>());
  const lastMeasure = useRef({ width: -1, count: -1 });
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(new Set());
  // without an observer, or when motion is turned down, the scraps are simply already
  // on the page rather than drifting in
  const [showAtOnce] = useState(
    () => typeof IntersectionObserver === 'undefined' || prefersReducedMotion(),
  );

  // the page height changes with search results and the gutter changes with the window,
  // so the scraps are re-spread whenever either one moves
  useEffect(() => {
    const element = layer.current;
    if (!element) return;

    const measure = () => {
      const box = element.getBoundingClientRect();
      const width = Math.round(box.width);
      const next = buildPlacements(box.height, box.width);
      if (
        width === lastMeasure.current.width &&
        next.length === lastMeasure.current.count
      ) {
        return;
      }
      lastMeasure.current = { width, count: next.length };
      setPlacements(next);
    };
    measure();

    window.addEventListener('resize', measure);
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(measure);
    observer?.observe(element);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (placements.length === 0 || showAtOnce) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const arrived: number[] = [];
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          arrived.push(
            Number((entry.target as HTMLElement).dataset.collageIndex),
          );
          observer.unobserve(entry.target);
        }
        if (arrived.length > 0) {
          setRevealed((current) => new Set([...current, ...arrived]));
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );

    nodes.current.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [placements, showAtOnce]);

  const styles = useMemo(
    () =>
      placements.map(
        (placement) =>
          ({
            top: `${placement.top}px`,
            [placement.side]: `${placement.inset}px`,
            width: `${placement.width}px`,
            '--piece-rotate': `${placement.rotate}deg`,
            '--piece-opacity': placement.opacity,
            '--piece-drift': placement.side === 'left' ? '-20px' : '20px',
          }) as React.CSSProperties,
      ),
    [placements],
  );

  return (
    <div className="collage-layer" ref={layer} aria-hidden="true">
      {placements.map((placement, index) => {
        const sticker = stickers[placement.piece]!;
        const isRevealed = showAtOnce || revealed.has(index);
        return (
          <div
            key={`${sticker.id}-${placement.top}`}
            className={`collage-piece${isRevealed ? ' is-revealed' : ''}`}
            data-collage-index={index}
            data-mode={sticker.mode}
            ref={(node) => {
              if (node) nodes.current.set(index, node);
              else nodes.current.delete(index);
            }}
            style={styles[index]}
          >
            <img
              src={resolveAssetPath(sticker.file)}
              alt=""
              width={sticker.width}
              height={sticker.height}
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          </div>
        );
      })}
    </div>
  );
}
