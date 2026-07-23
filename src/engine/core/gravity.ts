import {
  SOFT_DROP_GRAVITY_MULT,
  SOFT_DROP_MIN_GRAVITY_STEP,
  gravityStepAtLevel,
} from '@engine/difficulty';

export interface GravityState {
  readonly ticksAccumulated: number;
  readonly softDropActive: boolean;
}

export interface GravityTickResult {
  readonly state: GravityState;
  readonly shouldFallRow: boolean;
}

/** Advance gravity by one simulation tick. */
export function tickGravity(
  state: GravityState,
  level: number,
  softDrop: boolean,
): GravityTickResult {
  assertValidGravityState(state);
  if (typeof softDrop !== 'boolean') {
    throw new TypeError(`softDrop must be boolean, got ${typeof softDrop}`);
  }
  const gravityStep = gravityStepAtLevel(level);
  const increment = softDrop ? SOFT_DROP_GRAVITY_MULT : 1;
  const accumulated = state.ticksAccumulated + increment;
  const shouldFallRow = accumulated >= gravityStep;
  return {
    state: {
      ticksAccumulated: shouldFallRow ? 0 : accumulated,
      softDropActive: softDrop,
    },
    shouldFallRow,
  };
}

/** Soft drop scores only when it is faster than natural gravity. */
export function isSoftDropScoringEligible(level: number): boolean {
  return gravityStepAtLevel(level) > SOFT_DROP_MIN_GRAVITY_STEP;
}

function assertValidGravityState(state: GravityState): void {
  if (!Number.isInteger(state.ticksAccumulated) || state.ticksAccumulated < 0) {
    throw new TypeError(
      `ticksAccumulated must be non-negative integer, got ${state.ticksAccumulated}`,
    );
  }
  if (typeof state.softDropActive !== 'boolean') {
    throw new TypeError('softDropActive must be boolean');
  }
}
