import { describe, expect, it } from 'vitest';
import {
  KICK_OFFSETS,
  ROTATION_STATES,
  assertValidKickOffsets,
  pieceMaxDz,
} from '@engine/pieces';

const EXPECTED_OFFSETS = [
  [0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1],
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [2, 0, 0], [-2, 0, 0], [0, 2, 0], [0, -2, 0],
] as const;

describe('KICK_OFFSETS', () => {
  it('matches ADR-0002 §2.4 byte-for-byte and is deeply frozen', () => {
    expect(KICK_OFFSETS).toEqual(EXPECTED_OFFSETS);
    expect(Object.isFrozen(KICK_OFFSETS)).toBe(true);
    expect(KICK_OFFSETS.every(Object.isFrozen)).toBe(true);
  });

  it('satisfies all offset invariants', () => {
    expect(() => assertValidKickOffsets(KICK_OFFSETS)).not.toThrow();
    expect(new Set(KICK_OFFSETS.map((offset) => offset.join(','))).size).toBe(14);
    for (const [dx, dy, dz] of KICK_OFFSETS) {
      expect(Math.abs(dx)).toBeLessThanOrEqual(2);
      expect(Math.abs(dy)).toBeLessThanOrEqual(2);
      expect(Math.abs(dx) + Math.abs(dy) + Math.abs(dz)).toBeLessThanOrEqual(4);
      expect([dx, dy, dz]).not.toEqual([0, 0, -1]);
    }
  });

  it('fails closed for malformed offset tables', () => {
    expect(() => assertValidKickOffsets(KICK_OFFSETS.slice(0, 13))).toThrow();
    expect(() => assertValidKickOffsets([...KICK_OFFSETS.slice(0, 13), KICK_OFFSETS[0]!])).toThrow();
    expect(() => assertValidKickOffsets([...KICK_OFFSETS.slice(0, 13), [3, 0, 0]])).toThrow();
    expect(() => assertValidKickOffsets([...KICK_OFFSETS.slice(0, 13), [0, 0, 2]])).toThrow();
    expect(() => assertValidKickOffsets([...KICK_OFFSETS.slice(0, 13), [1, 0, -1]])).toThrow();
  });
});

describe('pieceMaxDz', () => {
  it('is dynamically derived from all fixed rotation states', () => {
    const independentlyComputed = ROTATION_STATES.map((states) => Math.max(
      ...states.flatMap((state) => Array.from(
        { length: state.cellCount },
        (_, cellIndex) => state.cells[cellIndex * 3 + 2]!,
      )),
    ));
    expect(pieceMaxDz).toEqual(independentlyComputed);
    expect(pieceMaxDz).toEqual([0, 1, 2, 1, 3, 1, 2, 2, 2, 1, 1, 1]);
    expect(pieceMaxDz.every((value) => value >= 0 && value <= 3)).toBe(true);
    expect(Math.max(...pieceMaxDz)).toBe(3);
  });

  it('keeps state and anchor unchanged for the first zero kick', () => {
    const stateId = ROTATION_STATES[6]![0]!.stateId;
    const anchor = [2, 2, 11] as const;
    const [dx, dy, dz] = KICK_OFFSETS[0]!;
    expect(stateId).toBe(ROTATION_STATES[6]![0]!.stateId);
    expect([anchor[0] + dx, anchor[1] + dy, anchor[2] + dz]).toEqual(anchor);
  });
});
