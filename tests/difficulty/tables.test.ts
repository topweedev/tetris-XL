import { describe, expect, it } from 'vitest';
import {
  GRAVITY_TABLE,
  LOCK_DELAY_TABLE_MS,
  assertValidDifficultyTables,
} from '@engine/difficulty';

describe('difficulty tables', () => {
  it('matches ADR-0003 §2.7 exactly', () => {
    expect(GRAVITY_TABLE).toEqual([
      60, 48, 37, 28, 21, 16, 12, 9, 7, 5,
      4, 3, 2, 1, 1, 1, 1, 1, 1, 1,
    ]);
    expect(LOCK_DELAY_TABLE_MS).toEqual([
      500, 500, 500, 500, 500, 500, 500, 500, 500, 500,
      450, 400, 350, 300, 250, 250, 250, 250, 250, 250,
    ]);
    expect(Object.isFrozen(GRAVITY_TABLE)).toBe(true);
    expect(Object.isFrozen(LOCK_DELAY_TABLE_MS)).toBe(true);
  });

  it('is monotonically non-increasing and positive', () => {
    for (const table of [GRAVITY_TABLE, LOCK_DELAY_TABLE_MS]) {
      expect(table).toHaveLength(20);
      table.forEach((value, index) => {
        expect(value).toBeGreaterThanOrEqual(1);
        if (index > 0) expect(value).toBeLessThanOrEqual(table[index - 1]!);
      });
    }
  });

  it('fails closed for malformed tables', () => {
    expect(() => assertValidDifficultyTables(GRAVITY_TABLE.slice(1), LOCK_DELAY_TABLE_MS))
      .toThrow(/length/);
    const increasing = [...GRAVITY_TABLE];
    increasing[1] = 61;
    expect(() => assertValidDifficultyTables(increasing, LOCK_DELAY_TABLE_MS))
      .toThrow(/monotonically/);
    const zero = [...LOCK_DELAY_TABLE_MS];
    zero[0] = 0;
    expect(() => assertValidDifficultyTables(GRAVITY_TABLE, zero))
      .toThrow(/positive integer/);
    const drifted = [...GRAVITY_TABLE];
    drifted[0] = 59;
    expect(() => assertValidDifficultyTables(drifted, LOCK_DELAY_TABLE_MS))
      .toThrow(/differs from ADR/);
  });
});
