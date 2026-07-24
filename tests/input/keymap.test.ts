import { describe, expect, it } from 'vitest';
import { GameAction } from '@engine/types';
import {
  EXPECTED_KEYMAP_HASH,
  HOLD_KEY_CODE_RESERVED,
  KEYMAP,
  actionForKey,
  assertHoldKeyReserved,
  assertKeymapNoDualBinding,
  keymapHash,
} from '@engine/input';

describe('input keymap', () => {
  it('matches all 14 ADR-0004 §2.4 bindings', () => {
    expect(KEYMAP).toEqual([
      { code: 'ArrowLeft', action: GameAction.MoveXNeg },
      { code: 'ArrowRight', action: GameAction.MoveXPos },
      { code: 'ArrowUp', action: GameAction.MoveYPos },
      { code: 'ArrowDown', action: GameAction.MoveYNeg },
      { code: 'KeyQ', action: GameAction.RotateYawNeg },
      { code: 'KeyE', action: GameAction.RotateYawPos },
      { code: 'KeyW', action: GameAction.RotatePitchNeg },
      { code: 'KeyS', action: GameAction.RotatePitchPos },
      { code: 'KeyF', action: GameAction.Flip },
      { code: 'Space', action: GameAction.HardDrop },
      { code: 'ShiftLeft', action: GameAction.SoftDrop },
      { code: 'Escape', action: GameAction.Pause },
      { code: 'KeyP', action: GameAction.Pause },
      { code: 'KeyR', action: GameAction.Restart },
    ]);
    expect(actionForKey('Escape')).toBe(GameAction.Pause);
    expect(actionForKey('KeyP')).toBe(GameAction.Pause);
    expect(new Set(KEYMAP.map(({ action }) => action))).toHaveLength(13);
  });

  it('is deeply frozen and matches the expected mirror hash', () => {
    expect(Object.isFrozen(KEYMAP)).toBe(true);
    expect(KEYMAP.every(Object.isFrozen)).toBe(true);
    expect(keymapHash()).toBe(EXPECTED_KEYMAP_HASH);
  });

  it('rejects dual physical bindings and reserved Hold collisions', () => {
    const duplicate = [...KEYMAP, { code: 'ArrowLeft', action: GameAction.Flip }];
    expect(() => assertKeymapNoDualBinding(duplicate)).toThrow(/duplicate/);
    const holdCollision = [...KEYMAP, {
      code: HOLD_KEY_CODE_RESERVED,
      action: GameAction.Hold,
    }];
    expect(() => assertHoldKeyReserved(holdCollision)).toThrow(/reserved/);
    expect(actionForKey(HOLD_KEY_CODE_RESERVED)).toBeUndefined();
  });
});
