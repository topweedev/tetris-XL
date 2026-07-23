import { describe, expect, it } from 'vitest';
import { isSoftDropScoringEligible, tickGravity } from '@engine/core';
import type { GravityState } from '@engine/core';

const INITIAL: GravityState = { ticksAccumulated: 0, softDropActive: false };

describe('gravity', () => {
  it('falls after the level threshold and resets accumulation', () => {
    let state = INITIAL;
    for (let tick = 1; tick < 60; tick++) {
      const result = tickGravity(state, 1, false);
      expect(result.shouldFallRow).toBe(false);
      state = result.state;
    }
    expect(tickGravity(state, 1, false)).toEqual({
      state: { ticksAccumulated: 0, softDropActive: false },
      shouldFallRow: true,
    });
  });

  it('uses the 20x soft-drop accumulator', () => {
    const first = tickGravity(INITIAL, 1, true);
    expect(first).toEqual({
      state: { ticksAccumulated: 20, softDropActive: true },
      shouldFallRow: false,
    });
    const second = tickGravity(first.state, 1, true);
    const third = tickGravity(second.state, 1, true);
    expect(third.shouldFallRow).toBe(true);
    expect(third.state.ticksAccumulated).toBe(0);
  });

  it('falls every tick at levels 14 through 20', () => {
    for (let level = 14; level <= 20; level++) {
      expect(tickGravity(INITIAL, level, false).shouldFallRow).toBe(true);
    }
  });

  it('only awards soft-drop scoring at levels 1 through 13', () => {
    for (let level = 1; level <= 13; level++) {
      expect(isSoftDropScoringEligible(level)).toBe(true);
    }
    for (let level = 14; level <= 20; level++) {
      expect(isSoftDropScoringEligible(level)).toBe(false);
    }
  });

  it('returns new state without mutating input', () => {
    const state = { ...INITIAL };
    const result = tickGravity(state, 1, false);
    expect(result.state).not.toBe(state);
    expect(state).toEqual(INITIAL);
  });

  it('rejects invalid state, level, and soft-drop input', () => {
    expect(() => tickGravity({ ...INITIAL, ticksAccumulated: -1 }, 1, false))
      .toThrow(TypeError);
    expect(() => tickGravity({ ...INITIAL, ticksAccumulated: 0.5 }, 1, false))
      .toThrow(TypeError);
    expect(() => tickGravity(INITIAL, 0, false)).toThrow(RangeError);
    expect(() => tickGravity(INITIAL, 1, 1 as unknown as boolean)).toThrow(TypeError);
  });
});
