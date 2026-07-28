import * as THREE from 'three';
import { BOARD_DEPTH, BOARD_WIDTH } from './constants';
import type { TypeId } from '@engine/types';

export const MAX_INSTANCES = BOARD_WIDTH * BOARD_WIDTH * BOARD_DEPTH;
const palette = [0x39e6cf, 0xffb454, 0x6da8ff, 0xff6f91, 0xb58cff, 0x7de38d, 0xff8f5a, 0xe8e26b, 0x57c7d9, 0xd98cff, 0xff789f, 0x9bd36a];

export function createLockedMesh(): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ vertexColors: true, depthTest: true, depthWrite: true }), MAX_INSTANCES);
  mesh.count = 0; mesh.renderOrder = 1; return mesh;
}

export function updateLockedMesh(mesh: THREE.InstancedMesh, board: Uint8Array): void {
  const matrix = new THREE.Matrix4(); const color = new THREE.Color(); let count = 0;
  for (let z = 0; z < BOARD_DEPTH; z += 1) for (let y = 0; y < BOARD_WIDTH; y += 1) for (let x = 0; x < BOARD_WIDTH; x += 1) {
    const value = board[x + y * BOARD_WIDTH + z * BOARD_WIDTH * BOARD_WIDTH]; if (!value) continue;
    const scale = 1 + (z / BOARD_DEPTH) ** 2 * 7; matrix.compose(new THREE.Vector3(x * scale, -z, y * scale), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale)); mesh.setMatrixAt(count, matrix); color.setHex(palette[(Number(value as TypeId)) % palette.length]!); mesh.setColorAt(count, color); count += 1;
  }
  mesh.count = count; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}
