import { describe, expect, it } from 'vitest';
import { assertValidRngState, generateBag, weightsForLevel } from '@engine/rng';
import type { RngState } from '@engine/rng';

function rngState(value: bigint): RngState {
  assertValidRngState(value);
  return value;
}

describe('generateBag', () => {
  it('is deterministic across 100 rounds', () => {
    for (let seed = 0n; seed < 100n; seed++) {
      const state = rngState(seed);
      expect(generateBag(state, Number(seed % 20n))).toEqual(
        generateBag(state, Number(seed % 20n)),
      );
    }
  });

  it('contains every typeId exactly once across 100 bags per level', () => {
    const expected = Array.from({ length: 12 }, (_, index) => index);
    for (let level = 0; level < 20; level++) {
      for (let round = 0; round < 100; round++) {
        const { bag } = generateBag(rngState(BigInt(level * 100 + round)), level);
        expect([...bag].sort((left, right) => left - right)).toEqual(expected);
      }
    }
  });

  it('takes one immutable weight snapshot per bag at the level 5 boundary', () => {
    const state = rngState(42n);
    const levelFourWeights = weightsForLevel(4);
    const first = generateBag(state, 4);
    expect(weightsForLevel(4)).toBe(levelFourWeights);
    expect(Object.isFrozen(first.bag)).toBe(true);

    const levelFiveWeights = weightsForLevel(5);
    const second = generateBag(first.state, 5);
    expect(weightsForLevel(5)).toBe(levelFiveWeights);
    expect(levelFiveWeights).not.toBe(levelFourWeights);
    expect(second.bag).toHaveLength(12);
  });

  it('rejects invalid RNG states and levels', () => {
    expect(() => generateBag(-1n as unknown as RngState, 0)).toThrow(TypeError);
    expect(() => generateBag(rngState(0n), -1)).toThrow(RangeError);
    expect(() => generateBag(rngState(0n), 20)).toThrow(RangeError);
    expect(() => generateBag(rngState(0n), 1.5)).toThrow(RangeError);
  });
});
