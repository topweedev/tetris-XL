import type { PhysicalKey } from '@engine/types';

export interface HeldKey {
  readonly code: PhysicalKey;
  readonly ticksHeld: number;
}

export interface InputState {
  readonly heldKeys: readonly HeldKey[];
}

export function createInputState(): InputState {
  return Object.freeze({ heldKeys: Object.freeze([]) });
}
