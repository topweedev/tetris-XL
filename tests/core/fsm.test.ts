import { describe, expect, it } from 'vitest';
import { advanceFsm, canTransition, createBoard } from '@engine/core';
import type { FsmState, GameState } from '@engine/types';

function state(fsmState: FsmState): GameState {
  return {
    seed: 0, bag: { queue: [], index: 0 }, bagQueue: [], level: 1,
    totalLayersCleared: 0, gravityAcc: 0, softDropActive: false,
    lockDelayTimer: 0, lockResets: 0, board: createBoard(), piece: null, fsmState,
    score: 0, combo: -1, b2bActive: false, b2bCount: 0,
    holdSlot: null, holdUsedThisPiece: false,
    lastActionWasRotation: false, lastRotationUsedKick: false,
    dasDirection: null, dasCharge: 0, dasRepeatCharge: 0,
  };
}

const ALLOWED = [
  ['BOOT', 'SPAWN'],
  ['SPAWN', 'FALLING'], ['SPAWN', 'GAME_OVER'],
  ['FALLING', 'FALLING'], ['FALLING', 'GROUNDED'],
  ['GROUNDED', 'FALLING'], ['GROUNDED', 'GROUNDED'], ['GROUNDED', 'LOCKED'],
  ['LOCKED', 'CLEARING'], ['LOCKED', 'SPAWN'], ['LOCKED', 'GAME_OVER'],
  ['CLEARING', 'SPAWN'], ['GAME_OVER', 'GAME_OVER'],
] as const satisfies readonly (readonly [FsmState, FsmState])[];

describe('FSM transitions', () => {
  it.each(ALLOWED)('allows %s -> %s', (from, to) => {
    const input = state(from);
    const output = advanceFsm(input, to);
    expect(output.fsmState).toBe(to);
    expect(output).not.toBe(input);
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ['BOOT', 'GAME_OVER'], ['SPAWN', 'LOCKED'], ['FALLING', 'SPAWN'],
    ['GROUNDED', 'SPAWN'], ['LOCKED', 'FALLING'], ['CLEARING', 'GAME_OVER'],
    ['GAME_OVER', 'BOOT'],
  ] as const satisfies readonly (readonly [FsmState, FsmState])[])('rejects %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => advanceFsm(state(from), to)).toThrow(/invalid FSM transition/);
  });
});
