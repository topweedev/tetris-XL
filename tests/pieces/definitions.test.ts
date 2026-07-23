import { describe, expect, it } from 'vitest';
import { POLYCUBE_BUCKETS } from '@engine/rng';
import { typeId } from '@engine/types';
import {
  POLYCUBE_DEFS,
  POLYCUBE_SHORT_NAMES,
  assertValidPolycubeDefs,
  isFaceConnected,
} from '@engine/pieces';
import type { PolycubeDef } from '@engine/pieces';

const EXPECTED_CELLS = [
  [[0, 0, 0]],
  [[0, 0, 0], [1, 0, 0]],
  [[0, 0, 0], [1, 0, 0], [2, 0, 0]],
  [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
  [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]],
  [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]],
  [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 1, 0]],
  [[0, 0, 0], [1, 0, 0], [2, 0, 0], [1, 1, 0]],
  [[0, 0, 0], [1, 0, 0], [1, 1, 0], [2, 1, 0]],
  [[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1]],
  [[0, 0, 1], [1, 0, 1], [1, 1, 1], [1, 1, 0]],
  [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]],
] as const;

describe('POLYCUBE_DEFS', () => {
  it('has canonical typeId, short-name, and cellCount order', () => {
    expect(POLYCUBE_DEFS).toHaveLength(12);
    expect(POLYCUBE_DEFS.map((definition) => definition.typeId)).toEqual(
      Array.from({ length: 12 }, (_, index) => typeId(index)),
    );
    expect(POLYCUBE_DEFS.map((definition) => definition.shortName)).toEqual(POLYCUBE_SHORT_NAMES);
    expect(POLYCUBE_DEFS.map((definition) => definition.cellCount)).toEqual(
      [1, 2, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4],
    );
    expect(POLYCUBE_DEFS.reduce((sum, definition) => sum + definition.cellCount, 0)).toBe(41);
  });

  it('matches every ADR-0002 canonical cell coordinate exactly', () => {
    expect(POLYCUBE_DEFS.map((definition) => definition.cells)).toEqual(EXPECTED_CELLS);
  });

  it('keeps all definitions face-connected', () => {
    expect(POLYCUBE_DEFS.every((definition) => isFaceConnected(definition.cells))).toBe(true);
  });

  it('matches the P1.3 bucket mapping by cellCount', () => {
    const grouped = [1, 2, 3, 4].map((cellCount) =>
      POLYCUBE_DEFS.filter((definition) => definition.cellCount === cellCount)
        .map((definition) => definition.typeId),
    );
    expect(grouped).toEqual(POLYCUBE_BUCKETS);
  });

  it('fails closed for malformed definitions', () => {
    expect(() => assertValidPolycubeDefs(POLYCUBE_DEFS.slice(0, 11))).toThrow();

    const wrongOrder = [...POLYCUBE_DEFS];
    [wrongOrder[0], wrongOrder[1]] = [wrongOrder[1]!, wrongOrder[0]!];
    expect(() => assertValidPolycubeDefs(wrongOrder)).toThrow();

    const wrongCount: PolycubeDef[] = POLYCUBE_DEFS.map((definition, index) =>
      index === 0 ? { ...definition, cellCount: 2 } : definition,
    );
    expect(() => assertValidPolycubeDefs(wrongCount)).toThrow();

    const disconnected: PolycubeDef[] = POLYCUBE_DEFS.map((definition, index) =>
      index === 1 ? { ...definition, cells: [[0, 0, 0], [2, 0, 0]] } : definition,
    );
    expect(() => assertValidPolycubeDefs(disconnected)).toThrow();
  });
});
