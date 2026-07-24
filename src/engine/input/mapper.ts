import { MAX_ACTIONS_PER_TICK } from '@engine/core';
import { GameAction } from '@engine/types';
import type {
  GameAction as GameActionType,
  PhysicalKey,
} from '@engine/types';
import { isTranslationAction, shouldRepeatDas } from './das';
import { actionForKey, HOLD_KEY_CODE_RESERVED } from './keymap';
import { assertValidInputState, MAX_INPUT_EVENTS_PER_TICK, MAX_TICK_DELTA } from './state';
import type { InputState } from './state';
import { canonicalizeTickActions } from './tick-order';

export interface KeyInputEvent {
  readonly type: 'keydown' | 'keyup';
  readonly code: PhysicalKey;
  readonly ctrlKey?: boolean;
  readonly altKey?: boolean;
  readonly metaKey?: boolean;
  readonly shiftKey?: boolean;
}

export function assertValidKeyInputEvent(event: unknown): asserts event is KeyInputEvent {
  if (event === null || typeof event !== 'object') throw new TypeError('KeyInputEvent must be an object');
  const candidate = event as Partial<KeyInputEvent>;
  if (candidate.type !== 'keydown' && candidate.type !== 'keyup') throw new RangeError('invalid KeyInputEvent.type');
  if (typeof candidate.code !== 'string' || candidate.code.length === 0 || candidate.code.length > 32) throw new RangeError('invalid KeyInputEvent.code');
  for (const modifier of ['ctrlKey', 'altKey', 'metaKey', 'shiftKey'] as const) {
    const value = candidate[modifier];
    if (value !== undefined && typeof value !== 'boolean') throw new TypeError('invalid KeyInputEvent modifier');
  }
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
  assertValidInputState(input);
  if (!Number.isInteger(tickDelta) || tickDelta < 0 || tickDelta > MAX_TICK_DELTA) throw new RangeError(`tickDelta out of range`);
  if (events.length > MAX_INPUT_EVENTS_PER_TICK) throw new RangeError(`too many input events`);
  for (const event of events) assertValidKeyInputEvent(event);
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
