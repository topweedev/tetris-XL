import { describe, expect, it } from 'vitest';
import { BOARD_CELL_COUNT, GameAction } from '@engine/types';

describe('engine aliases', () => {
  it('resolve runtime exports through @engine', () => {
    expect(BOARD_CELL_COUNT).toBe(300);
    expect(GameAction.Restart).toBe(42);
  });
});
