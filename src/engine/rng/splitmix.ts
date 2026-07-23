/**
 * Deterministic splitmix64 generator (Vigna 2015).
 * @see ADR-0003 rev.3 §2.4 and ADR-0006 rev.2 §2.7
 */
const U64_MASK = 0xffff_ffff_ffff_ffffn;
const U32_SHIFT = 32n;
const GAMMA = 0x9e37_79b9_7f4a_7c15n;
const MIX_MULTIPLIER_1 = 0xbf58_476d_1ce4_e5b9n;
const MIX_MULTIPLIER_2 = 0x94d0_49bb_1331_11ebn;

/** Advance one deterministic splitmix64 step, normalized to unsigned 64-bit. */
export function advance(state: bigint): bigint {
  let next = (state + GAMMA) & U64_MASK;
  next = ((next ^ (next >> 30n)) * MIX_MULTIPLIER_1) & U64_MASK;
  next = ((next ^ (next >> 27n)) * MIX_MULTIPLIER_2) & U64_MASK;
  return (next ^ (next >> 31n)) & U64_MASK;
}

export interface NextU32Result {
  readonly state: bigint;
  readonly value: number;
}

/** Advance the RNG and return the high 32 bits as an unsigned number. */
export function nextU32(state: bigint): NextU32Result {
  const next = advance(state);
  return { state: next, value: Number(next >> U32_SHIFT) };
}
