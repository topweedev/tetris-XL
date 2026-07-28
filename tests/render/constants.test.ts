import { describe, expect, it } from 'vitest';
import { BOARD_DEPTH, DEPTH_SEGMENTS, FADE_FAR_OFFSET, FADE_NEAR_OFFSET, BASE_WALL_ALPHA } from '../../src/render/constants';
import { DEPTH_RING_ELEMENT_COUNT, DEPTH_RING_Z } from '../../src/render/depth-rings';

describe('renderer foundation constants', () => {
  it('matches the well ADR dimensions and ring distribution', () => {
    expect(BOARD_DEPTH).toBe(12);
    expect(DEPTH_SEGMENTS).toBe(12);
    expect(DEPTH_RING_Z).toEqual(Array.from({ length: 11 }, (_, index) => index + 1));
    expect(DEPTH_RING_ELEMENT_COUNT).toBe(13);
    expect([BASE_WALL_ALPHA, FADE_NEAR_OFFSET, FADE_FAR_OFFSET]).toEqual([0.28, 0.5, 2.5]);
  });
});
