import type * as THREE from 'three';
import { BOARD_DEPTH, BOARD_WIDTH } from './constants';
export const BOARD_HALF = (BOARD_WIDTH - 1) / 2;
export function depthScale(z: number): number { return 1 + (z / BOARD_DEPTH) ** 2 * 7; }
export function boardToRenderVec3(target: THREE.Vector3, bx: number, by: number, bz: number): THREE.Vector3 { const scale = depthScale(bz); return target.set((bx - BOARD_HALF) * scale, bz === 0 ? 0 : -bz, (by - BOARD_HALF) * scale); }
