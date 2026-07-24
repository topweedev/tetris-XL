import { MAX_ACTIONS_PER_TICK } from '@engine/core';
import { GameAction, isValidGameAction } from '@engine/types';
import type { GameAction as GameActionType } from '@engine/types';

const ROTATION_ACTIONS = new Set<number>([
  GameAction.RotateYawNeg,
  GameAction.RotateYawPos,
  GameAction.RotatePitchNeg,
  GameAction.RotatePitchPos,
  GameAction.RotateRollNeg,
  GameAction.RotateRollPos,
  GameAction.Flip,
]);

/** Validate, deduplicate, and canonically order actions for one engine tick. */
export function canonicalizeTickActions(
  actions: readonly GameActionType[],
): readonly GameActionType[] {
  if (actions.length > MAX_ACTIONS_PER_TICK) {
    throw new RangeError(`actions.length exceeds ${MAX_ACTIONS_PER_TICK}`);
  }
  const unique = new Set<GameActionType>();
  for (const action of actions) {
    if (typeof action !== 'number') throw new TypeError('GameAction must be a number');
    if (!isValidGameAction(action)) throw new RangeError(`invalid GameAction: ${action}`);
    unique.add(action);
  }
  return Object.freeze([...unique].sort(
    (left, right) => priority(left) - priority(right) || left - right,
  ));
}

function priority(action: GameActionType): number {
  if (action === GameAction.Pause) return 0;
  if (action === GameAction.Restart) return 1;
  if (ROTATION_ACTIONS.has(action)) return 2;
  if (action >= GameAction.MoveXNeg && action <= GameAction.MoveYPos) return 3;
  if (action === GameAction.SoftDrop) return 4;
  if (action === GameAction.HardDrop) return 5;
  return 6;
}
