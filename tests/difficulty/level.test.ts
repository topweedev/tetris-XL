import { describe, expect, it } from 'vitest';
import {
  assertValidLevel,
  gravityStepAtLevel,
  levelFromLayers,
  lockDelayAtLevel,
} from '@engine/difficulty';

describe('level helpers', () => {
  it.each([
    [0, 1], [4, 1], [5, 2], [94, 19], [95, 20], [99, 20], [100, 20],
  ] as const)('maps %i cleared layers to level %i', (layers, level) => {
    expect(levelFromLayers(layers)).toBe(level);
  });

  it.each([-1, 1.5, NaN, Infinity])('rejects invalid cleared layers %s', (layers) => {
    expect(() => levelFromLayers(layers)).toThrow(TypeError);
  });

  it('exports the level validator', () => {
    expect(() => assertValidLevel(1)).not.toThrow();
    expect(() => assertValidLevel(20)).not.toThrow();
  });

  it('looks up level boundary values', () => {
    expect(gravityStepAtLevel(1)).toBe(60);
    expect(gravityStepAtLevel(20)).toBe(1);
    expect(lockDelayAtLevel(1)).toBe(500);
    expect(lockDelayAtLevel(20)).toBe(250);
  });

  it.each([0, 21, 1.5, NaN, Infinity])('rejects invalid level %s', (level) => {
    expect(() => gravityStepAtLevel(level)).toThrow(RangeError);
    expect(() => lockDelayAtLevel(level)).toThrow(RangeError);
  });
});
