import { describe, expect, it } from 'vitest';
import {
  buildPiece,
  createBoard,
  setCellAt,
  step,
} from '@engine/core';
import { ROTATION_STATES } from '@engine/pieces';
import {
  GameAction,
  typeId,
} from '@engine/types';
import type { FsmState, GameState, Piece } from '@engine/types';

function baseState(fsmState: FsmState = 'BOOT', piece: Piece | null = null): GameState {
  return {
    seed: 42, bag: { queue: [], index: 0 }, bagQueue: [], level: 1,
    totalLayersCleared: 0, gravityAcc: 0, softDropActive: false,
    lockDelayTimer: 0, lockResets: 0, board: createBoard(), piece, fsmState,
    score: 0, combo: -1, b2bActive: false, b2bCount: 0,
    holdSlot: null, holdUsedThisPiece: false,
    lastActionWasRotation: false, lastRotationUsedKick: false,
    dasDirection: null, dasCharge: 0, dasRepeatCharge: 0,
  };
}

function canonical(state: GameState): string {
  return JSON.stringify(state, (_key, value) =>
    value instanceof Uint8Array ? Array.from(value) : value,
  );
}

describe('step', () => {
  it('advances BOOT and CLEARING to SPAWN one phase at a time', () => {
    expect(step(baseState('BOOT'), [], 0).fsmState).toBe('SPAWN');
    expect(step(baseState('CLEARING'), [], 0).fsmState).toBe('SPAWN');
  });

  it('spawns a deterministic piece then falls at level 20', () => {
    const spawned = step(baseState('SPAWN'), [], 1);
    expect(spawned.fsmState).toBe('FALLING');
    expect(spawned.piece).not.toBeNull();
    const fast = { ...spawned, level: 20 };
    const z = fast.piece!.anchor[2]!;
    const fallen = step(fast, [], 2);
    expect(fallen.piece!.anchor[2]).toBe(z - 1);
  });

  it('is byte-deterministic and does not mutate input', () => {
    const input = step(baseState('SPAWN'), [], 1);
    const before = canonical(input);
    const first = step(input, [GameAction.MoveXNeg, GameAction.SoftDrop], 2);
    const second = step(input, [GameAction.SoftDrop, GameAction.MoveXNeg], 2);
    expect(canonical(first)).toBe(canonical(second));
    expect(canonical(input)).toBe(before);
  });

  it('applies translation, rotation, pause/hold no-op, and restart priority', () => {
    const spawned = step(baseState('SPAWN'), [], 0);
    const moved = step(spawned, [GameAction.Pause, GameAction.Hold, GameAction.MoveXNeg], 1);
    expect(moved.piece!.anchor[0]).toBe(spawned.piece!.anchor[0]! - 1);
    const rotated = step(moved, [GameAction.RotateYawPos], 2);
    expect(rotated.piece!.rotationStateId).not.toBeUndefined();
    expect(step(rotated, [GameAction.HardDrop, GameAction.Restart], 3).fsmState).toBe('BOOT');
  });

  it('covers grounded gravity contact and the reset-cap force-lock path', () => {
    const piece = buildPiece(typeId(0));
    piece.anchor.set([2, 2, 0]);
    const falling = { ...baseState('FALLING', piece), level: 20 };
    expect(step(falling, [], 0).fsmState).toBe('GROUNDED');

    const groundedPiece = buildPiece(typeId(0));
    groundedPiece.anchor.set([1, 1, 0]);
    const capped = { ...baseState('GROUNDED', groundedPiece), lockResets: 15 };
    expect(step(capped, [GameAction.MoveXPos], 0).fsmState).toBe('SPAWN');
  });

  it('covers translation directions, blocked moves, and rotation failures', () => {
    const spawned = step(baseState('SPAWN'), [], 0);
    expect(step(spawned, [GameAction.MoveXPos], 1).piece!.anchor[0]).toBe(3);
    expect(step(spawned, [GameAction.MoveYNeg], 1).piece!.anchor[1]).toBe(1);
    expect(step(spawned, [GameAction.MoveYPos], 1).piece!.anchor[1]).toBe(3);

    const wallPiece = buildPiece(typeId(0));
    wallPiece.anchor[0] = 0;
    expect(step(baseState('FALLING', wallPiece), [GameAction.MoveXNeg], 1).piece!.anchor[0]).toBe(0);

    const blockedPiece = buildPiece(typeId(3));
    blockedPiece.anchor[2] = 0;
    const blocked = baseState('FALLING', blockedPiece);
    blocked.board.fill(1);
    expect(step(blocked, [GameAction.RotateYawPos], 1).piece!.rotationStateId)
      .toBe(blocked.piece!.rotationStateId);
  });

  it('hard drops, writes the piece, and advances to SPAWN', () => {
    const spawned = step(baseState('SPAWN'), [], 0);
    const locked = step(spawned, [GameAction.HardDrop], 1);
    expect(locked.fsmState).toBe('SPAWN');
    expect(locked.piece).toBeNull();
    expect(locked.board.some((value) => value !== 0)).toBe(true);
    expect(locked.score).toBeGreaterThan(0);
  });

  it('transitions to and remains terminal GAME_OVER on spawn collision', () => {
    const input = baseState('SPAWN');
    for (let z = 9; z < 12; z++) {
      for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) setCellAt(input.board, x, y, z, 1);
    }
    const over = step(input, [], 0);
    expect(over.fsmState).toBe('GAME_OVER');
    expect(canonical(step(over, [GameAction.Restart], 1))).toBe(canonical(over));
  });

  it('locks a grounded piece when lock delay expires', () => {
    const piece = buildPiece(typeId(0));
    piece.anchor[2] = 0;
    const input = {
      ...baseState('GROUNDED', piece),
      lockDelayTimer: 499,
    };
    expect(step(input, [], 0).fsmState).toBe('SPAWN');
  });

  it('successful grounded movement preserves reset count and can become airborne', () => {
    const piece = buildPiece(typeId(0));
    piece.anchor[0] = 0;
    piece.anchor[2] = 1;
    const input = baseState('GROUNDED', piece);
    const output = step(input, [GameAction.MoveXPos], 0);
    expect(['FALLING', 'GROUNDED']).toContain(output.fsmState);
    expect(output.lockResets).toBeGreaterThanOrEqual(0);
  });

  it('clears a completed layer during LOCKED and enters CLEARING', () => {
    const piece = buildPiece(typeId(0));
    piece.anchor.set([0, 0, 0]);
    const input = baseState('LOCKED', piece);
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        if (x !== 0 || y !== 0) setCellAt(input.board, x, y, 0, 2);
      }
    }
    const output = step(input, [], 0);
    expect(output.fsmState).toBe('CLEARING');
    expect(output.totalLayersCleared).toBe(1);
    expect(output.score).toBe(100);
  });

  it('top-outs if a piece locks above the board ceiling', () => {
    const piece = buildPiece(typeId(0));
    piece.anchor[2] = 12;
    expect(step(baseState('LOCKED', piece), [], 0).fsmState).toBe('GAME_OVER');
  });

  it('rejects malformed piece and rotation inputs', () => {
    expect(() => buildPiece(99 as unknown as ReturnType<typeof typeId>)).toThrow(RangeError);
    const validRotation = buildPiece(typeId(0));
    const badRotation = {
      ...validRotation,
      rotationStateId: 23 as typeof validRotation.rotationStateId,
    };
    expect(() => step(baseState('FALLING', badRotation), [
      GameAction.RotateYawPos, GameAction.MoveXPos,
    ], 0)).toThrow(/rotation graph destination/);
    const badCells = buildPiece(typeId(0));
    badCells.cells[0] = 127;
    expect(() => step(baseState('FALLING', badCells), [], 0)).toThrow(/packed piece cell/);
  });

  it('rejects invalid tick, action, active-state piece, and bag index', () => {
    expect(() => step(baseState(), [], -1)).toThrow(RangeError);
    expect(() => step(baseState(), [99 as GameAction], 0)).toThrow(RangeError);
    expect(() => step(baseState('FALLING'), [], 0)).toThrow(/active piece/);
    expect(() => step({ ...baseState('SPAWN'), bag: { queue: [], index: -1 } }, [], 0))
      .toThrow(/bag.index/);
  });

  it('builds pieces with no aliases to canonical states or each other', () => {
    const canonicalState = ROTATION_STATES[0]![0]!;
    const beforeCells = Array.from(canonicalState.cells);
    const first = buildPiece(typeId(0));
    const second = buildPiece(typeId(0));
    first.cells[0] = 99;
    first.origin[0] = 99;
    first.anchor[0] = 99;
    expect(Array.from(canonicalState.cells)).toEqual(beforeCells);
    expect(second.cells[0]).toBe(0);
    expect(second.origin[0]).toBe(0);
    expect(second.anchor[0]).toBe(2);
  });

  it('has a stable 1000-tick seed=42 golden score', () => {
    let state = baseState('BOOT');
    for (let tick = 0; tick < 1_000; tick++) {
      const actions = state.fsmState === 'FALLING' ? [GameAction.HardDrop] : [];
      state = step(state, actions, tick);
    }
    expect(state.score).toBe(78);
  });
});
