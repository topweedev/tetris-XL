import { describe, expect, it } from 'vitest';
import { SENTINEL_CELL } from '@engine/types';
import {
  EXPECTED_ROTATION_STATE_COUNTS,
  ROTATION_STATES,
  canonicalCellKey,
  computeOrigin,
  unpackCells,
} from '@engine/pieces';

describe('fixed polycube rotation states', () => {
  it('matches the corrected SO24 orbit counts and total', () => {
    // TODO ADR-0002 §2.3 correction: L4 is asymmetric, so its SO24 orbit is 24, not 12.
    expect(ROTATION_STATES.map((states) => states.length)).toEqual(
      EXPECTED_ROTATION_STATE_COUNTS,
    );
    expect(ROTATION_STATES.flat()).toHaveLength(105);
  });

  it('keeps RS4 and LS4 chiral state sets disjoint', () => {
    const rightKeys = new Set(ROTATION_STATES[9]!.map((state) =>
      canonicalCellKey(unpackCells(state)),
    ));
    const leftKeys = ROTATION_STATES[10]!.map((state) => canonicalCellKey(unpackCells(state)));
    expect(leftKeys.some((key) => rightKeys.has(key))).toBe(false);
    expect(new Set([...rightKeys, ...leftKeys]).size).toBe(24);
  });

  it('normalizes every state and computes its origin deterministically', () => {
    for (const state of ROTATION_STATES.flat()) {
      const cells = unpackCells(state);
      expect(Math.min(...cells.map(([x]) => x))).toBe(0);
      expect(Math.min(...cells.map(([, y]) => y))).toBe(0);
      expect(Math.min(...cells.map(([, , z]) => z))).toBe(0);
      expect(state.origin).toEqual(computeOrigin(cells));
      expect([...state.origin].every((coordinate) =>
        coordinate >= 0 && coordinate < state.cellCount,
      )).toBe(true);
    }
  });

  it('packs used xyz triplets and fills unused slots with SENTINEL_CELL', () => {
    for (const state of ROTATION_STATES.flat()) {
      expect(state.cells).toBeInstanceOf(Int8Array);
      expect(state.cells).toHaveLength(12);
      expect([...state.cells.slice(state.cellCount * 3)]).toEqual(
        Array.from({ length: 12 - state.cellCount * 3 }, () => SENTINEL_CELL),
      );
      expect([...state.cells.slice(0, state.cellCount * 3)]).not.toContain(SENTINEL_CELL);
    }
  });

  it('uses lower lexicographic integer on half-centroid ties', () => {
    expect([...computeOrigin([[0, 0, 0]])]).toEqual([0, 0, 0]);
    expect([...computeOrigin([[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]])])
      .toEqual([1, 0, 0]);
    expect([...computeOrigin([[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]])])
      .toEqual([0, 0, 0]);
  });
});
