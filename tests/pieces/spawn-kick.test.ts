import { describe, expect, it } from 'vitest';
import { KICK_OFFSETS, SPAWN_KICK_OFFSETS } from '@engine/pieces';

describe('SPAWN_KICK_OFFSETS', () => {
  it('is a frozen empty table for the MVP fixed-origin top-out policy', () => {
    expect(SPAWN_KICK_OFFSETS).toEqual([]);
    expect(Object.isFrozen(SPAWN_KICK_OFFSETS)).toBe(true);
    expect(SPAWN_KICK_OFFSETS).not.toBe(KICK_OFFSETS);
  });
});
