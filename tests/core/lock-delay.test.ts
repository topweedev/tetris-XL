import { describe, expect, it } from 'vitest';
import {
  createLockDelayState,
  resetLockDelay,
  tickLockDelay,
} from '@engine/core';

const INITIAL = createLockDelayState();

describe('lock delay', () => {
  it('creates a frozen zeroed state', () => {
    expect(INITIAL).toEqual({ msElapsed: 0, resetsUsed: 0, locked: false });
    expect(Object.isFrozen(INITIAL)).toBe(true);
  });

  it('locks when elapsed time reaches the level threshold', () => {
    expect(tickLockDelay(INITIAL, 499, 1)).toEqual({
      msElapsed: 499, resetsUsed: 0, locked: false,
    });
    expect(tickLockDelay(INITIAL, 500, 1).locked).toBe(true);
    expect(tickLockDelay(INITIAL, 250, 20).locked).toBe(true);
  });

  it('accumulates fractional milliseconds in frozen states', () => {
    const first = tickLockDelay(INITIAL, 16.67, 1);
    const second = tickLockDelay(first, 16.67, 1);
    expect(second.msElapsed).toBeCloseTo(33.34);
    expect(second.locked).toBe(false);
    expect(Object.isFrozen(second)).toBe(true);
  });

  it('resets timer for the first 15 successful grounded actions', () => {
    let state = tickLockDelay(INITIAL, 200, 1);
    for (let reset = 1; reset <= 15; reset++) {
      state = resetLockDelay(state);
      expect(state).toEqual({ msElapsed: 0, resetsUsed: reset, locked: false });
      expect(Object.isFrozen(state)).toBe(true);
      state = tickLockDelay(state, 10, 1);
    }
  });

  it('force-locks on the sixteenth reset attempt', () => {
    let state = INITIAL;
    for (let reset = 0; reset < 15; reset++) state = resetLockDelay(state);
    expect(state).toEqual({ msElapsed: 0, resetsUsed: 15, locked: false });
    expect(resetLockDelay(state)).toEqual({ msElapsed: 0, resetsUsed: 15, locked: true });
  });

  it('returns an existing locked state unchanged', () => {
    const locked = tickLockDelay(INITIAL, 500, 1);
    expect(tickLockDelay(locked, -1, 0)).toBe(locked);
    expect(resetLockDelay(locked)).toBe(locked);
  });

  it.each([-1, NaN, Infinity])('rejects invalid dtMs %s', (dtMs) => {
    expect(() => tickLockDelay(INITIAL, dtMs, 1)).toThrow(RangeError);
  });

  it('rejects overflow, invalid state, and invalid level', () => {
    expect(() => tickLockDelay({ ...INITIAL, msElapsed: Number.MAX_VALUE }, Number.MAX_VALUE, 1))
      .toThrow(/overflow/);
    expect(() => tickLockDelay({ ...INITIAL, msElapsed: -1 }, 1, 1)).toThrow(RangeError);
    expect(() => resetLockDelay({ ...INITIAL, resetsUsed: -1 })).toThrow(RangeError);
    expect(() => resetLockDelay({ ...INITIAL, resetsUsed: 16 })).toThrow(RangeError);
    expect(() => tickLockDelay(INITIAL, 1, 21)).toThrow(RangeError);
  });
});
