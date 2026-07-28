import * as THREE from 'three';
import { BOARD_DEPTH, BOARD_WIDTH } from './constants';
import type { TypeId } from '@engine/types';
import { PIECE_PALETTE } from './constants';

export const MAX_INSTANCES = BOARD_WIDTH * BOARD_WIDTH * BOARD_DEPTH;

export function createLockedMesh(): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ vertexColors: true, depthTest: true, depthWrite: true }), MAX_INSTANCES);
  mesh.count = 0; mesh.renderOrder = 1; return mesh;
}

export function updateLockedMesh(mesh: THREE.InstancedMesh, board: Uint8Array): void {
  const matrix = new THREE.Matrix4(); const color = new THREE.Color(); let count = 0;
  for (let z = 0; z < BOARD_DEPTH; z += 1) for (let y = 0; y < BOARD_WIDTH; y += 1) for (let x = 0; x < BOARD_WIDTH; x += 1) {
    const value = board[x + y * BOARD_WIDTH + z * BOARD_WIDTH * BOARD_WIDTH]; if (!value) continue;
    const scale = 1 + (z / BOARD_DEPTH) ** 2 * 7; matrix.compose(new THREE.Vector3(x * scale, -z, y * scale), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale)); mesh.setMatrixAt(count, matrix); const rgb = PIECE_PALETTE[Number(value as TypeId) % PIECE_PALETTE.length]!; color.setRGB(rgb[0], rgb[1], rgb[2]); mesh.setColorAt(count, color); count += 1;
  }
  mesh.count = count; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}
