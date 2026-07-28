import * as THREE from 'three';
import { BOARD_DEPTH, BOARD_WIDTH } from './constants';
export const DEPTH_RING_COUNT = 11;
export const DEPTH_RING_Z = Array.from({ length: DEPTH_RING_COUNT }, (_, i) => i + 1);
export const RIM_Z = 12;
export const FLOOR_Z = 0;
export const DEPTH_RING_ELEMENT_COUNT = 13;

export function createDepthRings(): THREE.Group {
  const group = new THREE.Group();
  for (const z of [...DEPTH_RING_Z, RIM_Z, FLOOR_Z]) {
    const size = (1 + (z / BOARD_DEPTH) ** 2 * 7) * BOARD_WIDTH;
    const points = [new THREE.Vector3(-size / 2, -z, -size / 2), new THREE.Vector3(size / 2, -z, -size / 2), new THREE.Vector3(size / 2, -z, size / 2), new THREE.Vector3(-size / 2, -z, size / 2), new THREE.Vector3(-size / 2, -z, -size / 2)];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const warning = z === 10;
    const material = warning ? new THREE.LineDashedMaterial({ color: 0xff5364, dashSize: 0.3, gapSize: 0.3, depthWrite: false }) : new THREE.LineBasicMaterial({ color: 0x8fa6b8, depthWrite: false });
    const line = new THREE.Line(geometry, material);
    if (warning) line.computeLineDistances();
    line.renderOrder = 0;
    group.add(line);
  }
  return group;
}
