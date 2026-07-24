import { describe, expect, it } from 'vitest';
import { GameAction } from '@engine/types';
import { canonicalizeTickActions } from '@engine/input';

describe('canonicalizeTickActions', () => {
  it('sorts by ADR priority and enum tie-break', () => {
    expect(canonicalizeTickActions([
      GameAction.Hold,
      GameAction.HardDrop,
      GameAction.MoveYPos,
      GameAction.RotatePitchPos,
      GameAction.Restart,
      GameAction.Pause,
      GameAction.MoveXNeg,
      GameAction.RotateYawNeg,
      GameAction.SoftDrop,
    ])).toEqual([
      GameAction.Pause,
      GameAction.Restart,
      GameAction.RotateYawNeg,
      GameAction.RotatePitchPos,
      GameAction.MoveXNeg,
      GameAction.MoveYPos,
      GameAction.SoftDrop,
      GameAction.HardDrop,
      GameAction.Hold,
    ]);
  });

  it('deduplicates and rejects malformed actions', () => {
    expect(canonicalizeTickActions([
      GameAction.MoveXNeg,
      GameAction.MoveXNeg,
    ])).toEqual([GameAction.MoveXNeg]);
    expect(() => canonicalizeTickActions([99 as GameAction])).toThrow(RangeError);
    expect(() => canonicalizeTickActions(['0' as unknown as GameAction])).toThrow(TypeError);
  });
});
