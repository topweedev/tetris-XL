import { describe, expect, it } from 'vitest';
import { GameAction } from '@engine/types';
import { buildBootState, step } from '@engine/core';
import { createInputState, sampleInput } from '@engine/input';
import type { InputState, KeyInputEvent } from '@engine/input';

function tick(state: InputState, events: readonly KeyInputEvent[] = []) {
  return sampleInput(state, 1, events);
}

describe('sampleInput', () => {
  it('emits edge actions once until keyup resets them', () => {
    let sample = tick(createInputState(), [{ type: 'keydown', code: 'KeyE' }]);
    expect(sample.actions).toEqual([GameAction.RotateYawPos]);
    sample = tick(sample.state, [{ type: 'keydown', code: 'KeyE' }]);
    expect(sample.actions).toEqual([]);
    sample = tick(sample.state, [{ type: 'keyup', code: 'KeyE' }]);
    sample = tick(sample.state, [{ type: 'keydown', code: 'KeyE' }]);
    expect(sample.actions).toEqual([GameAction.RotateYawPos]);
  });

  it.each([
    ['KeyF', GameAction.Flip],
    ['Space', GameAction.HardDrop],
    ['Escape', GameAction.Pause],
    ['KeyP', GameAction.Pause],
    ['KeyR', GameAction.Restart],
  ] as const)('emits %s only on its keydown edge', (code, action) => {
    let sample = tick(createInputState(), [{ type: 'keydown', code }]);
    expect(sample.actions).toEqual([action]);
    sample = tick(sample.state, [{ type: 'keydown', code }]);
    expect(sample.actions).toEqual([]);
  });

  it('emits SoftDrop every tick while held', () => {
    let sample = tick(createInputState(), [{ type: 'keydown', code: 'ShiftLeft' }]);
    expect(sample.actions).toEqual([GameAction.SoftDrop]);
    sample = tick(sample.state);
    expect(sample.actions).toEqual([GameAction.SoftDrop]);
    sample = tick(sample.state, [{ type: 'keyup', code: 'ShiftLeft' }]);
    expect(sample.actions).toEqual([]);
  });

  it('emits translation immediately, then DAS at 15 + 3n ticks', () => {
    let sample = tick(createInputState(), [{ type: 'keydown', code: 'ArrowLeft' }]);
    expect(sample.actions).toEqual([GameAction.MoveXNeg]);
    for (let heldTick = 1; heldTick < 15; heldTick++) {
      sample = tick(sample.state);
      expect(sample.actions).toEqual([]);
    }
    sample = tick(sample.state);
    expect(sample.actions).toEqual([GameAction.MoveXNeg]);
    sample = tick(sample.state);
    expect(sample.actions).toEqual([]);
    sample = tick(sample.state);
    expect(sample.actions).toEqual([]);
    sample = tick(sample.state);
    expect(sample.actions).toEqual([GameAction.MoveXNeg]);
  });

  it('resets DAS on keyup during charge', () => {
    let sample = tick(createInputState(), [{ type: 'keydown', code: 'ArrowRight' }]);
    for (let count = 0; count < 5; count++) sample = tick(sample.state);
    sample = tick(sample.state, [{ type: 'keyup', code: 'ArrowRight' }]);
    expect(sample.state.heldKeys).toEqual([]);
    sample = tick(sample.state, [{ type: 'keydown', code: 'ArrowRight' }]);
    expect(sample.actions).toEqual([GameAction.MoveXPos]);
  });

  it('drops modified chords and the reserved Hold key', () => {
    const sample = tick(createInputState(), [
      { type: 'keydown', code: 'KeyQ', ctrlKey: true },
      { type: 'keydown', code: 'KeyE', altKey: true },
      { type: 'keydown', code: 'KeyW', metaKey: true },
      { type: 'keydown', code: 'KeyC' },
    ]);
    expect(sample.actions).toEqual([]);
    expect(sample.state.heldKeys).toEqual([]);
  });

  it('canonicalizes simultaneous key events for P2.3 step()', () => {
    const sample = tick(createInputState(), [
      { type: 'keydown', code: 'ArrowLeft' },
      { type: 'keydown', code: 'KeyE' },
    ]);
    expect(sample.actions).toEqual([
      GameAction.RotateYawPos,
      GameAction.MoveXNeg,
    ]);
    expect(() => step(buildBootState(42), sample.actions, 0)).not.toThrow();
  });

  it('validates tickDelta and advances DAS by the supplied delta', () => {
    let sample = sampleInput(
      createInputState(),
      1,
      [{ type: 'keydown', code: 'ArrowDown' }],
    );
    sample = sampleInput(sample.state, 15);
    expect(sample.actions).toEqual([GameAction.MoveYNeg]);
    expect(() => sampleInput(sample.state, -1)).toThrow(RangeError);
  });
});
