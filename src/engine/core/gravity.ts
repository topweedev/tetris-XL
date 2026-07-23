import {
  SOFT_DROP_MIN_GRAVITY_STEP,
  gravityStepAtLevel,
} from '@engine/difficulty';

export interface GravityState {
  readonly ticksAccumulated: number;
}

export interface GravityTickResult {
  readonly state: GravityState;
  readonly shouldFallRow: boolean;
}

export function createGravityState(): GravityState {
  return Object.freeze({ ticksAccumulated: 0 });
}

/** Advance one tick; soft drop uses an effective one-tick step. */
export function tickGravity(
  state: GravityState,
  level: number,
  softDrop: boolean,
): GravityTickResult {
  assertValidGravityState(state);
  if (typeof softDrop !== 'boolean') {
    throw new TypeError(`softDrop must be boolean, got ${typeof softDrop}`);
  }
  const stepBase = gravityStepAtLevel(level);
  const stepEffective = softDrop ? 1 : stepBase;
  const nextTicks = state.ticksAccumulated + 1;
  if (nextTicks >= stepEffective) {
    return {
      state: Object.freeze({ ticksAccumulated: 0 }),
      shouldFallRow: true,
    };
  }
  return {
    state: Object.freeze({ ticksAccumulated: nextTicks }),
    shouldFallRow: false,
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
}
