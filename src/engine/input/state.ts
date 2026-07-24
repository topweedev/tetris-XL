import type { PhysicalKey } from '@engine/types';

export interface HeldKey {
  readonly code: PhysicalKey;
  readonly ticksHeld: number;
}

export interface InputState {
  readonly heldKeys: readonly HeldKey[];
}

export const MAX_INPUT_EVENTS_PER_TICK = 64;
export const MAX_TICK_DELTA = 60 * 60 * 60;

export function createInputState(): InputState {
  return Object.freeze({ heldKeys: Object.freeze([]) });
}

export function assertValidInputState(state: InputState): asserts state is InputState {
  if (state === null || typeof state !== 'object') throw new TypeError('InputState must be an object');
  if (!Array.isArray(state.heldKeys)) throw new TypeError('InputState.heldKeys must be an array');
  const seen = new Set<string>();
  for (const held of state.heldKeys) {
    if (held === null || typeof held !== 'object') throw new TypeError('HeldKey must be an object');
    if (typeof held.code !== 'string' || held.code.length === 0 || held.code.length > 32) throw new RangeError('HeldKey.code must be a non-empty string of at most 32 chars');
    if (seen.has(held.code)) throw new RangeError('duplicate held key');
    seen.add(held.code);
    if (!Number.isInteger(held.ticksHeld) || held.ticksHeld < 0) throw new RangeError('HeldKey.ticksHeld must be a non-negative integer');
  }
}
