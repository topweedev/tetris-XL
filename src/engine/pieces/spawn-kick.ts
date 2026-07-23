import type { CellTuple } from './connectivity';

/**
 * MVP spawn-kick policy per ADR-0002 §2.5: no offsets are attempted.
 * Spawn checks only the fixed origin at (2,2,11); collision means game over.
 * Future expansion (non-empty) MUST NOT add z offsets.
 */
export const SPAWN_KICK_OFFSETS: readonly CellTuple[] = Object.freeze([]);

/**
 * Validate spawn-kick table structure. Allows empty (MVP) or non-empty
 * with strict invariants: origin-first, no z offsets, |dx|<=2, |dy|<=2,
 * unique offsets, Manhattan distance <= 4.
 * @see ADR-0002 §2.5 (禁止 (0,0,±1))
 */
export function assertValidSpawnKickOffsets(offsets: readonly CellTuple[]): void {
  if (offsets.length === 0) return;
  if (offsets[0]?.join(',') !== '0,0,0') {
    throw new Error('spawn-kick[0] must be [0,0,0] (origin-first)');
  }
  const seen = new Set<string>();
  for (const [dx, dy, dz] of offsets) {
    if (dz !== 0) {
      throw new Error(`spawn-kick offset dz must be 0 per ADR-0002 §2.5: [${dx},${dy},${dz}]`);
    }
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      throw new Error(`spawn-kick offset out of range (|dx|,|dy|<=2): [${dx},${dy},${dz}]`);
    }
    if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 4) {
      throw new Error(`spawn-kick offset Manhattan > 4: [${dx},${dy},${dz}]`);
    }
    const key = `${dx},${dy},${dz}`;
    if (seen.has(key)) throw new Error(`spawn-kick offset duplicate: ${key}`);
    seen.add(key);
  }
}

assertValidSpawnKickOffsets(SPAWN_KICK_OFFSETS);
