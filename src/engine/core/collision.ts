import { BOARD_D, BOARD_H, BOARD_W, idx } from '@engine/types';
import type { BoardArray, TypeId } from '@engine/types';
import { pieceMaxDz } from '@engine/pieces';
import type { CellTuple } from '@engine/pieces';

/**
 * Return whether placing cells at an anchor collides with bounds or occupancy.
 *
 * Cells above the board and within the type's spawn buffer are bounds-checked
 * in X/Y but never read from the board.
 */
export function hasCollision(
  board: BoardArray,
  cells: readonly CellTuple[],
  anchor: readonly [number, number, number],
  typeId: TypeId,
): boolean {
  const typeIndex = Number(typeId);
  if (
    !Number.isInteger(typeIndex)
    || typeIndex < 0
    || typeIndex >= pieceMaxDz.length
  ) {
    throw new RangeError(
      `invalid typeId: expected integer in [0, ${pieceMaxDz.length}), got ${typeIndex}`,
    );
  }
  const bufferMax = BOARD_D - 1 + pieceMaxDz[typeIndex]!;

  for (const [cx, cy, cz] of cells) {
    const wx = anchor[0] + cx;
    const wy = anchor[1] + cy;
    const wz = anchor[2] + cz;

    if (wx < 0 || wx >= BOARD_W) return true;
    if (wy < 0 || wy >= BOARD_H) return true;
    if (wz < 0 || wz > bufferMax) return true;
    if (wz < BOARD_D && board[idx(wx, wy, wz)]! !== 0) return true;
  }

  return false;
}
