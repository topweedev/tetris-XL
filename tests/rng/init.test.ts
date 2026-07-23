import { describe, expect, it } from 'vitest';
import {
  assertValidRngState,
  assertValidU32Seed,
  generateBag,
  initBagFromSeed,
} from '@engine/rng';
import type { RngState } from '@engine/rng';

function rngState(value: bigint): RngState {
  assertValidRngState(value);
  return value;
}

describe('assertValidU32Seed', () => {
  it.each([0, 1, 0xffff_ffff, -0])('accepts u32 seed %s', (seed) => {
    expect(() => assertValidU32Seed(seed)).not.toThrow();
  });

  it.each([-1, 0x1_0000_0000, 1.5, NaN, Infinity, null, undefined, '0'])(
    'rejects invalid seed %s', (seed) => {
      expect(() => assertValidU32Seed(seed)).toThrow(TypeError);
    },
  );
});

describe('initBagFromSeed', () => {
  it('is deterministic for fixed seed and level', () => {
    expect(initBagFromSeed(42, 10)).toEqual(initBagFromSeed(42, 10));
  });

  it('integrates ten rounds across three seeds and three levels', () => {
    const seen = new Set<number>();
    for (const seed of [0, 42, 0xdead_beef]) {
      for (const level of [1, 10, 20]) {
        let result = initBagFromSeed(seed, level);
        for (let round = 0; round < 10; round++) {
          expect(result.bag).toHaveLength(7);
          for (const piece of result.bag) seen.add(piece);
          result = generateBag(result.state, level);
        }
      }
    }
    expect([...seen].sort((left, right) => left - right)).toEqual(
      Array.from({ length: 12 }, (_, index) => index),
    );
  });

  it('zero-extends the u32 seed into the initial RngState', () => {
    const seed = 0xffff_ffff;
    expect(initBagFromSeed(seed, 1)).toEqual(generateBag(rngState(BigInt(seed)), 1));
  });

  it('switches the level snapshot only when generating the next bag', () => {
    const first = initBagFromSeed(42, 5);
    expect(first).toEqual(initBagFromSeed(42, 5));
    expect(generateBag(first.state, 6).bag).toHaveLength(7);
  });

  it('produces distinct deterministic results for representative seeds', () => {
    const results = [0, 42, 0xdead_beef].map((seed) => initBagFromSeed(seed, 1));
    expect(new Set(results.map((result) => JSON.stringify(result.bag))).size).toBe(3);
    expect(new Set(results.map((result) => result.state)).size).toBe(3);
  });

  it('rejects invalid seeds and levels through the integration boundary', () => {
    expect(() => initBagFromSeed(-1, 1)).toThrow(TypeError);
    expect(() => initBagFromSeed(0, 0)).toThrow(TypeError);
    expect(() => initBagFromSeed(0, 21)).toThrow(TypeError);
  });
});
