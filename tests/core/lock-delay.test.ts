import { describe, expect, it } from 'vitest';
import { resetLockDelay, tickLockDelay } from '@engine/core';
import type { LockDelayState } from '@engine/core';

const INITIAL: LockDelayState = { msElapsed: 0, resetsUsed: 0, locked: false };

describe('lock delay', () => {
  it('locks when elapsed time reaches the level threshold', () => {
    expect(tickLockDelay(INITIAL, 499, 1)).toEqual({
      msElapsed: 499, resetsUsed: 0, locked: false,
    });
    expect(tickLockDelay(INITIAL, 500, 1).locked).toBe(true);
    expect(tickLockDelay(INITIAL, 250, 20).locked).toBe(true);
  });

  it('accumulates fractional milliseconds', () => {
    const first = tickLockDelay(INITIAL, 16.67, 1);
    const second = tickLockDelay(first, 16.67, 1);
    expect(second.msElapsed).toBeCloseTo(33.34);
    expect(second.locked).toBe(false);
  });

  it('resets timer for the first 15 successful grounded actions', () => {
    let state = tickLockDelay(INITIAL, 200, 1);
    for (let reset = 1; reset <= 15; reset++) {
      state = resetLockDelay(state);
      expect(state).toEqual({ msElapsed: 0, resetsUsed: reset, locked: false });
      state = tickLockDelay(state, 10, 1);
    }
  });

  it('force-locks on the sixteenth reset attempt', () => {
    let state = INITIAL;
    for (let reset = 0; reset < 15; reset++) state = resetLockDelay(state);
    expect(state).toEqual({ msElapsed: 0, resetsUsed: 15, locked: false });
    expect(resetLockDelay(state)).toEqual({ msElapsed: 0, resetsUsed: 15, locked: true });
  });

  it('keeps locked states locked and returns new objects', () => {
    const locked = { ...INITIAL, locked: true };
    expect(tickLockDelay(locked, 100, 1)).toEqual(locked);
    expect(tickLockDelay(locked, 100, 1)).not.toBe(locked);
    expect(resetLockDelay(locked)).toEqual(locked);
    expect(resetLockDelay(locked)).not.toBe(locked);
  });

  it.each([-1, NaN, Infinity])('rejects invalid dtMs %s', (dtMs) => {
    expect(() => tickLockDelay(INITIAL, dtMs, 1)).toThrow(TypeError);
  });

  it('rejects invalid lock-delay state and level', () => {
    expect(() => tickLockDelay({ ...INITIAL, msElapsed: -1 }, 1, 1)).toThrow(TypeError);
    expect(() => resetLockDelay({ ...INITIAL, resetsUsed: -1 })).toThrow(RangeError);
    expect(() => resetLockDelay({ ...INITIAL, resetsUsed: 16 })).toThrow(RangeError);
    expect(() => tickLockDelay(INITIAL, 1, 21)).toThrow(RangeError);
  });
});
