// @vitest-environment jsdom

import { describe, expect, test } from 'vitest';
import {
  buildPlacements,
  MAX_PIECES,
  stickers,
} from '../src/components/CollageLayer';

const CONTENT = 1120;

describe('collage placement', () => {
  test('stays out of the way when there is no margin to paste into', () => {
    expect(buildPlacements(4000, 900)).toEqual([]);
    expect(buildPlacements(4000, CONTENT)).toEqual([]);
    expect(buildPlacements(4000, CONTENT + 100)).toEqual([]);
  });

  test('produces nothing for a page with no height yet', () => {
    expect(buildPlacements(0, 1600)).toEqual([]);
  });

  test('never lets a scrap hang off the outer edge of the page', () => {
    for (const width of [1250, 1400, 1600, 1920, 2560]) {
      for (const placement of buildPlacements(40000, width)) {
        // the outer edge is the one that would make the page scroll sideways. the
        // inner edge may run under the column, which is what layers the collage
        expect(placement.inset).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('keeps most of every scrap inside the margin', () => {
    for (const width of [1400, 1600, 1920]) {
      const gutter = (width - CONTENT) / 2;
      for (const placement of buildPlacements(40000, width)) {
        // at least two thirds of the artwork stays in the margin, so a scrap is never
        // mostly buried behind the opaque list
        expect(placement.inset + placement.width * 0.66).toBeLessThanOrEqual(
          gutter + 1,
        );
      }
    }
  });

  test('pastes a scrap into both margins', () => {
    const sides = new Set(
      buildPlacements(40000, 1600).map((placement) => placement.side),
    );
    expect([...sides].toSorted()).toEqual(['left', 'right']);
  });

  test('scales the count with the length of the page', () => {
    const short = buildPlacements(3000, 1600);
    const long = buildPlacements(40000, 1600);
    expect(short.length).toBeGreaterThan(0);
    expect(long.length).toBeGreaterThan(short.length);
  });

  test('caps how many scraps a very long list can produce', () => {
    expect(buildPlacements(5_000_000, 1600)).toHaveLength(MAX_PIECES);
  });

  test('is deterministic, so the album never reshuffles between renders', () => {
    expect(buildPlacements(40000, 1600)).toEqual(buildPlacements(40000, 1600));
  });

  test('alternates sides and keeps every scrap on a real piece of art', () => {
    const placements = buildPlacements(20000, 1600);
    expect(placements[0]?.side).toBe('right');
    expect(placements[1]?.side).toBe('left');
    for (const placement of placements) {
      expect(placement.piece).toBeGreaterThanOrEqual(0);
      expect(placement.piece).toBeLessThan(stickers.length);
      expect(placement.opacity).toBeGreaterThan(0);
      expect(placement.opacity).toBeLessThanOrEqual(1);
    }
  });

  test('spreads scraps all the way down the page', () => {
    const height = 40000;
    const tops = buildPlacements(height, 1600).map(
      (placement) => placement.top,
    );
    expect(Math.min(...tops)).toBeLessThan(600);
    // the last band still lands near the foot of the page rather than stopping short
    expect(Math.max(...tops)).toBeGreaterThan(height * 0.9);
  });

  test('gets denser than the sparse first pass', () => {
    // one screen and a half of scrolling used to carry a single scrap
    expect(buildPlacements(10000, 1600).length).toBeGreaterThan(40);
  });
});
