import type { CellTuple } from './connectivity';

/**
 * MVP spawn-kick policy per ADR-0002 §2.5: no offsets are attempted.
 * Spawn checks only the fixed origin at (2,2,11); collision means game over.
 * Future expansion must remain separate from KICK_OFFSETS and must not add z offsets.
 */
export const SPAWN_KICK_OFFSETS: readonly CellTuple[] = Object.freeze([]);

if (SPAWN_KICK_OFFSETS.length !== 0) {
  throw new Error('SPAWN_KICK_OFFSETS must remain empty for MVP');
}
