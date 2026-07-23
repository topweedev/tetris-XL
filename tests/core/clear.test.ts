import { describe, expect, it } from 'vitest';
import { clearFullLayers, createBoard, setCellAt } from '@engine/core';
import { BOARD_H, BOARD_W, idx } from '@engine/types';

function fillLayer(board: Uint8Array, z: number, value = 1): void {
  for (let y = 0; y < BOARD_H; y++) {
    for (let x = 0; x < BOARD_W; x++) setCellAt(board, x, y, z, value);
  }
}

describe('clearFullLayers', () => {
  it('returns an independent unchanged board when no layer is full', () => {
    const board = createBoard();
    setCellAt(board, 1, 1, 1, 3);
    const result = clearFullLayers(board);
    expect(result.layersClearedCount).toBe(0);
    expect(result.clearedLayerIndices).toEqual([]);
    expect(result.board).not.toBe(board);
    expect(result.board).toEqual(board);
  });

  it('clears one layer and shifts higher layers down', () => {
    const board = createBoard();
    fillLayer(board, 0);
    setCellAt(board, 2, 3, 1, 7);
    const result = clearFullLayers(board);
    expect(result.layersClearedCount).toBe(1);
    expect(result.clearedLayerIndices).toEqual([0]);
    expect(result.board[idx(2, 3, 0)]).toBe(7);
    expect(result.board.slice(275).every((value) => value === 0)).toBe(true);
    expect(board[idx(0, 0, 0)]).toBe(1);
  });

  it('clears multiple non-adjacent layers with stable compaction', () => {
    const board = createBoard();
    fillLayer(board, 1);
    fillLayer(board, 3);
    setCellAt(board, 0, 0, 2, 8);
    setCellAt(board, 1, 1, 4, 9);
    const result = clearFullLayers(board);
    expect(result.layersClearedCount).toBe(2);
    expect(result.clearedLayerIndices).toEqual([1, 3]);
    expect(result.board[idx(0, 0, 1)]).toBe(8);
    expect(result.board[idx(1, 1, 2)]).toBe(9);
  });

  it.each([3, 4])('clears %i adjacent layers', (count) => {
    const board = createBoard();
    for (let z = 0; z < count; z++) fillLayer(board, z);
    setCellAt(board, 4, 4, count, 6);
    const result = clearFullLayers(board);
    expect(result.layersClearedCount).toBe(count);
    expect(result.clearedLayerIndices).toEqual(
      Array.from({ length: count }, (_value, index) => index),
    );
    expect(result.board[idx(4, 4, 0)]).toBe(6);
  });

  it('rejects malformed board length', () => {
    expect(() => clearFullLayers(new Uint8Array(299))).toThrow(RangeError);
  });
});
