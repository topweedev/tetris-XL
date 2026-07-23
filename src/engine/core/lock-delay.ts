import { LOCK_DELAY_RESET_CAP, lockDelayAtLevel } from '@engine/difficulty';

export interface LockDelayState {
  readonly msElapsed: number;
  readonly resetsUsed: number;
  readonly locked: boolean;
}

/** Advance the grounded lock timer by dtMs. */
export function tickLockDelay(
  state: LockDelayState,
  dtMs: number,
  level: number,
): LockDelayState {
  assertValidLockDelayState(state);
  assertValidDelta(dtMs);
  const threshold = lockDelayAtLevel(level);
  if (state.locked) return { ...state };
  const msElapsed = state.msElapsed + dtMs;
  return {
    msElapsed,
    resetsUsed: state.resetsUsed,
    locked: msElapsed >= threshold,
  };
}

/** Reset after a successful grounded action; attempt sixteen force-locks. */
export function resetLockDelay(state: LockDelayState): LockDelayState {
  assertValidLockDelayState(state);
  if (state.locked) return { ...state };
  if (state.resetsUsed >= LOCK_DELAY_RESET_CAP) {
    return { ...state, locked: true };
  }
  return { msElapsed: 0, resetsUsed: state.resetsUsed + 1, locked: false };
}

function assertValidLockDelayState(state: LockDelayState): void {
  if (!Number.isFinite(state.msElapsed) || state.msElapsed < 0) {
    throw new TypeError(`msElapsed must be finite and non-negative, got ${state.msElapsed}`);
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

function assertValidDelta(dtMs: number): void {
  if (!Number.isFinite(dtMs) || dtMs < 0) {
    throw new TypeError(`dtMs must be finite and non-negative, got ${dtMs}`);
  }
}
