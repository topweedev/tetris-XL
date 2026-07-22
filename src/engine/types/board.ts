export const BOARD_WIDTH = 5;
export const BOARD_HEIGHT = 5;
export const BOARD_DEPTH = 12;
export type BoardArray = Uint8Array;
export const idx = (x: number, y: number, z: number): number =>
  x + y * BOARD_WIDTH + z * BOARD_WIDTH * BOARD_HEIGHT;
