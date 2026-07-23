import { assertValidRngState, nextU32 } from '@engine/rng';
import type { RngState } from '@engine/rng';
import { typeId } from '@engine/types';
import type { TypeId } from '@engine/types';
import { LEVELS_PER_WEIGHT_BUCKET, TYPE_BUCKET_SIZES, WEIGHT_TABLE } from './bag-weights';
import type { BagWeights } from './bag-weights';

export const BAG_SIZE = 12 as const;
export const MIN_LEVEL = 0 as const;
export const MAX_LEVEL_EXCLUSIVE = 20 as const;
const U32_RANGE = 0x1_0000_0000;

const TYPE_ID_BUCKETS: readonly (readonly TypeId[])[] = Object.freeze([
  Object.freeze([typeId(0)]),
  Object.freeze([typeId(1)]),
  Object.freeze([typeId(2), typeId(3)]),
  Object.freeze(Array.from({ length: 8 }, (_, index) => typeId(index + 4))),
]);

if (TYPE_ID_BUCKETS.some((bucket, index) => bucket.length !== TYPE_BUCKET_SIZES[index])) {
  throw new Error('typeId bucket shape does not match ADR-0003 §2.4');
}

export interface GenerateBagResult {
  readonly state: RngState;
  readonly bag: readonly TypeId[];
}

export function weightsForLevel(level: number): BagWeights {
  assertValidLevel(level);
  const weights = WEIGHT_TABLE[Math.floor(level / LEVELS_PER_WEIGHT_BUCKET)];
  if (weights === undefined) throw new Error(`missing weights for level ${level}`);
  return weights;
}

export function generateBag(state: RngState, level: number): GenerateBagResult {
  assertValidRngState(state);
  const weights = weightsForLevel(level);
  const remaining = TYPE_ID_BUCKETS.map((bucket) => [...bucket]);
  const bag: TypeId[] = [];
  let nextState = state;

  while (bag.length < BAG_SIZE) {
    const activeWeights = weights.map((weight, index) =>
      (remaining[index]?.length ?? 0) > 0 ? weight : 0,
    );
    const bucketDraw = nextBounded(
      nextState,
      activeWeights.reduce((sum, weight) => sum + weight, 0),
    );
    nextState = bucketDraw.state;
    const bucketIndex = selectWeightedIndex(activeWeights, bucketDraw.value);
    const bucket = remaining[bucketIndex];
    if (bucket === undefined || bucket.length === 0) {
      throw new Error('weighted bag selected an empty typeId bucket');
    }
    const typeDraw = nextBounded(nextState, bucket.length);
    nextState = typeDraw.state;
    const [selected] = bucket.splice(typeDraw.value, 1);
    if (selected === undefined) throw new Error('weighted bag failed to select a typeId');
    bag.push(selected);
  }

  return { state: nextState, bag: Object.freeze(bag) };
}

function assertValidLevel(level: number): void {
  if (!Number.isInteger(level) || level < MIN_LEVEL || level >= MAX_LEVEL_EXCLUSIVE) {
    throw new RangeError(`invalid level: expected integer in [0, 20), got ${String(level)}`);
  }
}

function nextBounded(state: RngState, maxExclusive: number): { state: RngState; value: number } {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1) {
    throw new RangeError(`invalid random bound: ${String(maxExclusive)}`);
  }
  const acceptanceLimit = U32_RANGE - (U32_RANGE % maxExclusive);
  let nextState = state;
  while (true) {
    const draw = nextU32(nextState);
    nextState = draw.state;
    if (draw.value < acceptanceLimit) {
      return { state: nextState, value: draw.value % maxExclusive };
    }
  }
}

function selectWeightedIndex(weights: readonly number[], draw: number): number {
  let cumulative = 0;
  for (const [index, weight] of weights.entries()) {
    cumulative += weight;
    if (draw < cumulative) return index;
  }
  throw new Error(`weighted draw ${draw} exceeds cumulative weight ${cumulative}`);
}
