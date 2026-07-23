import { describe, expect, it } from 'vitest';
import { typeId } from '@engine/types';
import type { TypeId } from '@engine/types';
import type { CellTuple } from '@engine/pieces';
import { createBoard, hasCollision, setCellAt } from '@engine/core';

const ORIGIN: readonly CellTuple[] = [[0, 0, 0]];
const M1 = typeId(0);
const I4 = typeId(4);

describe('hasCollision', () => {
  it.each([
    [[0, 0, 0], false],
    [[4, 4, 11], false],
    [[-1, 0, 0], true],
    [[5, 0, 0], true],
    [[0, -1, 0], true],
    [[0, 5, 0], true],
    [[0, 0, -1], true],
  ] as const)('checks playfield boundary anchor %j', (anchor, expected) => {
    expect(hasCollision(createBoard(), ORIGIN, anchor, M1)).toBe(expected);
  });

  it('detects occupied board cells', () => {
    const board = createBoard();
    setCellAt(board, 2, 2, 11, 1);
    expect(hasCollision(board, ORIGIN, [2, 2, 11], M1)).toBe(true);
    expect(hasCollision(board, ORIGIN, [2, 2, 10], M1)).toBe(false);
  });

  it.each([12, 13, 14])('allows I4 spawn-buffer z=%i without board access', (z) => {
    const board = new Proxy(createBoard(), {
      get(target, property, receiver) {
        if (typeof property === 'string' && /^\d+$/.test(property)) {
          throw new Error('spawn-buffer placement read the board');
        }
        return Reflect.get(target, property, receiver);
      },
    });
    expect(hasCollision(board, ORIGIN, [2, 2, z], I4)).toBe(false);
  });

  it('accepts I4 local z=3 at the exact spawn-buffer ceiling', () => {
    const topCell: readonly CellTuple[] = [[0, 0, 3]];
    expect(hasCollision(createBoard(), topCell, [0, 0, 11], I4)).toBe(false);
    expect(hasCollision(createBoard(), topCell, [0, 0, 12], I4)).toBe(true);
  });

  it('rejects cells above the type-specific spawn buffer', () => {
    expect(hasCollision(createBoard(), ORIGIN, [2, 2, 15], I4)).toBe(true);
    expect(hasCollision(createBoard(), ORIGIN, [2, 2, 12], M1)).toBe(true);
  });

  it('still checks x/y bounds in the spawn buffer', () => {
    expect(hasCollision(createBoard(), ORIGIN, [5, 2, 12], I4)).toBe(true);
    expect(hasCollision(createBoard(), ORIGIN, [2, -1, 12], I4)).toBe(true);
  });

  it('applies local cells relative to the anchor', () => {
    const cells: readonly CellTuple[] = [[0, 0, 0], [1, 0, 0]];
    expect(hasCollision(createBoard(), cells, [3, 2, 0], typeId(1))).toBe(false);
    expect(hasCollision(createBoard(), cells, [4, 2, 0], typeId(1))).toBe(true);
  });

  it('rejects an invalid typeId at compile time', () => {
    const valid: TypeId = M1;
    expect(valid).toBe(M1);
  });

  it.each([
    ['-1', -1],
    ['12', 12],
    ['1.5', 1.5],
    ['NaN', NaN],
    ['Infinity', Infinity],
  ] as const)('throws RangeError for invalid typeId %s', (_label, value) => {
    expect(() => hasCollision(
      createBoard(),
      ORIGIN,
      [0, 0, 0],
      value as unknown as TypeId,
    )).toThrow(RangeError);
  });
});
