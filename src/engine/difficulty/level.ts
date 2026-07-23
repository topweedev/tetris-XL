import {
  GRAVITY_TABLE,
  LAYERS_PER_LEVEL,
  LOCK_DELAY_TABLE_MS,
  MAX_LEVEL,
} from './tables';

/** Compute level from total cleared layers, clamped to MAX_LEVEL. */
export function levelFromLayers(totalLayersCleared: number): number {
  if (!Number.isInteger(totalLayersCleared) || totalLayersCleared < 0) {
    throw new TypeError(
      `totalLayersCleared: expected non-negative integer, got ${totalLayersCleared}`,
    );
  }
  return Math.min(
    1 + Math.floor(totalLayersCleared / LAYERS_PER_LEVEL),
    MAX_LEVEL,
  );
}

/** Validate a 1-indexed level. */
export function assertValidLevel(level: number): void {
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
    throw new RangeError(
      `level: expected integer in [1, ${MAX_LEVEL}], got ${level}`,
    );
  }
}

export function gravityStepAtLevel(level: number): number {
  assertValidLevel(level);
  return GRAVITY_TABLE[level - 1]!;
}

export function lockDelayAtLevel(level: number): number {
  assertValidLevel(level);
  return LOCK_DELAY_TABLE_MS[level - 1]!;
}
