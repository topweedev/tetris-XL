// per ADR-0004 rev.2 §2.2
export const enum GameAction {
  MoveXNeg = 0, MoveXPos = 1, MoveYNeg = 2, MoveYPos = 3,
  RotateYawNeg = 10, RotateYawPos = 11, RotatePitchNeg = 12, RotatePitchPos = 13,
  RotateRollNeg = 14, RotateRollPos = 15, Flip = 20,
  SoftDrop = 30, HardDrop = 31, Hold = 40, Pause = 41, Restart = 42,
}

export const VALID_GAMEACTION_VALUES = Object.freeze([
  0, 1, 2, 3, 10, 11, 12, 13, 14, 15, 20, 30, 31, 40, 41, 42,
] as const);
/** KeyboardEvent.code alias; P3.1 will narrow this to the validated keymap. */
export type PhysicalKey = string;

export function assertValidGameActionValues(): void {
  const values = [0, 1, 2, 3, 10, 11, 12, 13, 14, 15, 20, 30, 31, 40, 41, 42];
  if (values.length !== VALID_GAMEACTION_VALUES.length || values.some((v, i) => v !== VALID_GAMEACTION_VALUES[i])) {
    throw new Error('GameAction values are out of sync');
  }
}
