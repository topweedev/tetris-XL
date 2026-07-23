export const MAX_LEVEL = 20 as const;
export const LAYERS_PER_LEVEL = 5 as const;
export const LOCK_DELAY_RESET_CAP = 15 as const;
export const SOFT_DROP_MIN_GRAVITY_STEP = 1 as const;
export const BASE_LINE_SCORE = Object.freeze([0, 100, 300, 700, 1500] as const);

const EXPECTED_GRAVITY_TABLE = [
  60, 48, 37, 28, 21, 16, 12, 9, 7, 5,
  4, 3, 2, 1, 1, 1, 1, 1, 1, 1,
] as const;

const EXPECTED_LOCK_DELAY_TABLE_MS = [
  500, 500, 500, 500, 500, 500, 500, 500, 500, 500,
  450, 400, 350, 300, 250, 250, 250, 250, 250, 250,
] as const;

/** Ticks per row at level 1 through 20. */
export const GRAVITY_TABLE: readonly number[] = Object.freeze([...EXPECTED_GRAVITY_TABLE]);

/** Lock delay in milliseconds at level 1 through 20. */
export const LOCK_DELAY_TABLE_MS: readonly number[] = Object.freeze([
  ...EXPECTED_LOCK_DELAY_TABLE_MS,
]);

/** Fail closed if difficulty constants drift from ADR-0003 §2.7. */
export function assertValidDifficultyTables(
  gravity: readonly number[] = GRAVITY_TABLE,
  lockDelayMs: readonly number[] = LOCK_DELAY_TABLE_MS,
): void {
  assertTable('GRAVITY_TABLE', gravity, EXPECTED_GRAVITY_TABLE);
  assertTable('LOCK_DELAY_TABLE_MS', lockDelayMs, EXPECTED_LOCK_DELAY_TABLE_MS);
}

function assertTable(
  name: string,
  actual: readonly number[],
  expected: readonly number[],
): void {
  if (actual.length !== MAX_LEVEL) {
    throw new Error(`${name}.length must be ${MAX_LEVEL}, got ${actual.length}`);
  }
  for (let index = 0; index < actual.length; index++) {
    const value = actual[index];
    if (value === undefined || !Number.isInteger(value) || value < 1) {
      throw new Error(`${name}[${index}] must be a positive integer, got ${value}`);
    }
    if (index > 0 && value > actual[index - 1]!) {
      throw new Error(`${name} must be monotonically non-increasing at ${index}`);
    }
    if (value !== expected[index]) {
      throw new Error(
        `${name}[${index}] differs from ADR-0003 §2.7: expected ${expected[index]}, got ${value}`,
      );
    }
  }
}

assertValidDifficultyTables();
