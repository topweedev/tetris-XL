/**
 * Deterministic splitmix64 generator (Vigna 2015).
 * State is the raw counter (post-increment); output is the mixed counter.
 *
 * @warning **Not cryptographically secure.** Do not use for authentication,
 *          tokens, session IDs, key generation, or any security-sensitive
 *          purpose. Any few consecutive outputs allow full state recovery
 *          and prediction of all future outputs. Use `crypto.getRandomValues`
 *          for those cases.
 *
 * @see ADR-0003 rev.3 §2.4 and ADR-0006 rev.2 §2.7
 * @see https://prng.di.unimi.it/splitmix64.c
 */
const U64_MASK = 0xffff_ffff_ffff_ffffn;
const U32_SHIFT = 32n;
const GAMMA = 0x9e37_79b9_7f4a_7c15n;
const MIX_MULTIPLIER_1 = 0xbf58_476d_1ce4_e5b9n;
const MIX_MULTIPLIER_2 = 0x94d0_49bb_1331_11ebn;

declare const __rngStateBrand: unique symbol;

/**
 * Branded splitmix64 state. Raw linear counter (post-increment by GAMMA).
 * @warning Must not be exposed to UI, replay files, or GameStateSnapshot;
 *          the original seed can be recovered from state, draw count, and GAMMA.
 */
export type RngState = bigint & { readonly [__rngStateBrand]: true };

/** Type guard for a bigint splitmix64 state in [0, 2^64). */
export function isValidRngState(value: unknown): value is RngState {
  return typeof value === 'bigint' && value >= 0n && value < (1n << 64n);
}

/** Assert that a value is a bigint splitmix64 state in [0, 2^64). */
export function assertValidRngState(value: unknown): asserts value is RngState {
  if (!isValidRngState(value)) {
    throw new TypeError(
      'invalid RNG state: expected bigint in [0, 2^64), got ' + typeof value + ' ' + String(value),
    );
  }
}

/**
 * Advance the raw splitmix64 counter one GAMMA step.
 * @warning Not cryptographically secure. Do not use for auth, tokens,
 *          session IDs, or key generation.
 */
export function advance(state: RngState): RngState {
  assertValidRngState(state);
  return ((state + GAMMA) & U64_MASK) as RngState;
}

/** Vigna splitmix64 finalizer (mixer only; input is a raw counter). */
function mix(value: bigint): bigint {
  let mixed = ((value ^ (value >> 30n)) * MIX_MULTIPLIER_1) & U64_MASK;
  mixed = ((mixed ^ (mixed >> 27n)) * MIX_MULTIPLIER_2) & U64_MASK;
  return (mixed ^ (mixed >> 31n)) & U64_MASK;
}

export interface NextU32Result {
  /**
   * Raw splitmix64 counter (post-increment).
   * @warning Must not leak into UI, replay files, or GameStateSnapshot;
   *          see the `RngState` warning.
   */
  readonly state: RngState;
  /** Mixed output in [0, 2^32). */
  readonly value: number;
}

/**
 * Advance the counter and return the high 32 bits of its mixed image.
 * @warning Not cryptographically secure. Do not use for auth, tokens,
 *          session IDs, or key generation.
 */
export function nextU32(state: RngState): NextU32Result {
  assertValidRngState(state);
  const counter = advance(state);
  const mixed = mix(counter);
  return { state: counter, value: Number(mixed >> U32_SHIFT) };
}
