// per ADR-0001 rev.5 §2.4.4 and ADR-0002 rev.3 §2.2
export const BOARD_WIDTH = 5;
export const BOARD_HEIGHT = 5;
export const BOARD_DEPTH = 12;
export const BOARD_W = BOARD_WIDTH;
export const BOARD_H = BOARD_HEIGHT;
export const BOARD_D = BOARD_DEPTH;
export const BOARD_CELL_COUNT = BOARD_W * BOARD_H * BOARD_D;
export type BoardArray = Uint8Array;
export const idx = (x: number, y: number, z: number): number =>
  x + y * BOARD_WIDTH + z * BOARD_WIDTH * BOARD_HEIGHT;
