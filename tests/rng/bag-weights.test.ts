import { describe, expect, it } from 'vitest';
import {
  BAG_WEIGHTS,
  MAX_LEVEL,
  POLYCUBE_BUCKETS,
  assertValidBagConfiguration,
} from '@engine/rng';
import { typeId } from '@engine/types';

describe('bag configuration', () => {
  it('matches all 20 ADR-0003 level rows', () => {
    expect(BAG_WEIGHTS).toHaveLength(MAX_LEVEL);
    expect(BAG_WEIGHTS.slice(0, 5)).toEqual(Array.from({ length: 5 }, () => [5, 15, 30, 50]));
    expect(BAG_WEIGHTS.slice(5, 10)).toEqual(Array.from({ length: 5 }, () => [3, 12, 30, 55]));
    expect(BAG_WEIGHTS.slice(10, 15)).toEqual(Array.from({ length: 5 }, () => [2, 10, 28, 60]));
    expect(BAG_WEIGHTS.slice(15, 20)).toEqual(Array.from({ length: 5 }, () => [1, 8, 26, 65]));
  });

  it('keeps every row positive, four-wide, and normalized', () => {
    for (const row of BAG_WEIGHTS) {
      expect(row).toHaveLength(4);
      expect(row.every((weight) => weight >= 1)).toBe(true);
      expect(row.reduce((sum, weight) => sum + weight, 0)).toBe(100);
    }
  });

  it('owns the canonical 1+1+2+8 typeId bucket mapping', () => {
    expect(POLYCUBE_BUCKETS.map((bucket) => bucket.length)).toEqual([1, 1, 2, 8]);
    expect(POLYCUBE_BUCKETS.flat()).toEqual(Array.from({ length: 12 }, (_, index) => typeId(index)));
  });

  it('fails closed for malformed weights and buckets', () => {
    expect(() => assertValidBagConfiguration(BAG_WEIGHTS.slice(1), POLYCUBE_BUCKETS)).toThrow();
    const badWeights = BAG_WEIGHTS.map((row) => [...row]);
    badWeights[0] = [5, 15, 30, 49];
    expect(() => assertValidBagConfiguration(badWeights, POLYCUBE_BUCKETS)).toThrow();
    expect(() => assertValidBagConfiguration(BAG_WEIGHTS, POLYCUBE_BUCKETS.slice(1))).toThrow();
    expect(() => assertValidBagConfiguration(BAG_WEIGHTS, [
      [typeId(0)], [typeId(1)], [typeId(2), typeId(3)],
      [typeId(4), typeId(5), typeId(6), typeId(7), typeId(8), typeId(9), typeId(10), typeId(10)],
    ])).toThrow();
  });
});
