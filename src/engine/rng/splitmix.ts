/**
 * Deterministic splitmix64 generator (Vigna 2015).
 * State is the raw counter (post-increment); output is the mixed counter.
 * @see ADR-0003 rev.3 §2.4 and ADR-0006 rev.2 §2.7
 * @see https://prng.di.unimi.it/splitmix64.c
 */
const U64_MASK = 0xffff_ffff_ffff_ffffn;
const U32_SHIFT = 32n;
const GAMMA = 0x9e37_79b9_7f4a_7c15n;
const MIX_MULTIPLIER_1 = 0xbf58_476d_1ce4_e5b9n;
const MIX_MULTIPLIER_2 = 0x94d0_49bb_1331_11ebn;

/** Advance the raw splitmix64 counter one GAMMA step. */
export function advance(state: bigint): bigint {
  return (state + GAMMA) & U64_MASK;
}

/** Vigna splitmix64 finalizer (mixer only; input is a raw counter). */
function mix(value: bigint): bigint {
  let mixed = ((value ^ (value >> 30n)) * MIX_MULTIPLIER_1) & U64_MASK;
  mixed = ((mixed ^ (mixed >> 27n)) * MIX_MULTIPLIER_2) & U64_MASK;
  return (mixed ^ (mixed >> 31n)) & U64_MASK;
}

export interface NextU32Result {
  readonly state: bigint;
  readonly value: number;
}

/** Advance the counter and return the high 32 bits of its mixed image. */
export function nextU32(state: bigint): NextU32Result {
  const counter = advance(state);
  const mixed = mix(counter);
  return { state: counter, value: Number(mixed >> U32_SHIFT) };
}
