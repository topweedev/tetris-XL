export const LEVELS_PER_WEIGHT_BUCKET = 5 as const;
export const WEIGHT_BUCKET_COUNT = 4 as const;
export const TYPE_BUCKET_SIZES = [1, 1, 2, 8] as const;

export type BagWeights = readonly [number, number, number, number];

export const WEIGHT_TABLE: readonly BagWeights[] = Object.freeze([
  Object.freeze([5, 15, 30, 50] as const),
  Object.freeze([3, 12, 30, 55] as const),
  Object.freeze([2, 10, 28, 60] as const),
  Object.freeze([1, 8, 26, 65] as const),
]);

export function assertValidWeightTable(table: readonly (readonly number[])[]): void {
  if (table.length !== WEIGHT_BUCKET_COUNT) {
    throw new Error(`invalid weight table row count: ${table.length}`);
  }
  for (const [rowIndex, row] of table.entries()) {
    if (row.length !== TYPE_BUCKET_SIZES.length) {
      throw new Error(`invalid weight table shape at row ${rowIndex}`);
    }
    if (row.some((weight) => !Number.isInteger(weight) || weight < 1)) {
      throw new Error(`invalid weight at row ${rowIndex}`);
    }
    if (row.reduce((sum, weight) => sum + weight, 0) !== 100) {
      throw new Error(`weight row ${rowIndex} must sum to 100`);
    }
  }
}

assertValidWeightTable(WEIGHT_TABLE);
