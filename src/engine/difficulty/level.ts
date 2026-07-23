import {
  GRAVITY_TABLE,
  LAYERS_PER_LEVEL,
  LOCK_DELAY_TABLE_MS,
  MAX_LEVEL,
} from './tables';

/** Compute a 1-indexed level from cleared layers, clamped to MAX_LEVEL. */
export function levelFromLayers(totalLayersCleared: number): number {
  if (!Number.isInteger(totalLayersCleared) || totalLayersCleared < 0) {
    throw new TypeError(
      `totalLayersCleared must be non-negative integer, got ${totalLayersCleared}`,
    );
  }
  return Math.min(1 + Math.floor(totalLayersCleared / LAYERS_PER_LEVEL), MAX_LEVEL);
}

/** Read ticks per row for a validated level. */
export function gravityStepAtLevel(level: number): number {
  assertValidLevel(level);
  return GRAVITY_TABLE[level - 1]!;
}

/** Read lock delay milliseconds for a validated level. */
export function lockDelayAtLevel(level: number): number {
  assertValidLevel(level);
  return LOCK_DELAY_TABLE_MS[level - 1]!;
}

function assertValidLevel(level: number): void {
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
    throw new RangeError(`level must be integer in [1, ${MAX_LEVEL}], got ${level}`);
  }
}
