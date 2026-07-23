import { SENTINEL_CELL, rotationStateId } from '@engine/types';
import type { RotationStateId } from '@engine/types';
import { POLYCUBE_DEFS } from './definitions';
import type { CellTuple, PolycubeDef } from './definitions';
import { SO24, applyRotation } from './so24';

export interface RotationState {
  readonly stateId: RotationStateId;
  /**
   * Packed cells (12 bytes, unused = SENTINEL_CELL). Shared canonical data —
   * do not mutate. `Piece` / `PieceSnapshot` factory must `.slice()` or
   * `Int8Array.from()` copy before returning to caller.
   * @warning Int8Array cannot be Object.freeze'd (typed-array elements are
   *          ArrayBuffer views); type-level Readonly + this warning is the
   *          only defense. M2 FSM piece builders own runtime enforcement.
   */
  readonly cells: Readonly<Int8Array>;
  /**
   * Rotation pivot (length 3). Shared canonical data — do not mutate.
   * Same immutability caveat as `cells`.
   */
  readonly origin: Readonly<Int8Array>;
  readonly cellCount: number;
}

export function normalizeCells(cells: readonly CellTuple[]): readonly CellTuple[] {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  const minZ = Math.min(...cells.map(([, , z]) => z));
  return cells.map(([x, y, z]) => [x - minX, y - minY, z - minZ] as const);
}

export function canonicalCellKey(cells: readonly CellTuple[]): string {
  return cells.map((cell) => cell.join(',')).sort().join(';');
}

export function unpackCells(state: RotationState): readonly CellTuple[] {
  const cells: CellTuple[] = [];
  for (let index = 0; index < state.cellCount; index++) {
    const offset = index * 3;
    cells.push([state.cells[offset]!, state.cells[offset + 1]!, state.cells[offset + 2]!]);
  }
  return cells;
}

function roundNearestTieDown(value: number): number {
  return Math.ceil(value - 0.5);
}

export function computeOrigin(cells: readonly CellTuple[]): Int8Array {
  if (cells.length === 0) throw new RangeError('cannot compute origin for empty cells');
  const sums = cells.reduce<[number, number, number]>(
    (result, [x, y, z]) => [result[0] + x, result[1] + y, result[2] + z],
    [0, 0, 0],
  );
  return Int8Array.from(sums.map((sum) => roundNearestTieDown(sum / cells.length)));
}

export function packCells(cells: readonly CellTuple[]): Int8Array {
  const packed = new Int8Array(12).fill(SENTINEL_CELL);
  cells.forEach(([x, y, z], index) => {
    const offset = index * 3;
    packed[offset] = x;
    packed[offset + 1] = y;
    packed[offset + 2] = z;
  });
  return packed;
}

export function enumerateFixedStates(definition: PolycubeDef): readonly RotationState[] {
  const seen = new Map<string, readonly CellTuple[]>();
  for (const matrix of SO24) {
    const normalized = normalizeCells(definition.cells.map((cell) => applyRotation(matrix, cell)));
    const key = canonicalCellKey(normalized);
    if (!seen.has(key)) seen.set(key, normalized);
  }
  return Object.freeze([...seen.values()].map((cells, index) => Object.freeze({
    stateId: rotationStateId(index),
    cells: packCells(cells),
    origin: computeOrigin(cells),
    cellCount: definition.cellCount,
  })));
}

// TODO ADR-0002 §2.3 correction: L4 has 24 fixed states, not 12.
// Its SO24 stabilizer is identity-only, so orbit-stabilizer gives 24/1 = 24.
export const EXPECTED_ROTATION_STATE_COUNTS = Object.freeze(
  [1, 3, 3, 12, 3, 3, 24, 12, 12, 12, 12, 8] as const,
);
export const ROTATION_STATES: readonly (readonly RotationState[])[] = Object.freeze(
  POLYCUBE_DEFS.map(enumerateFixedStates),
);

function assertValidRotationStates(): void {
  let total = 0;
  ROTATION_STATES.forEach((states, typeIndex) => {
    const expected = EXPECTED_ROTATION_STATE_COUNTS[typeIndex];
    if (states.length !== expected) {
      throw new Error(`rotation state count mismatch for typeId ${typeIndex}: ${states.length} !== ${expected}`);
    }
    for (const state of states) {
      const cells = unpackCells(state);
      if ([0, 1, 2].some((axis) => Math.min(...cells.map((cell) => cell[axis]!)) !== 0)) {
        throw new Error('rotation state is not normalized for typeId ' + typeIndex);
      }
      if ([...state.origin].some((coordinate) => coordinate < 0 || coordinate >= state.cellCount)) {
        throw new Error('rotation origin out of range for typeId ' + typeIndex);
      }
    }
    total += states.length;
  });
  if (total !== 105) throw new Error(`total rotation state count ${total} !== 105`);
  const right = new Set(ROTATION_STATES[9]!.map((state) => canonicalCellKey(unpackCells(state))));
  if (ROTATION_STATES[10]!.some((state) => right.has(canonicalCellKey(unpackCells(state))))) {
    throw new Error('RS4 and LS4 rotation states overlap');
  }
}

assertValidRotationStates();
