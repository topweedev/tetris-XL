import { generateBag } from './bag';
import type { GenerateBagResult } from './bag';
import { assertValidRngState } from './splitmix';

/**
 * Initialize RNG state from a u32 seed and produce the first bag.
 *
 * @warning Output is fully determined by (seed, level0). Caller MUST supply
 *          seed from a CSPRNG source such as crypto.getRandomValues for ranked
 *          or competitive play. Do not accept user-provided seeds in those
 *          contexts. M4 bootstrapping and M7 replay validation own seed-source
 *          policy enforcement; this pure module only validates the u32 shape.
 *
 * @see ADR-0006 rev.2 §2.7 (initialState.seed as u32)
 * @see ADR-0003 rev.3 §2.4 (bag weights per level)
 * @see splitmix.ts (non-CSPRNG warning inherited via RngState)
 *
 * @param seed u32 integer in [0, 2^32), zero-extended to u64 RngState
 * @param level0 integer in [1, 20]
 */
export function initBagFromSeed(seed: number, level0: number): GenerateBagResult {
  assertValidU32Seed(seed);
  const initialState = BigInt(seed);
  assertValidRngState(initialState);
  return generateBag(initialState, level0);
}

/** Assert that a value is an integer u32 seed in [0, 2^32). */
export function assertValidU32Seed(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) ||
      value < 0 || value >= 0x1_0000_0000) {
    throw new TypeError(
      `invalid u32 seed: expected integer in [0, 2^32), got ${typeof value} ${String(value)}`,
    );
  }
}
