import { describe, expect, it } from 'vitest';
import {
  BAG_WEIGHTS,
  POLYCUBE_BUCKETS,
  assertValidRngState,
  generateBag,
  nextU32,
  weightsForLevel,
} from '@engine/rng';
import type { RngState } from '@engine/rng';
import type { TypeId } from '@engine/types';

function rngState(value: bigint): RngState {
  assertValidRngState(value);
  return value;
}

function bucketIndex(type: TypeId): number {
  return POLYCUBE_BUCKETS.findIndex((bucket) => bucket.includes(type));
}

function aggregate(level: number, bags: number, seed = 0n): number[] {
  const counts = [0, 0, 0, 0];
  let state = rngState(seed);
  for (let round = 0; round < bags; round++) {
    const result = generateBag(state, level);
    state = result.state;
    for (const piece of result.bag) {
      const index = bucketIndex(piece);
      if (index < 0) throw new Error(`unknown typeId ${piece}`);
      counts[index] = (counts[index] ?? 0) + 1;
    }
  }
  return counts;
}

function expectWithinThreeSigma(counts: readonly number[], weights: readonly number[], draws: number): void {
  for (const [index, percent] of weights.entries()) {
    const probability = percent / 100;
    const expected = draws * probability;
    const tolerance = 3 * Math.sqrt(draws * probability * (1 - probability));
    expect(Math.abs((counts[index] ?? 0) - expected)).toBeLessThan(tolerance);
  }
}

describe('generateBag', () => {
  it('is deterministic across 100 rounds at every level', () => {
    for (let level = 1; level <= 20; level++) {
      for (let round = 0; round < 100; round++) {
        const state = rngState(BigInt(level * 100 + round));
        expect(generateBag(state, level)).toEqual(generateBag(state, level));
      }
    }
  });

  it('returns seven valid typeIds and consumes exactly 14 RNG draws', () => {
    const initial = rngState(42n);
    const result = generateBag(initial, 1);
    expect(result.bag).toHaveLength(7);
    expect(result.bag.every((piece) => Number.isInteger(piece) && piece >= 0 && piece <= 11)).toBe(true);
    let expectedState = initial;
    for (let draw = 0; draw < 14; draw++) expectedState = nextU32(expectedState).state;
    expect(result.state).toBe(expectedState);
    expect(Object.isFrozen(result.bag)).toBe(true);
  });

  it('covers every bucket in 100 bags and every typeId in 1,000 bags', () => {
    expect(aggregate(1, 100).every((count) => count > 0)).toBe(true);
    const seen = new Set<number>();
    let state = rngState(0n);
    for (let round = 0; round < 1_000; round++) {
      const result = generateBag(state, 1);
      state = result.state;
      for (const piece of result.bag) seen.add(piece);
    }
    expect([...seen].sort((left, right) => left - right)).toEqual(
      Array.from({ length: 12 }, (_, index) => index),
    );
  });

  it('tracks level-1 weights within three sigma across 7,000 draws', () => {
    expectWithinThreeSigma(aggregate(1, 1_000), BAG_WEIGHTS[0] ?? [], 7_000);
  });

  it('snapshots one row per bag and switches only on the L5 to L6 boundary', () => {
    expect(weightsForLevel(5)).toBe(BAG_WEIGHTS[4]);
    expect(weightsForLevel(6)).toBe(BAG_WEIGHTS[5]);
    const initial = rngState(77n);
    expect(generateBag(initial, 5)).toEqual(generateBag(initial, 5));
    const first = generateBag(initial, 5);
    const next = generateBag(first.state, 6);
    expect(next.bag).toHaveLength(7);
    expectWithinThreeSigma(aggregate(5, 1_000, 77n), BAG_WEIGHTS[4] ?? [], 7_000);
    expectWithinThreeSigma(aggregate(6, 1_000, 77n), BAG_WEIGHTS[5] ?? [], 7_000);
  });

  it('rejects invalid states and levels', () => {
    expect(() => generateBag(-1n as unknown as RngState, 1)).toThrow(TypeError);
    expect(() => generateBag(rngState(0n), 0)).toThrow(TypeError);
    expect(() => generateBag(rngState(0n), 21)).toThrow(TypeError);
    expect(() => generateBag(rngState(0n), 1.5)).toThrow(TypeError);
  });

  it.each([
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
    ['-0', -0],
    ['null', null],
    ['undefined', undefined],
    ['boxed new Number(1)', new Number(1)],
    ['object with valueOf', { valueOf: (): number => 5 }],
  ] as const)('rejects special value level %s', (_label, value) => {
    expect(() => generateBag(rngState(0n), value as unknown as number)).toThrow(TypeError);
  });
});
