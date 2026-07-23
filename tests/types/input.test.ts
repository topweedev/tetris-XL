import { describe, expect, it } from 'vitest';
import { isValidGameAction, VALID_GAMEACTION_VALUES } from '@engine/types';

describe('isValidGameAction', () => {
  it('accepts the declared action values', () => {
    for (const value of VALID_GAMEACTION_VALUES) expect(isValidGameAction(value)).toBe(true);
  });

  it.each([4, 9, 16, 19, 21, 29, 32, 39, 43, 100, NaN, Infinity, -1, 1.5])(
    'rejects invalid value %s', (value) => expect(isValidGameAction(value)).toBe(false),
  );
});
