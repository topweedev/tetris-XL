import * as THREE from 'three';
import { BOARD_DEPTH, BOARD_WIDTH } from './constants';
import { PIECE_PALETTE } from './constants';
import { boardToRenderVec3, depthScale } from './coords';
import type { RenderPreset } from './theme';

export const MAX_INSTANCES = BOARD_WIDTH * BOARD_WIDTH * BOARD_DEPTH;

export function createLockedMesh(): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ depthTest: true, depthWrite: true }), MAX_INSTANCES);
  mesh.count = 0; mesh.renderOrder = 1; return mesh;
}

export function updateLockedMesh(mesh: THREE.InstancedMesh, board: Uint8Array): void {
  const matrix = new THREE.Matrix4(); const color = new THREE.Color(); const position = new THREE.Vector3(); const scaleVector = new THREE.Vector3(); const quaternion = new THREE.Quaternion(); let count = 0;
  for (let z = 0; z < BOARD_DEPTH; z += 1) for (let y = 0; y < BOARD_WIDTH; y += 1) for (let x = 0; x < BOARD_WIDTH; x += 1) {
    const value = board[x + y * BOARD_WIDTH + z * BOARD_WIDTH * BOARD_WIDTH]; if (!value) continue; if (value < 1 || value > PIECE_PALETTE.length) throw new Error('invalid locked cell value ' + value);
    const scale = depthScale(z); boardToRenderVec3(position, x, y, z); scaleVector.set(scale, 1, scale); matrix.compose(position, quaternion, scaleVector); mesh.setMatrixAt(count, matrix); const rgb = PIECE_PALETTE[Number(value) - 1]!; color.setRGB(rgb[0], rgb[1], rgb[2]); mesh.setColorAt(count, color); count += 1;
  }
  mesh.count = count; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

/** ADR-0009 keeps locked-cell palette luminance stable across presets. */
export function relightLocked(_mesh: THREE.InstancedMesh, _preset: RenderPreset): void {}
