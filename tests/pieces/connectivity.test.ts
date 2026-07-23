import { describe, expect, it } from 'vitest';
import { isFaceConnected } from '@engine/pieces';

describe('isFaceConnected', () => {
  it.each([
    [[[0, 0, 0]], true],
    [[[0, 0, 0], [1, 0, 0]], true],
    [[[0, 0, 0], [2, 0, 0]], false],
    [[[0, 0, 0], [1, 0, 0], [2, 0, 0]], true],
    [[[0, 0, 0], [1, 0, 0], [3, 0, 0]], false],
    [[[0, 0, 0], [1, 1, 0]], false],
    [[], false],
  ] as const)('checks cells %j', (cells, expected) => {
    expect(isFaceConnected(cells)).toBe(expected);
  });

  it('accepts both chiral tetracubes and the tripod', () => {
    expect(isFaceConnected([[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1]])).toBe(true);
    expect(isFaceConnected([[0, 0, 1], [1, 0, 1], [1, 1, 1], [1, 1, 0]])).toBe(true);
    expect(isFaceConnected([[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]])).toBe(true);
  });
});
