import { describe, expect, it } from 'vitest';
import {
  createGravityState,
  isSoftDropScoringEligible,
  tickGravity,
} from '@engine/core';

const INITIAL = createGravityState();

describe('gravity', () => {
  it('creates a frozen zeroed state', () => {
    expect(INITIAL).toEqual({ ticksAccumulated: 0 });
    expect(Object.isFrozen(INITIAL)).toBe(true);
  });

  it('falls after the level threshold and resets accumulation', () => {
    let state = INITIAL;
    for (let tick = 1; tick < 60; tick++) {
      const result = tickGravity(state, 1, false);
      expect(result.shouldFallRow).toBe(false);
      state = result.state;
    }
    expect(tickGravity(state, 1, false)).toEqual({
      state: { ticksAccumulated: 0 },
      shouldFallRow: true,
    });
  });

  it('soft drops every tick with effective step 1', () => {
    const result = tickGravity(INITIAL, 1, true);
    expect(result).toEqual({
      state: { ticksAccumulated: 0 },
      shouldFallRow: true,
    });
    expect(Object.isFrozen(result.state)).toBe(true);
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

  it('returns new frozen state without mutating input', () => {
    const state = createGravityState();
    const result = tickGravity(state, 1, false);
    expect(result.state).not.toBe(state);
    expect(result.state).toEqual({ ticksAccumulated: 1 });
    expect(Object.isFrozen(result.state)).toBe(true);
    expect(state).toEqual(INITIAL);
  });

  it('rejects invalid state, level, and soft-drop input', () => {
    expect(() => tickGravity({ ticksAccumulated: -1 }, 1, false)).toThrow(TypeError);
    expect(() => tickGravity({ ticksAccumulated: 0.5 }, 1, false)).toThrow(TypeError);
    expect(() => tickGravity(INITIAL, 0, false)).toThrow(RangeError);
    expect(() => tickGravity(INITIAL, 1, 1 as unknown as boolean)).toThrow(TypeError);
  });
});
