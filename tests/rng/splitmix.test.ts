import { describe, expect, it } from 'vitest';
import { advance, nextU32 } from '@engine/rng';

const U64_MASK = 0xffff_ffff_ffff_ffffn;
const FNV_OFFSET = 0xcbf2_9ce4_8422_2325n;
const FNV_PRIME = 0x0000_0100_0000_01b3n;

function digestGoldenDraws(): bigint {
  let digest = FNV_OFFSET;
  for (let seed = 0n; seed < 100n; seed++) {
    let state = seed;
    for (let draw = 0; draw < 1_000; draw++) {
      const result = nextU32(state);
      state = result.state;
      digest = ((digest ^ BigInt(result.value)) * FNV_PRIME) & U64_MASK;
    }
  }
  return digest;
}

describe('splitmix64', () => {
  it('matches the 100 seeds × 1,000 draws golden digest', () => {
    expect(digestGoldenDraws()).toBe(0x8d70_1686_6eba_abd2n);
  });

  it.each([
    [0n, 0xe220_a839_7b1d_cdafn, 0xe220_a839],
    [0xffff_ffffn, 0x73b1_3ba2_aff1_81c0n, 0x73b1_3ba2],
    [U64_MASK, 0xe4d9_7177_1b65_2c20n, 0xe4d9_7177],
  ] as const)('advances boundary seed %s', (seed, expectedState, expectedValue) => {
    expect(nextU32(seed)).toEqual({ state: expectedState, value: expectedValue });
  });

  it('normalizes out-of-range bigint inputs to u64', () => {
    expect(advance(-1n)).toBe(advance(U64_MASK));
    expect(advance(1n << 64n)).toBe(advance(0n));
  });

  it('does not mutate or depend on draw history', () => {
    const seed = 0x1234_5678_9abc_def0n;
    expect(nextU32(seed)).toEqual(nextU32(seed));
  });

  it('passes a chi-square proxy across 256 high-byte buckets', () => {
    const buckets = new Uint32Array(256);
    let state = 0x0123_4567_89ab_cdefn;
    const draws = 100_000;
    for (let draw = 0; draw < draws; draw++) {
      const result = nextU32(state);
      state = result.state;
      const bucket = result.value >>> 24;
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }

    const expected = draws / buckets.length;
    let chiSquare = 0;
    for (const observed of buckets) {
      const difference = observed - expected;
      chiSquare += (difference * difference) / expected;
    }
    expect(chiSquare).toBeGreaterThan(170);
    expect(chiSquare).toBeLessThan(350);
  });
});
