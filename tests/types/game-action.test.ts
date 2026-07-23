import { describe, expect, it } from 'vitest';
import { GameAction, VALID_GAMEACTION_VALUES } from '@engine/types';

describe('GameAction values', () => {
  it('stays synchronized with enum members', () => {
    const enumValues = [GameAction.MoveXNeg, GameAction.MoveXPos, GameAction.MoveYNeg, GameAction.MoveYPos,
      GameAction.RotateYawNeg, GameAction.RotateYawPos, GameAction.RotatePitchNeg, GameAction.RotatePitchPos,
      GameAction.RotateRollNeg, GameAction.RotateRollPos, GameAction.Flip, GameAction.SoftDrop,
      GameAction.HardDrop, GameAction.Hold, GameAction.Pause, GameAction.Restart];
    expect([...VALID_GAMEACTION_VALUES].sort()).toEqual(enumValues.sort());
    expect(new Set(VALID_GAMEACTION_VALUES).size).toBe(16);
  });
});
