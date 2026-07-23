import { describe, expect, it } from 'vitest';
import { advance, nextU32, isValidRngState, assertValidRngState } from '@engine/rng';
import type { RngState } from '@engine/rng';
import goldenFixture from './fixtures/splitmix.golden.json';

const U64_MASK = 0xffff_ffff_ffff_ffffn;
const FNV_OFFSET = 0xcbf2_9ce4_8422_2325n;
const FNV_PRIME = 0x0000_0100_0000_01b3n;

function rngState(value: bigint): RngState {
  assertValidRngState(value);
  return value;
}

function digestDraws(seed: bigint, draws: number): bigint {
  let digest = FNV_OFFSET;
  let state = rngState(seed);
  for (let draw = 0; draw < draws; draw++) {
    const result = nextU32(state);
    state = result.state;
    digest = ((digest ^ BigInt(result.value)) * FNV_PRIME) & U64_MASK;
  }
  return digest;
}

describe('splitmix64 canonical Vigna 2015 vectors', () => {
  const CANONICAL_SEED_0 = [
    0xe220_a839_7b1d_cdafn,
    0x6e78_9e6a_a1b9_65f4n,
    0x06c4_5d18_8009_454fn,
    0xf88b_b8a8_724c_81ecn,
    0x1b39_896a_51a8_749bn,
  ] as const;

  it('matches the published seed=0 sequence for 5 draws', () => {
    let state = rngState(0n);
    for (const expectedMixed of CANONICAL_SEED_0) {
      const result = nextU32(state);
      expect(result.value).toBe(Number(expectedMixed >> 32n));
      state = result.state;
    }
  });

  it('threads state as a raw linear counter', () => {
    const gamma = 0x9e37_79b9_7f4a_7c15n;
    let state = rngState(0n);
    for (let draw = 1; draw <= 5; draw++) {
      state = nextU32(state).state;
      expect(state).toBe((BigInt(draw) * gamma) & U64_MASK);
    }
  });
});

describe('assertValidRngState / isValidRngState', () => {
  it('accepts bigints in [0, 2^64)', () => {
    expect(isValidRngState(0n)).toBe(true);
    expect(isValidRngState(1n)).toBe(true);
    expect(isValidRngState(U64_MASK)).toBe(true);
    expect(() => assertValidRngState(0n)).not.toThrow();
    expect(() => assertValidRngState(U64_MASK)).not.toThrow();
  });

  it('rejects out-of-range bigints', () => {
    expect(isValidRngState(-1n)).toBe(false);
    expect(isValidRngState(1n << 64n)).toBe(false);
    expect(() => assertValidRngState(-1n)).toThrow(TypeError);
    expect(() => assertValidRngState(1n << 64n)).toThrow(TypeError);
  });

  it('rejects non-bigint types', () => {
    expect(isValidRngState(0)).toBe(false);
    expect(isValidRngState('0')).toBe(false);
    expect(isValidRngState(null)).toBe(false);
    expect(isValidRngState(undefined)).toBe(false);
    expect(isValidRngState({ valueOf: () => 0n })).toBe(false);
    expect(() => assertValidRngState(0)).toThrow(TypeError);
  });
});

describe('splitmix64', () => {
  it('matches 100 pre-recorded seed fixtures across 1,000 draws each', () => {
    expect(goldenFixture).toHaveLength(100);
    for (const fixture of goldenFixture) {
      expect(digestDraws(BigInt(fixture.seed), 1_000)).toBe(BigInt(fixture.digest));
    }
  });

  it.each([
    [0n, 0x9e37_79b9_7f4a_7c15n],
    [U64_MASK, 0x9e37_79b9_7f4a_7c14n],
    [1n, 0x9e37_79b9_7f4a_7c16n],
    [0xdead_beefn, 0x9e37_79ba_5df8_3b04n],
  ] as const)('draws deterministic counter from seed %s', (seed, expectedState) => {
    const initialState = rngState(seed);
    expect(nextU32(initialState).state).toBe(expectedState);
    let state = initialState;
    const firstRun: number[] = [];
    for (let draw = 0; draw < 100; draw++) {
      const result = nextU32(state);
      firstRun.push(result.value);
      state = result.state;
    }
    state = initialState;
    const secondRun: number[] = [];
    for (let draw = 0; draw < 100; draw++) {
      const result = nextU32(state);
      secondRun.push(result.value);
      state = result.state;
    }
    expect(secondRun).toEqual(firstRun);
  });

  it('rejects out-of-range or non-bigint inputs at the boundary', () => {
    expect(() => advance(-1n as RngState)).toThrow(TypeError);
    expect(() => advance((1n << 64n) as RngState)).toThrow(TypeError);
    expect(() => nextU32(42 as unknown as RngState)).toThrow(TypeError);
    expect(() => nextU32('bad' as unknown as RngState)).toThrow(TypeError);
  });

  it('does not mutate or depend on draw history', () => {
    const seed = rngState(0x1234_5678_9abc_def0n);
    expect(nextU32(seed)).toEqual(nextU32(seed));
  });

  it('passes the 32-bin chi-square proxy at the 0.5% upper bound', () => {
    const buckets = new Uint32Array(32);
    let state = rngState(42n);
    const draws = 100_000;
    for (let draw = 0; draw < draws; draw++) {
      const result = nextU32(state);
      state = result.state;
      const bucket = result.value & 0x1f;
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }

    const expected = draws / buckets.length;
    let chiSquare = 0;
    for (const observed of buckets) {
      const difference = observed - expected;
      chiSquare += (difference * difference) / expected;
    }
    expect(chiSquare).toBeLessThan(55.76);
  });
});
