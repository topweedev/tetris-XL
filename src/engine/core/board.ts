import {
  BOARD_CELL_COUNT,
  BOARD_D,
  BOARD_H,
  BOARD_W,
  SENTINEL_CELL,
  idx,
} from '@engine/types';
import type { BoardArray } from '@engine/types';

/** Create a new empty board (all cells are zero). */
export function createBoard(): BoardArray {
  return new Uint8Array(BOARD_CELL_COUNT);
}

/** Return whether a coordinate is inside the 5×5×12 playfield. */
export function isInBounds(x: number, y: number, z: number): boolean {
  return x >= 0 && x < BOARD_W
    && y >= 0 && y < BOARD_H
    && z >= 0 && z < BOARD_D;
}

/** Read a cell. The caller must ensure the coordinate is in bounds. */
export function getCellAt(board: BoardArray, x: number, y: number, z: number): number {
  return board[idx(x, y, z)]!;
}

/** Write a cell. The caller must ensure the coordinate is in bounds. */
export function setCellAt(
  board: BoardArray,
  x: number,
  y: number,
  z: number,
  value: number,
): void {
  if (value === SENTINEL_CELL) {
    throw new Error(
      `cannot write SENTINEL_CELL (0x7F) to board at (${x},${y},${z})`,
    );
  }
  board[idx(x, y, z)] = value;
}

/** Clone a board into an independent backing buffer. */
export function cloneBoard(board: BoardArray): BoardArray {
  return new Uint8Array(board);
}
