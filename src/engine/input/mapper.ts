import { MAX_ACTIONS_PER_TICK } from '@engine/core';
import { GameAction } from '@engine/types';
import type {
  GameAction as GameActionType,
  PhysicalKey,
} from '@engine/types';
import { isTranslationAction, shouldRepeatDas } from './das';
import { actionForKey, HOLD_KEY_CODE_RESERVED } from './keymap';
import type { InputState } from './state';
import { canonicalizeTickActions } from './tick-order';

export interface KeyInputEvent {
  readonly type: 'keydown' | 'keyup';
  readonly code: PhysicalKey;
  readonly ctrlKey?: boolean;
  readonly altKey?: boolean;
  readonly metaKey?: boolean;
}

export interface InputSample {
  readonly state: InputState;
  readonly actions: readonly GameActionType[];
}

/**
 * Pure 60 Hz input sample: apply key transitions, advance held-key counters,
 * and emit canonical actions for this tick.
 */
export function sampleInput(
  input: InputState,
  tickDelta: number,
  events: readonly KeyInputEvent[] = [],
): InputSample {
  if (!Number.isInteger(tickDelta) || tickDelta < 0) {
    throw new RangeError(`tickDelta must be a non-negative integer, got ${tickDelta}`);
  }
  const held = new Map(input.heldKeys.map(({ code, ticksHeld }) => [code, ticksHeld]));
  const newlyPressed = new Set<PhysicalKey>();
  const actions: GameActionType[] = [];

  for (const event of events) {
    const action = actionForKey(event.code);
    if (event.type === 'keyup') {
      held.delete(event.code);
      continue;
    }
    if (event.ctrlKey || event.altKey || event.metaKey) continue;
    if (event.code === HOLD_KEY_CODE_RESERVED || action === undefined) continue;
    if (held.has(event.code)) continue;
    held.set(event.code, 0);
    newlyPressed.add(event.code);
    if (action !== GameAction.SoftDrop) actions.push(action);
  }

  const nextHeld = [...held.entries()].map(([code, previousTicks]) => {
    const action = actionForKey(code);
    const isNew = newlyPressed.has(code);
    const ticksHeld = isNew ? 0 : previousTicks + tickDelta;
    if (action === GameAction.SoftDrop) actions.push(action);
    if (!isNew && action !== undefined && isTranslationAction(action)
      && shouldRepeatDas(ticksHeld)) {
      actions.push(action);
    }
    return Object.freeze({ code, ticksHeld });
  });

  const canonical = canonicalizeTickActions(actions);
  if (canonical.length > MAX_ACTIONS_PER_TICK) {
    throw new RangeError('input sample exceeds engine action cap');
  }
  return Object.freeze({
    state: Object.freeze({ heldKeys: Object.freeze(nextHeld) }),
    actions: canonical,
  });
}
