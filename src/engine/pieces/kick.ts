import { ROTATION_STATES } from './rotations';
import type { CellTuple } from './connectivity';

/** Shared wall/floor-kick candidates, in ADR-0002 §2.4 attempt order. */
export const KICK_OFFSETS: readonly CellTuple[] = Object.freeze([
  [0, 0, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [2, 0, 0],
  [-2, 0, 0],
  [0, 2, 0],
  [0, -2, 0],
].map((offset) => Object.freeze(offset)) as unknown as readonly CellTuple[]);

function computePieceMaxDz(): readonly number[] {
  return Object.freeze(ROTATION_STATES.map((states) => {
    let maximum = 0;
    for (const state of states) {
      for (let cellIndex = 0; cellIndex < state.cellCount; cellIndex++) {
        maximum = Math.max(maximum, state.cells[cellIndex * 3 + 2]!);
      }
    }
    return maximum;
  }));
}

/** Maximum normalized local z coordinate over every fixed state, indexed by typeId. */
export const pieceMaxDz = computePieceMaxDz();

export function assertValidKickOffsets(offsets: readonly CellTuple[]): void {
  if (offsets.length !== 14) throw new Error(`KICK_OFFSETS.length !== 14, got ${offsets.length}`);
  if (offsets[0]?.join(',') !== '0,0,0') throw new Error('KICK_OFFSETS must try origin first');
  const keys = new Set<string>();
  for (const [dx, dy, dz] of offsets) {
    const key = `${dx},${dy},${dz}`;
    if (keys.has(key)) throw new Error(`duplicate kick offset: ${key}`);
    keys.add(key);
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) throw new Error(`kick offset exceeds well width: ${key}`);
    if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 4) throw new Error(`kick offset too large: ${key}`);
    if (dx === 0 && dy === 0 && dz === -1) throw new Error('downward kick is forbidden');
  }
}

function assertValidPieceMaxDz(): void {
  if (pieceMaxDz.length !== 12) throw new Error(`pieceMaxDz.length !== 12, got ${pieceMaxDz.length}`);
  if (pieceMaxDz.some((value) => !Number.isInteger(value) || value < 0 || value > 3)) {
    throw new Error(`pieceMaxDz out of range: ${pieceMaxDz.join(',')}`);
  }
  if (Math.max(...pieceMaxDz) !== 3) throw new Error('pieceMaxDz maximum must be 3');
}

assertValidKickOffsets(KICK_OFFSETS);
assertValidPieceMaxDz();
