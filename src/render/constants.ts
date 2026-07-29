import type { RenderPreset } from './theme';
export const BOARD_WIDTH = 5;
export const BOARD_HEIGHT = 5;
export const BOARD_DEPTH = 12;
export const DEPTH_SEGMENTS = 12;
export const BASE_WALL_ALPHA = 0.28;
export const FADE_NEAR_OFFSET = 0.5;
export const FADE_FAR_OFFSET = 2.5;
export const WELL_TILT_DEGREES = -5;
export const CAMERA_HEIGHT = 20;
export const ACTIVE_OUTLINE_COLOR = 0x39e6cf;
export const ACTIVE_FILL_ALPHA_BY_PRESET: Record<RenderPreset, number> = { translucent: 0.58, 'high-contrast': 0.68, 'opaque-fallback': 0.92 };
export const LOCKED_GRID_OPACITY = 0.15;
export const GHOST_DASH: [number, number] = [6, 4];
// TODO(ADR-0008): replace placeholder palette when the final piece palette is accepted.
export const PIECE_PALETTE: readonly [number, number, number][] = Object.freeze([
  [0.25, 0.48, 0.95], [1, 0.70, 0.33], [0.43, 0.66, 1], [1, 0.44, 0.57], [0.71, 0.55, 1], [0.49, 0.89, 0.55],
  [1, 0.56, 0.35], [0.91, 0.89, 0.42], [0.34, 0.78, 0.85], [0.85, 0.55, 1], [1, 0.47, 0.62], [0.61, 0.83, 0.67],
]);
