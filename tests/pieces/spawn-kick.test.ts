import { describe, expect, it } from 'vitest';
import {
  KICK_OFFSETS,
  SPAWN_KICK_OFFSETS,
  assertValidSpawnKickOffsets,
} from '@engine/pieces';

describe('SPAWN_KICK_OFFSETS', () => {
  it('is a frozen empty table for the MVP fixed-origin top-out policy', () => {
    expect(SPAWN_KICK_OFFSETS).toEqual([]);
    expect(Object.isFrozen(SPAWN_KICK_OFFSETS)).toBe(true);
    expect(SPAWN_KICK_OFFSETS).not.toBe(KICK_OFFSETS);
    expect(() => assertValidSpawnKickOffsets([])).not.toThrow();
  });

  it('accepts a future horizontal origin-first table', () => {
    expect(() => assertValidSpawnKickOffsets([[0, 0, 0], [1, 0, 0]])).not.toThrow();
  });

  it.each([
    ['missing origin', [[1, 0, 0]]],
    ['positive z', [[0, 0, 0], [0, 0, 1]]],
    ['negative z', [[0, 0, 0], [0, 0, -1]]],
    ['out of range', [[0, 0, 0], [3, 0, 0]]],
    ['duplicate', [[0, 0, 0], [0, 0, 0]]],
  ] as const)('rejects %s', (_label, offsets) => {
    expect(() => assertValidSpawnKickOffsets(offsets)).toThrow();
  });
});
