import { BOARD_CELL_COUNT, BOARD_D, BOARD_H, BOARD_W } from '@engine/types';
import type { BoardArray } from '@engine/types';

const LAYER_SIZE = BOARD_W * BOARD_H;

export interface ClearResult {
  readonly board: BoardArray;
  readonly clearedLayerIndices: readonly number[];
  readonly layersClearedCount: number;
}

/** Clone a board, remove every full z-layer, and compact higher layers downward. */
export function clearFullLayers(board: BoardArray): ClearResult {
  if (board.length !== BOARD_CELL_COUNT) {
    throw new RangeError(`board length must be ${BOARD_CELL_COUNT}, got ${board.length}`);
  }
  const newBoard = new Uint8Array(board);
  const fullLayers: number[] = [];
  for (let z = 0; z < BOARD_D; z++) {
    const start = z * LAYER_SIZE;
    let full = true;
    for (let offset = 0; offset < LAYER_SIZE; offset++) {
      if (newBoard[start + offset] === 0) {
        full = false;
        break;
      }
    }
    if (full) fullLayers.push(z);
  }

  for (const [clearedBelow, z] of fullLayers.entries()) {
    const start = (z - clearedBelow) * LAYER_SIZE;
    newBoard.copyWithin(start, start + LAYER_SIZE, BOARD_CELL_COUNT);
    newBoard.fill(0, BOARD_CELL_COUNT - LAYER_SIZE);
  }

  return {
    board: newBoard,
    clearedLayerIndices: Object.freeze(fullLayers),
    layersClearedCount: fullLayers.length,
  };
}
