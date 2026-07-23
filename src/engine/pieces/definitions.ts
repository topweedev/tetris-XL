import type { TypeId } from '@engine/types';
import * as C from './constants';
import { isFaceConnected } from './connectivity';
import type { CellTuple } from './connectivity';

export type { CellTuple } from './connectivity';

export interface PolycubeDef {
  readonly typeId: TypeId;
  readonly shortName: string;
  readonly cellCount: number;
  readonly cells: readonly CellTuple[];
}

function def(typeId: TypeId, shortName: string, cells: readonly CellTuple[]): PolycubeDef {
  return Object.freeze({
    typeId,
    shortName,
    cellCount: cells.length,
    cells: Object.freeze(cells.map((cell) => Object.freeze(cell)) as readonly CellTuple[]),
  });
}

/** Twelve canonical polycube definitions indexed by typeId. */
export const POLYCUBE_DEFS: readonly PolycubeDef[] = Object.freeze([
  def(C.M1, 'M1', [[0, 0, 0]]),
  def(C.D2, 'D2', [[0, 0, 0], [1, 0, 0]]),
  def(C.I3, 'I3', [[0, 0, 0], [1, 0, 0], [2, 0, 0]]),
  def(C.V3, 'V3', [[0, 0, 0], [1, 0, 0], [0, 1, 0]]),
  def(C.I4, 'I4', [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]]),
  def(C.O4, 'O4', [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]]),
  def(C.L4, 'L4', [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 1, 0]]),
  def(C.T4, 'T4', [[0, 0, 0], [1, 0, 0], [2, 0, 0], [1, 1, 0]]),
  def(C.S4, 'S4', [[0, 0, 0], [1, 0, 0], [1, 1, 0], [2, 1, 0]]),
  def(C.RS4, 'RS4', [[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1]]),
  def(C.LS4, 'LS4', [[0, 0, 1], [1, 0, 1], [1, 1, 1], [1, 1, 0]]),
  def(C.BR4, 'BR4', [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]]),
]);

export function assertValidPolycubeDefs(defs: readonly PolycubeDef[]): void {
  if (defs.length !== 12) throw new Error(`POLYCUBE_DEFS.length !== 12, got ${defs.length}`);
  const expectedCounts = [1, 2, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4];
  for (const [index, polycube] of defs.entries()) {
    if (Number(polycube.typeId) !== index) {
      throw new Error(`POLYCUBE_DEFS[${index}].typeId !== ${index}`);
    }
    if (polycube.shortName !== C.POLYCUBE_SHORT_NAMES[index]) {
      throw new Error(`POLYCUBE_DEFS[${index}] shortName mismatch`);
    }
    if (polycube.cellCount !== expectedCounts[index] || polycube.cells.length !== polycube.cellCount) {
      throw new Error(`POLYCUBE_DEFS[${index}] cellCount mismatch`);
    }
    if (new Set(polycube.cells.map((cell) => cell.join(','))).size !== polycube.cells.length) {
      throw new Error(`polycube ${polycube.shortName} has duplicate cells`);
    }
    if (!isFaceConnected(polycube.cells)) {
      throw new Error(`polycube ${polycube.shortName} is not face-connected`);
    }
  }
}

assertValidPolycubeDefs(POLYCUBE_DEFS);
