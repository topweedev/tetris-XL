import {
  assertValidU32Seed,
  assertValidRngState,
  generateBag,
} from '@engine/rng';
import type { RngState } from '@engine/rng';
import {
  KICK_OFFSETS,
  ROTATION_ACTIONS,
  ROTATION_GRAPH,
  ROTATION_STATES,
} from '@engine/pieces';
import type { CellTuple, RotationAction } from '@engine/pieces';
import {
  BOARD_D,
  GameAction,
  SENTINEL_CELL,
  isValidGameAction,
  typeId,
} from '@engine/types';
import type {
  FsmState,
  GameAction as GameActionType,
  GameState,
  Piece,
  TypeId,
} from '@engine/types';
import { levelFromLayers } from '@engine/difficulty';
import {
  clearFullLayers,
  hasCollision,
  resetLockDelay,
  setCellAt,
  tickGravity,
  tickLockDelay,
} from '@engine/core';

const SPAWN_ANCHOR = [2, 2, 11] as const;
const TICK_MS = 1000 / 60;
const BASE_LINE_SCORE = Object.freeze([0, 100, 300, 700, 1500] as const);
const ROTATION_SET = new Set<number>(ROTATION_ACTIONS);
const TRANSLATION_DELTAS: Partial<Record<GameActionType, readonly [number, number, number]>> = {
  [GameAction.MoveXNeg]: [-1, 0, 0],
  [GameAction.MoveXPos]: [1, 0, 0],
  [GameAction.MoveYNeg]: [0, -1, 0],
  [GameAction.MoveYPos]: [0, 1, 0],
};

/** Advance the deterministic engine by one fixed simulation tick. */
export function step(
  input: GameState,
  actions: readonly GameActionType[],
  tick: number,
): GameState {
  assertValidTick(tick);
  const orderedActions = validateAndSortActions(actions);
  let state = cloneGameState(input);

  if (state.fsmState === 'GAME_OVER') return state;
  if (state.fsmState === 'BOOT') return withFsm(state, 'SPAWN');
  if (state.fsmState === 'CLEARING') return withFsm(state, 'SPAWN');
  if (state.fsmState === 'SPAWN') return spawnPiece(state);
  if (state.fsmState === 'LOCKED') return lockPiece(state);

  const piece = requirePiece(state);
  let nextPiece = piece;
  let nextFsm: FsmState = state.fsmState;
  let gravityAcc = state.gravityAcc;
  let lockDelayTimer = state.lockDelayTimer;
  let lockResets = state.lockResets;
  let score = state.score;

  const softDrop = orderedActions.includes(GameAction.SoftDrop);
  if (state.fsmState === 'FALLING') {
    const gravity = tickGravity({ ticksAccumulated: gravityAcc }, state.level, softDrop);
    gravityAcc = gravity.state.ticksAccumulated;
    if (gravity.shouldFallRow) {
      const lowered = movePiece(nextPiece, 0, 0, -1);
      if (pieceCollides(state, lowered)) {
        nextFsm = 'GROUNDED';
        lockDelayTimer = 0;
      } else {
        nextPiece = lowered;
        if (softDrop && state.level <= 13) score += 1;
      }
    }
  }

  for (const action of orderedActions) {
    if (action === GameAction.Restart) return withFsm(state, 'BOOT');
    if (action === GameAction.Pause || action === GameAction.SoftDrop || action === GameAction.Hold) {
      continue;
    }
    if (action === GameAction.HardDrop) {
      let rows = 0;
      while (true) {
        const lowered = movePiece(nextPiece, 0, 0, -1);
        if (pieceCollides(state, lowered)) break;
        nextPiece = lowered;
        rows++;
      }
      score += rows * 2;
      nextFsm = 'LOCKED';
      break;
    }

    const candidate = ROTATION_SET.has(action)
      ? rotatePiece(state, nextPiece, action as RotationAction)
      : translatePiece(state, nextPiece, action);
    if (candidate !== null) {
      const wasGrounded = nextFsm === 'GROUNDED';
      nextPiece = candidate;
      if (wasGrounded) {
        const reset = resetLockDelay({
          msElapsed: lockDelayTimer,
          resetsUsed: lockResets,
          locked: false,
        });
        lockDelayTimer = reset.msElapsed;
        lockResets = reset.resetsUsed;
        if (reset.locked) nextFsm = 'LOCKED';
      }
    }
  }

  if (nextFsm !== 'LOCKED') {
    const grounded = pieceCollides(state, movePiece(nextPiece, 0, 0, -1));
    nextFsm = grounded ? 'GROUNDED' : 'FALLING';
    if (nextFsm === 'GROUNDED') {
      const lock = tickLockDelay(
        { msElapsed: lockDelayTimer, resetsUsed: lockResets, locked: false },
        TICK_MS,
        state.level,
      );
      lockDelayTimer = lock.msElapsed;
      if (lock.locked) nextFsm = 'LOCKED';
    } else {
      lockDelayTimer = 0;
    }
  }

  state = {
    ...state,
    piece: nextPiece,
    fsmState: nextFsm,
    gravityAcc,
    softDropActive: softDrop,
    lockDelayTimer,
    lockResets,
    score,
  };
  return nextFsm === 'LOCKED' ? lockPiece(state) : state;
}

function spawnPiece(state: GameState): GameState {
  const selected = pieceTypeAt(state.seed, state.level, state.bag.index);
  const piece = buildPiece(selected.typeId);
  const nextState: GameState = {
    ...state,
    bag: { queue: selected.queue, index: state.bag.index + 1 },
    bagQueue: selected.queue.slice((state.bag.index % selected.queue.length) + 1),
    piece,
    gravityAcc: 0,
    softDropActive: false,
    lockDelayTimer: 0,
    lockResets: 0,
    holdUsedThisPiece: false,
    lastActionWasRotation: false,
    lastRotationUsedKick: false,
    fsmState: 'FALLING',
  };
  return pieceCollides(nextState, piece) ? { ...nextState, fsmState: 'GAME_OVER' } : nextState;
}

function pieceTypeAt(seed: number, level: number, consumed: number): {
  readonly typeId: TypeId;
  readonly queue: readonly TypeId[];
} {
  assertValidU32Seed(seed);
  if (!Number.isInteger(consumed) || consumed < 0) {
    throw new RangeError(`bag.index must be non-negative integer, got ${consumed}`);
  }
  let rng = BigInt(seed);
  assertValidRngState(rng);
  let queue: readonly TypeId[] = [];
  const targetBag = Math.floor(consumed / 7);
  for (let bagNumber = 0; bagNumber <= targetBag; bagNumber++) {
    const generated = generateBag(rng as RngState, level);
    rng = generated.state;
    queue = generated.bag;
  }
  const selected = queue[consumed % 7];
  /* c8 ignore next -- generateBag guarantees exactly seven entries. */
  if (selected === undefined) throw new Error('generated bag missing selected piece');
  return { typeId: selected, queue };
}

/** Build a mutable Piece without aliasing canonical rotation typed arrays. */
export function buildPiece(pieceType: TypeId): Piece {
  const rotation = ROTATION_STATES[Number(pieceType)]?.[0];
  if (rotation === undefined) throw new RangeError(`missing rotation state for typeId ${pieceType}`);
  return {
    typeId: typeId(Number(pieceType)),
    cellCount: rotation.cellCount,
    cells: Int8Array.from(rotation.cells),
    origin: Int8Array.from(rotation.origin),
    rotationStateId: rotation.stateId,
    anchor: Int8Array.from(SPAWN_ANCHOR),
  };
}

function lockPiece(state: GameState): GameState {
  const piece = requirePiece(state);
  const board = new Uint8Array(state.board);
  for (const [cx, cy, cz] of pieceCells(piece)) {
    const x = piece.anchor[0]! + cx;
    const y = piece.anchor[1]! + cy;
    const z = piece.anchor[2]! + cz;
    if (z >= BOARD_D) return { ...state, board, fsmState: 'GAME_OVER' };
    setCellAt(board, x, y, z, Number(piece.typeId) + 1);
  }
  const cleared = clearFullLayers(board);
  const totalLayersCleared = state.totalLayersCleared + cleared.layersClearedCount;
  const lineCount = Math.min(cleared.layersClearedCount, 4);
  return {
    ...state,
    board: cleared.newBoard,
    piece: null,
    totalLayersCleared,
    level: levelFromLayers(totalLayersCleared),
    score: state.score + BASE_LINE_SCORE[lineCount]! * state.level,
    fsmState: cleared.layersClearedCount > 0 ? 'CLEARING' : 'SPAWN',
  };
}

function rotatePiece(state: GameState, piece: Piece, action: RotationAction): Piece | null {
  const typeIndex = Number(piece.typeId);
  const destinationId = ROTATION_GRAPH[typeIndex]?.[Number(piece.rotationStateId)]?.[action];
  if (destinationId === undefined) throw new Error('missing rotation graph destination');
  const destination = ROTATION_STATES[typeIndex]?.[Number(destinationId)];
  /* c8 ignore next -- ROTATION_GRAPH is load-time validated against ROTATION_STATES. */
  if (destination === undefined) throw new Error('missing rotation state destination');

  for (const [dx, dy, dz] of KICK_OFFSETS) {
    const anchor = Int8Array.from([
      piece.anchor[0]! + piece.origin[0]! - destination.origin[0]! + dx,
      piece.anchor[1]! + piece.origin[1]! - destination.origin[1]! + dy,
      piece.anchor[2]! + piece.origin[2]! - destination.origin[2]! + dz,
    ]);
    const candidate: Piece = {
      typeId: piece.typeId,
      cellCount: destination.cellCount,
      cells: Int8Array.from(destination.cells),
      origin: Int8Array.from(destination.origin),
      rotationStateId: destination.stateId,
      anchor,
    };
    if (!pieceCollides(state, candidate)) return candidate;
  }
  return null;
}

function translatePiece(state: GameState, piece: Piece, action: GameActionType): Piece | null {
  const delta = TRANSLATION_DELTAS[action];
  /* c8 ignore next -- caller only routes the four validated translation actions here. */
  if (delta === undefined) return null;
  const candidate = movePiece(piece, delta[0], delta[1], delta[2]);
  return pieceCollides(state, candidate) ? null : candidate;
}

function movePiece(piece: Piece, dx: number, dy: number, dz: number): Piece {
  return {
    ...piece,
    cells: piece.cells.slice(),
    origin: piece.origin.slice(),
    anchor: Int8Array.from([
      piece.anchor[0]! + dx,
      piece.anchor[1]! + dy,
      piece.anchor[2]! + dz,
    ]),
  };
}

function pieceCollides(state: GameState, piece: Piece): boolean {
  return hasCollision(state.board, pieceCells(piece), [
    piece.anchor[0]!, piece.anchor[1]!, piece.anchor[2]!,
  ], piece.typeId);
}

function pieceCells(piece: Piece): readonly CellTuple[] {
  const cells: CellTuple[] = [];
  for (let index = 0; index < piece.cellCount; index++) {
    const offset = index * 3;
    const x = piece.cells[offset];
    const y = piece.cells[offset + 1];
    const z = piece.cells[offset + 2];
    if (x === undefined || y === undefined || z === undefined || x === SENTINEL_CELL) {
      throw new Error(`invalid packed piece cell at ${index}`);
    }
    cells.push([x, y, z]);
  }
  return cells;
}

function cloneGameState(state: GameState): GameState {
  return {
    ...state,
    board: new Uint8Array(state.board),
    bag: { queue: state.bag.queue.slice(), index: state.bag.index },
    bagQueue: state.bagQueue.slice(),
    piece: state.piece === null ? null : {
      ...state.piece,
      cells: state.piece.cells.slice(),
      origin: state.piece.origin.slice(),
      anchor: state.piece.anchor.slice(),
    },
  };
}

function requirePiece(state: GameState): Piece {
  if (state.piece === null) throw new Error(`${state.fsmState} requires an active piece`);
  return state.piece;
}

function withFsm(state: GameState, fsmState: FsmState): GameState {
  return { ...state, fsmState };
}

function validateAndSortActions(actions: readonly GameActionType[]): GameActionType[] {
  const validated = actions.map((action) => {
    if (!isValidGameAction(Number(action))) throw new RangeError(`invalid GameAction: ${action}`);
    return action;
  });
  return validated.sort((left, right) => actionPriority(left) - actionPriority(right));
}

function actionPriority(action: GameActionType): number {
  if (action === GameAction.Pause) return 0;
  if (action === GameAction.Restart) return 1;
  if (ROTATION_SET.has(action)) return 2;
  if (action >= GameAction.MoveXNeg && action <= GameAction.MoveYPos) return 3;
  if (action === GameAction.SoftDrop) return 4;
  if (action === GameAction.HardDrop) return 5;
  return 6;
}

function assertValidTick(tick: number): void {
  if (!Number.isInteger(tick) || tick < 0) {
    throw new RangeError(`tick must be non-negative integer, got ${tick}`);
  }
}
