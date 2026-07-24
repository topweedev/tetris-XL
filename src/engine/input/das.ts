import {
  GameAction,
} from '@engine/types';
import type { GameAction as GameActionType } from '@engine/types';

export const DAS_INITIAL_DELAY_MS = 250 as const;
export const DAS_REPEAT_RATE_MS = 50 as const;
export const INPUT_TICK_MS = 1000 / 60;
export const DAS_INITIAL_DELAY_TICKS = 15 as const;
export const DAS_REPEAT_RATE_TICKS = 3 as const;

const TRANSLATION_ACTIONS = new Set<GameActionType>([
  GameAction.MoveXNeg,
  GameAction.MoveXPos,
  GameAction.MoveYNeg,
  GameAction.MoveYPos,
]);

export function isTranslationAction(action: GameActionType): boolean {
  return TRANSLATION_ACTIONS.has(action);
}

/** True on the first DAS repeat tick and every repeat interval thereafter. */
export function shouldRepeatDas(ticksHeld: number): boolean {
  if (!Number.isInteger(ticksHeld) || ticksHeld < 0) {
    throw new RangeError(`ticksHeld must be a non-negative integer, got ${ticksHeld}`);
  }
  return ticksHeld >= DAS_INITIAL_DELAY_TICKS
    && (ticksHeld - DAS_INITIAL_DELAY_TICKS) % DAS_REPEAT_RATE_TICKS === 0;
}

if (Math.round(DAS_INITIAL_DELAY_MS / INPUT_TICK_MS) !== DAS_INITIAL_DELAY_TICKS) {
  throw new Error('DAS initial delay tick quantization drift');
}
if (Math.round(DAS_REPEAT_RATE_MS / INPUT_TICK_MS) !== DAS_REPEAT_RATE_TICKS) {
  throw new Error('DAS repeat tick quantization drift');
}
