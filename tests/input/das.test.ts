import { describe, expect, it } from 'vitest';
import {
  DAS_INITIAL_DELAY_MS,
  DAS_INITIAL_DELAY_TICKS,
  DAS_REPEAT_RATE_MS,
  DAS_REPEAT_RATE_TICKS,
  shouldRepeatDas,
} from '@engine/input';

describe('DAS', () => {
  it('uses the ADR 250ms/50ms tick-quantized constants', () => {
    expect(DAS_INITIAL_DELAY_MS).toBe(250);
    expect(DAS_REPEAT_RATE_MS).toBe(50);
    expect(DAS_INITIAL_DELAY_TICKS).toBe(15);
    expect(DAS_REPEAT_RATE_TICKS).toBe(3);
  });

  it('starts at tick 15 and repeats every 3 ticks', () => {
    for (let tick = 0; tick < 15; tick++) expect(shouldRepeatDas(tick)).toBe(false);
    expect(shouldRepeatDas(15)).toBe(true);
    expect(shouldRepeatDas(16)).toBe(false);
    expect(shouldRepeatDas(17)).toBe(false);
    expect(shouldRepeatDas(18)).toBe(true);
    expect(shouldRepeatDas(21)).toBe(true);
  });

  it('rejects malformed held-tick counters', () => {
    expect(() => shouldRepeatDas(-1)).toThrow(RangeError);
    expect(() => shouldRepeatDas(1.5)).toThrow(RangeError);
  });
});
