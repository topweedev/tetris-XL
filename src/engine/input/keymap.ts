import { GameAction } from '@engine/types';
import type { GameAction as GameActionType, PhysicalKey } from '@engine/types';

export const HOLD_KEY_CODE_RESERVED = 'KeyC' as const;

export interface KeyBinding {
  readonly code: PhysicalKey;
  readonly action: GameActionType;
}

function binding(code: PhysicalKey, action: GameActionType): KeyBinding {
  return Object.freeze({ code, action });
}

/** Spike keymap from ADR-0004 rev.2 §2.4. */
export const KEYMAP: readonly KeyBinding[] = Object.freeze([
  binding('ArrowLeft', GameAction.MoveXNeg),
  binding('ArrowRight', GameAction.MoveXPos),
  binding('ArrowUp', GameAction.MoveYPos),
  binding('ArrowDown', GameAction.MoveYNeg),
  binding('KeyQ', GameAction.RotateYawNeg),
  binding('KeyE', GameAction.RotateYawPos),
  binding('KeyW', GameAction.RotatePitchNeg),
  binding('KeyS', GameAction.RotatePitchPos),
  binding('KeyF', GameAction.Flip),
  binding('Space', GameAction.HardDrop),
  binding('ShiftLeft', GameAction.SoftDrop),
  binding('Escape', GameAction.Pause),
  binding('KeyP', GameAction.Pause),
  binding('KeyR', GameAction.Restart),
]);

export const EXPECTED_KEYMAP_HASH = 'bb479de5';

export function actionForKey(
  code: PhysicalKey,
  keymap: readonly KeyBinding[] = KEYMAP,
): GameActionType | undefined {
  return keymap.find((entry) => entry.code === code)?.action;
}

/** Reject ambiguous physical-key bindings while allowing action aliases. */
export function assertKeymapNoDualBinding(keymap: readonly KeyBinding[] = KEYMAP): void {
  const seen = new Set<PhysicalKey>();
  for (const entry of keymap) {
    if (seen.has(entry.code)) throw new Error(`duplicate physical key binding: ${entry.code}`);
    seen.add(entry.code);
  }
}

export function assertHoldKeyReserved(keymap: readonly KeyBinding[] = KEYMAP): void {
  for (const entry of keymap) {
    if (entry.code === HOLD_KEY_CODE_RESERVED) throw new Error('KeyC is reserved for future Hold');
    if (entry.action === GameAction.Hold) throw new Error('GameAction.Hold must only bind to KeyC');
  }
}

/** Small deterministic FNV-1a mirror guarding accidental table drift. */
export function keymapHash(keymap: readonly KeyBinding[] = KEYMAP): string {
  const bytes = new TextEncoder().encode(
    keymap.map(({ code, action }) => `${code}:${action}`).join('|'),
  );
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

assertKeymapNoDualBinding();
assertHoldKeyReserved();
if (keymapHash() !== EXPECTED_KEYMAP_HASH) {
  throw new Error(`KEYMAP hash drift: expected ${EXPECTED_KEYMAP_HASH}, got ${keymapHash()}`);
}
