export const DEPTH_RING_COUNT = 11;
export const DEPTH_RING_Z = Array.from({ length: DEPTH_RING_COUNT }, (_, index) => index + 1);
export const RIM_Z = 12;
export const FLOOR_Z = 0;
export const DEPTH_RING_ELEMENT_COUNT = DEPTH_RING_COUNT + 2;
