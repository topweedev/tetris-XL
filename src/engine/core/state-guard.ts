import { BOARD_CELL_COUNT } from '@engine/types';
import type { FsmState, GameState, Piece } from '@engine/types';

/** Cap bag reconstruction work at roughly 142,858 generated bags. */
export const MAX_BAG_INDEX = 1_000_000;

const VALID_FSM_STATES = new Set<FsmState>([
  'BOOT', 'SPAWN', 'FALLING', 'GROUNDED', 'LOCKED', 'CLEARING', 'GAME_OVER',
]);

/** Fail closed on malformed replay/game state at the deterministic step boundary. */
export function assertValidGameState(state: GameState): asserts state is GameState {
  if (typeof state !== 'object' || state === null) {
    throw new TypeError('state must be a GameState object');
  }
  if (!(state.board instanceof Uint8Array)) throw new TypeError('board must be Uint8Array');
  if (state.board.length !== BOARD_CELL_COUNT) {
    throw new RangeError(`board.length must be ${BOARD_CELL_COUNT}, got ${state.board.length}`);
  }

  if (state.piece !== null) assertValidPiece(state.piece);
  assertIntegerInRange('level', state.level, 1, 20);

  if (typeof state.bag !== 'object' || state.bag === null) {
    throw new TypeError('bag must be an object');
  }
  assertIntegerInRange('bag.index', state.bag.index, 0, MAX_BAG_INDEX);
  assertIntegerInRange('seed', state.seed, 0, 0xffff_ffff);
  assertNonNegativeInteger('score', state.score);
  assertNonNegativeInteger('totalLayersCleared', state.totalLayersCleared);

  if (!VALID_FSM_STATES.has(state.fsmState)) {
    throw new RangeError(`invalid fsmState: ${String(state.fsmState)}`);
  }
}

function assertValidPiece(piece: Piece): void {
  assertIntegerInRange('piece.cellCount', piece.cellCount, 1, 4);
  if (!(piece.cells instanceof Int8Array) || piece.cells.length !== 12) {
    throw new TypeError('piece.cells must be Int8Array(12)');
  }
  if (!(piece.origin instanceof Int8Array) || piece.origin.length !== 3) {
    throw new TypeError('piece.origin must be Int8Array(3)');
  }
  if (!(piece.anchor instanceof Int8Array) || piece.anchor.length !== 3) {
    throw new TypeError('piece.anchor must be Int8Array(3)');
  }
  assertIntegerInRange('piece.typeId', Number(piece.typeId), 0, 11);
  assertIntegerInRange('piece.rotationStateId', Number(piece.rotationStateId), 0, 23);
  for (const coordinate of piece.anchor) {
    if (!Number.isInteger(coordinate)) {
      throw new TypeError('piece.anchor must contain integers');
    }
  }
}

function assertNonNegativeInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name}: expected non-negative integer, got ${value}`);
  }
}

function assertIntegerInRange(name: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name}: expected integer in [${min}, ${max}], got ${value}`);
  }
}
