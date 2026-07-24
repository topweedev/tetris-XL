import { actionPriority, MAX_ACTIONS_PER_TICK } from '@engine/core';
import { isValidGameAction } from '@engine/types';
import type { GameAction as GameActionType } from '@engine/types';


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
    (left, right) => actionPriority(left) - actionPriority(right) || left - right,
  ));
}
