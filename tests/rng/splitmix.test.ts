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

describe('splitmix64', () => {
  it('matches 100 pre-recorded seed fixtures across 1,000 draws each', () => {
    expect(goldenFixture).toHaveLength(100);
    for (const fixture of goldenFixture) {
      expect(digestDraws(BigInt(fixture.seed), 1_000)).toBe(BigInt(fixture.digest));
    }
  });

  it.each([0n, U64_MASK, 1n, 0xdead_beefn])(
    'draws 100 stable defined values from boundary seed %s', (seed) => {
      let state = seed;
      const firstRun: number[] = [];
      for (let draw = 0; draw < 100; draw++) {
        const result = nextU32(state);
        expect(result.value).toBeTypeOf('number');
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
    },
  );

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
