import type { BoardArray, GameState, TypeId } from '@engine/types';
import { expect } from 'vitest';

void (null as BoardArray | GameState | TypeId | null);
const setupTypes = await import('@engine/types');
expect(setupTypes.VALID_GAMEACTION_VALUES.length).toBeGreaterThan(0);
