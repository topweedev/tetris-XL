import { LOCK_DELAY_RESET_CAP, lockDelayAtLevel } from '@engine/difficulty';

export interface LockDelayState {
  readonly msElapsed: number;
  readonly resetsUsed: number;
  readonly locked: boolean;
}

export function createLockDelayState(): LockDelayState {
  return Object.freeze({ msElapsed: 0, resetsUsed: 0, locked: false });
}

/** Advance timer by dtMs and lock when the level threshold is reached. */
export function tickLockDelay(
  state: LockDelayState,
  dtMs: number,
  level: number,
): LockDelayState {
  assertValidLockDelayState(state);
  if (state.locked) return state;
  if (!Number.isFinite(dtMs) || dtMs < 0) {
    throw new RangeError(`dtMs must be non-negative finite, got ${dtMs}`);
  }
  const threshold = lockDelayAtLevel(level);
  const nextMs = state.msElapsed + dtMs;
  if (!Number.isFinite(nextMs)) {
    throw new RangeError(`lock delay elapsed time overflow: ${nextMs}`);
  }
  return Object.freeze({
    msElapsed: nextMs,
    resetsUsed: state.resetsUsed,
    locked: nextMs >= threshold,
  });
}

/** Reset a grounded timer; the sixteenth attempt force-locks. */
export function resetLockDelay(state: LockDelayState): LockDelayState {
  assertValidLockDelayState(state);
  if (state.locked) return state;
  if (state.resetsUsed >= LOCK_DELAY_RESET_CAP) {
    return Object.freeze({ ...state, locked: true });
  }
  return Object.freeze({
    msElapsed: 0,
    resetsUsed: state.resetsUsed + 1,
    locked: false,
  });
}

function assertValidLockDelayState(state: LockDelayState): void {
  if (!Number.isFinite(state.msElapsed) || state.msElapsed < 0) {
    throw new RangeError(`msElapsed must be non-negative finite, got ${state.msElapsed}`);
  }
  if (
    !Number.isInteger(state.resetsUsed)
    || state.resetsUsed < 0
    || state.resetsUsed > LOCK_DELAY_RESET_CAP
  ) {
    throw new RangeError(
      `resetsUsed must be integer in [0, ${LOCK_DELAY_RESET_CAP}], got ${state.resetsUsed}`,
    );
  }
  if (typeof state.locked !== 'boolean') throw new TypeError('locked must be boolean');
}
