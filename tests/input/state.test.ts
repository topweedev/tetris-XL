import { describe, expect, it } from 'vitest';
import {
  MAX_INPUT_EVENTS_PER_TICK,
  MAX_TICK_DELTA,
  assertValidInputState,
  assertValidKeyInputEvent,
  createInputState,
  sampleInput,
} from '@engine/input';
import type { InputState, KeyInputEvent } from '@engine/input';

describe('input entry validation', () => {
  it('accepts valid state and event', () => {
    expect(() => assertValidInputState(createInputState())).not.toThrow();
    expect(() => assertValidKeyInputEvent({ type: 'keydown', code: 'KeyQ' })).not.toThrow();
    expect(() => assertValidKeyInputEvent({ type: 'keyup', code: 'KeyQ' })).not.toThrow();
  });

  it.each([
    ['state not object', null],
    ['heldKeys not array', { heldKeys: new Map() }],
    ['negative ticks', { heldKeys: [{ code: 'KeyQ', ticksHeld: -1 }] }],
    ['fractional ticks', { heldKeys: [{ code: 'KeyQ', ticksHeld: 1.5 }] }],
    ['empty code', { heldKeys: [{ code: '', ticksHeld: 0 }] }],
    ['non-string code', { heldKeys: [{ code: 42, ticksHeld: 0 }] }],
    ['long code', { heldKeys: [{ code: 'A'.repeat(33), ticksHeld: 0 }] }],
    ['duplicate code', { heldKeys: [{ code: 'KeyQ', ticksHeld: 0 }, { code: 'KeyQ', ticksHeld: 1 }] }],
  ])('rejects malformed state: %s', (_label, state) => {
    expect(() => assertValidInputState(state as unknown as InputState)).toThrow();
  });

  it.each([
    ['bad type', { type: 'click', code: 'KeyQ' }],
    ['missing type', { code: 'KeyQ' }],
    ['empty code', { type: 'keydown', code: '' }],
    ['non-string code', { type: 'keydown', code: 42 }],
    ['long code', { type: 'keydown', code: 'A'.repeat(33) }],
    ['bad modifier', { type: 'keydown', code: 'KeyQ', ctrlKey: 'true' }],
  ])('rejects malformed event: %s', (_label, event) => {
    expect(() => assertValidKeyInputEvent(event)).toThrow();
  });

  it('enforces tick delta and event-count caps', () => {
    const state = createInputState();
    expect(() => sampleInput(state, MAX_TICK_DELTA + 1)).toThrow(RangeError);
    expect(() => sampleInput(state, 1.5)).toThrow(RangeError);
    const events = Array.from({ length: MAX_INPUT_EVENTS_PER_TICK + 1 }, () => ({
      type: 'keyup' as const,
      code: 'KeyQ' as const,
    }));
    expect(() => sampleInput(state, 0, events)).toThrow(RangeError);
    const boundaryEvents = events.slice(0, MAX_INPUT_EVENTS_PER_TICK);
    expect(() => sampleInput(state, MAX_TICK_DELTA, boundaryEvents)).not.toThrow();
    expect(() => sampleInput(state, 0, [{ type: 'click', code: 'KeyQ' } as unknown as KeyInputEvent])).toThrow();
  });
});
