import { describe, expect, it } from 'vitest';
import {
  SO24, applyRotation, determinant, matrixKey, multiplyMatrices,
} from '@engine/pieces';

describe('SO24', () => {
  it('contains 24 distinct proper signed-permutation matrices', () => {
    expect(SO24).toHaveLength(24);
    expect(new Set(SO24.map(matrixKey)).size).toBe(24);
    for (const matrix of SO24) {
      expect(determinant(matrix)).toBe(1);
      for (const row of matrix) {
        expect(row.every((entry) => entry === -1 || entry === 0 || entry === 1)).toBe(true);
        expect(row.filter(Boolean)).toHaveLength(1);
      }
      for (let column = 0; column < 3; column++) {
        expect(matrix.filter((row) => row[column] !== 0)).toHaveLength(1);
      }
    }
  });

  it('is closed under 100 deterministic matrix products', () => {
    const keys = new Set(SO24.map(matrixKey));
    for (let pair = 0; pair < 100; pair++) {
      const left = SO24[(pair * 7 + 3) % 24]!;
      const right = SO24[(pair * 11 + 5) % 24]!;
      expect(keys.has(matrixKey(multiplyMatrices(left, right)))).toBe(true);
    }
  });

  it('keeps integer coordinates under rotation', () => {
    for (const matrix of SO24) {
      expect(applyRotation(matrix, [2, -3, 4]).every(Number.isInteger)).toBe(true);
    }
  });
});
