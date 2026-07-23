/**
 * Weighted 7-bag piece generator (deterministic, non-CSPRNG).
 *
 * @warning Output is fully determined by (state, level). Caller MUST supply
 *          RngState from a CSPRNG source (e.g. crypto.getRandomValues)
 *          for ranked or competitive play. Do NOT accept user-provided seeds
 *          in those contexts: attackers can brute-force extreme compositions.
 *          Seed-entropy gating is the responsibility of P1.4 initBagFromSeed
 *          and M7 replay validation, not this module.
 *
 * @see ADR-0003 rev.3 §2.4 / §2.7 (bag weights + boundary snapshot)
 * @see ADR-0001 rev.5 §2.3 (7-bag variant)
 * @see splitmix.ts (non-CSPRNG warning inherited)
 */
import { assertValidRngState, nextU32 } from '@engine/rng';
import type { RngState } from '@engine/rng';
import type { TypeId } from '@engine/types';
import { BAG_WEIGHTS, MAX_LEVEL, POLYCUBE_BUCKETS } from './bag-weights';
import type { BagWeights } from './bag-weights';

export const BAG_SIZE = 7 as const;
export const MIN_LEVEL = 1 as const;

export interface GenerateBagResult {
  /**
   * Raw splitmix64 counter after this bag (14 draws advanced).
   * @warning Must not be exposed to UI, replay files, or GameStateSnapshot;
   *          only the generated  should leave the engine. See the
   *           warning in .
   */
  readonly state: RngState;
  readonly bag: readonly TypeId[];
}

export function weightsForLevel(level: number): BagWeights {
  assertValidLevel(level);
  const weights = BAG_WEIGHTS[level - 1];
  if (weights === undefined) throw new Error(`missing weights for level ${level}`);
  return weights;
}

/** Generate seven pieces using one immutable level-weight snapshot. */
export function generateBag(state: RngState, level: number): GenerateBagResult {
  assertValidRngState(state);
  const weights = weightsForLevel(level);
  const bag: TypeId[] = [];
  let nextState = state;

  for (let slot = 0; slot < BAG_SIZE; slot++) {
    const bucketDraw = nextU32(nextState);
    nextState = bucketDraw.state;
    const bucketIndex = selectWeightedBucket(weights, bucketDraw.value % 100);
    const bucket = POLYCUBE_BUCKETS[bucketIndex];
    if (bucket === undefined) throw new Error(`missing polycube bucket ${bucketIndex}`);

    const typeDraw = nextU32(nextState);
    nextState = typeDraw.state;
    const selected = bucket[typeDraw.value % bucket.length];
    if (selected === undefined) throw new Error(`failed to select from polycube bucket ${bucketIndex}`);
    bag.push(selected);
  }

  return { state: nextState, bag: Object.freeze(bag) };
}

function assertValidLevel(level: number): void {
  if (!Number.isInteger(level) || level < MIN_LEVEL || level > MAX_LEVEL) {
    throw new TypeError(`invalid level: expected integer in [1, 20], got ${String(level)}`);
  }
}

function selectWeightedBucket(weights: BagWeights, draw: number): number {
  let cumulative = 0;
  for (const [index, weight] of weights.entries()) {
    cumulative += weight;
    if (draw < cumulative) return index;
  }
  throw new Error(`weighted draw ${draw} exceeds cumulative weight ${cumulative}`);
}
