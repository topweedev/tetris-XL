import { describe, expect, it } from 'vitest';
import {
  WEIGHT_TABLE,
  WEIGHT_BUCKET_COUNT,
  TYPE_BUCKET_SIZES,
  assertValidWeightTable,
  weightsForLevel,
} from '@engine/rng';

describe('bag weight table', () => {
  it('matches the four ADR-0003 level buckets', () => {
    expect(WEIGHT_TABLE).toEqual([
      [5, 15, 30, 50],
      [3, 12, 30, 55],
      [2, 10, 28, 60],
      [1, 8, 26, 65],
    ]);
    expect(WEIGHT_TABLE).toHaveLength(WEIGHT_BUCKET_COUNT);
    expect(TYPE_BUCKET_SIZES).toEqual([1, 1, 2, 8]);
  });

  it('keeps every weight positive and every row normalized', () => {
    for (const row of WEIGHT_TABLE) {
      expect(row.every((weight) => weight >= 1)).toBe(true);
      expect(row.reduce((sum, weight) => sum + weight, 0)).toBe(100);
    }
  });

  it('moves weight monotonically from small to four-cell pieces', () => {
    for (let index = 1; index < WEIGHT_TABLE.length; index++) {
      const previous = WEIGHT_TABLE[index - 1];
      const current = WEIGHT_TABLE[index];
      expect(current?.[0]).toBeLessThanOrEqual(previous?.[0] ?? 0);
      expect(current?.[1]).toBeLessThanOrEqual(previous?.[1] ?? 0);
      expect(current?.[3]).toBeGreaterThanOrEqual(previous?.[3] ?? 0);
    }
  });

  it('fails closed for malformed tables', () => {
    expect(() => assertValidWeightTable([
      [0, 15, 30, 55],
      [3, 12, 30, 55],
      [2, 10, 28, 60],
      [1, 8, 26, 65],
    ])).toThrow();
    expect(() => assertValidWeightTable([[5, 15, 30]])).toThrow();
    expect(() => assertValidWeightTable(Array.from({ length: 4 }, () => [5, 15, 30, 49]))).toThrow();
  });

  it('selects different snapshots across the level 5 boundary', () => {
    expect(weightsForLevel(4)).toBe(WEIGHT_TABLE[0]);
    expect(weightsForLevel(5)).toBe(WEIGHT_TABLE[1]);
  });
});
