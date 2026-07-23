import { describe, expect, it } from 'vitest';
import { SENTINEL_CELL, idx } from '@engine/types';
import {
  cloneBoard,
  createBoard,
  getCellAt,
  isInBounds,
  setCellAt,
} from '@engine/core';

describe('board primitives', () => {
  it('creates an empty 5x5x12 board', () => {
    const board = createBoard();
    expect(board).toBeInstanceOf(Uint8Array);
    expect(board).toHaveLength(300);
    expect(Array.from(board).every((value) => value === 0)).toBe(true);
  });

  it('uses x + y*5 + z*25 indexing', () => {
    expect(idx(0, 0, 0)).toBe(0);
    expect(idx(4, 4, 11)).toBe(299);
    expect(idx(2, 3, 7)).toBe(192);
  });

  it('gets and sets cells at boundary coordinates', () => {
    const board = createBoard();
    setCellAt(board, 0, 0, 0, 1);
    setCellAt(board, 4, 4, 11, 12);
    expect(getCellAt(board, 0, 0, 0)).toBe(1);
    expect(getCellAt(board, 4, 4, 11)).toBe(12);
  });

  it('rejects SENTINEL_CELL writes', () => {
    const board = createBoard();
    expect(() => setCellAt(board, 2, 2, 2, SENTINEL_CELL)).toThrow(
      /cannot write SENTINEL_CELL/,
    );
    expect(getCellAt(board, 2, 2, 2)).toBe(0);
  });

  it('accepts board values from zero through 126', () => {
    const board = createBoard();
    expect(() => setCellAt(board, 0, 0, 0, 0)).not.toThrow();
    expect(() => setCellAt(board, 4, 4, 11, 126)).not.toThrow();
    expect(getCellAt(board, 0, 0, 0)).toBe(0);
    expect(getCellAt(board, 4, 4, 11)).toBe(126);
  });

  it('clones into an independent buffer', () => {
    const board = createBoard();
    setCellAt(board, 1, 1, 1, 3);
    const clone = cloneBoard(board);
    setCellAt(board, 1, 1, 1, 4);
    expect(clone).not.toBe(board);
    expect(getCellAt(clone, 1, 1, 1)).toBe(3);
  });

  it.each([
    [0, 0, 0, true],
    [4, 4, 11, true],
    [-1, 0, 0, false],
    [5, 0, 0, false],
    [0, -1, 0, false],
    [0, 5, 0, false],
    [0, 0, -1, false],
    [0, 0, 12, false],
  ] as const)('checks bounds for (%i,%i,%i)', (x, y, z, expected) => {
    expect(isInBounds(x, y, z)).toBe(expected);
  });
});
