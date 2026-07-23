import { typeId } from '@engine/types';
import type { TypeId } from '@engine/types';

export const MAX_LEVEL = 20 as const;
export const BAG_BUCKET_COUNT = 4 as const;
export type BagWeights = readonly [number, number, number, number];

export const BAG_WEIGHTS: readonly BagWeights[] = Object.freeze([
  [5, 15, 30, 50], [5, 15, 30, 50], [5, 15, 30, 50], [5, 15, 30, 50], [5, 15, 30, 50],
  [3, 12, 30, 55], [3, 12, 30, 55], [3, 12, 30, 55], [3, 12, 30, 55], [3, 12, 30, 55],
  [2, 10, 28, 60], [2, 10, 28, 60], [2, 10, 28, 60], [2, 10, 28, 60], [2, 10, 28, 60],
  [1, 8, 26, 65], [1, 8, 26, 65], [1, 8, 26, 65], [1, 8, 26, 65], [1, 8, 26, 65],
].map((row) => Object.freeze(row) as BagWeights));

export const POLYCUBE_BUCKETS: readonly (readonly TypeId[])[] = Object.freeze([
  Object.freeze([typeId(0)]),
  Object.freeze([typeId(1)]),
  Object.freeze([typeId(2), typeId(3)]),
  Object.freeze([
    typeId(4), typeId(5), typeId(6), typeId(7),
    typeId(8), typeId(9), typeId(10), typeId(11),
  ]),
]);

export function assertValidBagConfiguration(
  weights: readonly (readonly number[])[],
  buckets: readonly (readonly TypeId[])[],
): void {
  if (weights.length !== MAX_LEVEL) throw new Error(`invalid bag weight row count: ${weights.length}`);
  for (const [index, row] of weights.entries()) {
    if (row.length !== BAG_BUCKET_COUNT) throw new Error(`invalid bag weight shape at row ${index}`);
    if (row.some((weight) => !Number.isInteger(weight) || weight < 1)) {
      throw new Error(`invalid bag weight at row ${index}`);
    }
    if (row.reduce((sum, weight) => sum + weight, 0) !== 100) {
      throw new Error(`bag weight row ${index} must sum to 100`);
    }
  }
  if (buckets.length !== BAG_BUCKET_COUNT || buckets.some((bucket) => bucket.length < 1)) {
    throw new Error('invalid polycube bucket shape');
  }
  const allTypeIds = buckets.flat();
  if (allTypeIds.length !== 12 || new Set(allTypeIds).size !== 12 ||
      !allTypeIds.every((value, index) => value === index)) {
    throw new Error('polycube buckets must contain canonical typeIds 0..11 exactly once');
  }
}

assertValidBagConfiguration(BAG_WEIGHTS, POLYCUBE_BUCKETS);
