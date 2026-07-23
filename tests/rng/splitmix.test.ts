import { describe, expect, it } from 'vitest';
import { advance, nextU32 } from '@engine/rng';
import goldenFixture from './fixtures/splitmix.golden.json';

const U64_MASK = 0xffff_ffff_ffff_ffffn;
const FNV_OFFSET = 0xcbf2_9ce4_8422_2325n;
const FNV_PRIME = 0x0000_0100_0000_01b3n;

function digestDraws(seed: bigint, draws: number): bigint {
  let digest = FNV_OFFSET;
  let state = seed;
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
    let state = 0n;
    for (const expectedMixed of CANONICAL_SEED_0) {
      const result = nextU32(state);
      expect(result.value).toBe(Number(expectedMixed >> 32n));
      state = result.state;
    }
  });

  it('threads state as a raw linear counter', () => {
    const gamma = 0x9e37_79b9_7f4a_7c15n;
    let state = 0n;
    for (let draw = 1; draw <= 5; draw++) {
      state = nextU32(state).state;
      expect(state).toBe((BigInt(draw) * gamma) & U64_MASK);
    }
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
    expect(nextU32(seed).state).toBe(expectedState);
    let state: bigint = seed;
    const firstRun: number[] = [];
    for (let draw = 0; draw < 100; draw++) {
      const result = nextU32(state);
      firstRun.push(result.value);
      state = result.state;
    }
    state = seed;
    const secondRun: number[] = [];
    for (let draw = 0; draw < 100; draw++) {
      const result = nextU32(state);
      secondRun.push(result.value);
      state = result.state;
    }
    expect(secondRun).toEqual(firstRun);
  });

  it('normalizes out-of-range bigint inputs to u64', () => {
    expect(advance(-1n)).toBe(advance(U64_MASK));
    expect(advance(1n << 64n)).toBe(advance(0n));
  });

  it('does not mutate or depend on draw history', () => {
    const seed = 0x1234_5678_9abc_def0n;
    expect(nextU32(seed)).toEqual(nextU32(seed));
  });

  it('passes the 32-bin chi-square proxy at the 0.5% upper bound', () => {
    const buckets = new Uint32Array(32);
    let state = 42n;
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
