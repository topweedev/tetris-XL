import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_HIGH_CONTRAST_CUTAWAY, DEFAULT_PRESET, getHighContrastCutaway, getPreset, setHighContrastCutaway, setPreset, subscribe } from '../../src/render/theme';

describe('render theme API', () => {
  beforeEach(() => { setPreset(DEFAULT_PRESET); setHighContrastCutaway(DEFAULT_HIGH_CONTRAST_CUTAWAY); });
  it('exposes the documented defaults and round-trips state', () => {
    expect(DEFAULT_PRESET).toBe('translucent');
    expect(DEFAULT_HIGH_CONTRAST_CUTAWAY).toBe(false);
    setPreset('high-contrast'); setHighContrastCutaway(true);
    expect(getPreset()).toBe('high-contrast');
    expect(getHighContrastCutaway()).toBe(true);
  });
  it('synchronously notifies subscribers and supports unsubscribe', () => {
    const states: string[] = [];
    const unsubscribe = subscribe((state) => states.push(`${state.preset}:${state.highContrastCutaway}`));
    setPreset('opaque-fallback');
    unsubscribe(); setHighContrastCutaway(true);
    expect(states).toEqual(['opaque-fallback:false']);
  });
});
