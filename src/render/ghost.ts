import * as THREE from 'three';
import type { BoardArray, Piece, RotationStateId, TypeId } from '@engine/types';
import { hasCollision } from '@engine/core/collision';
import { ROTATION_STATES, unpackCells } from '@engine/pieces/rotations';
import { GHOST_DASH } from './constants';

export function createGhostMesh(typeId: TypeId, rotationStateId: RotationStateId): THREE.LineSegments {
  const state = ROTATION_STATES[Number(typeId)]!.find((candidate) => Number(candidate.stateId) === Number(rotationStateId)) ?? ROTATION_STATES[Number(typeId)]![0]!;
  const positions: number[] = []; for (const [x, y, z] of unpackCells(state)) { for (const [a, b] of [[[x - .5, y - .5, z - .5], [x + .5, y - .5, z - .5]], [[x + .5, y - .5, z - .5], [x + .5, y + .5, z - .5]], [[x + .5, y + .5, z - .5], [x - .5, y + .5, z - .5]], [[x - .5, y + .5, z - .5], [x - .5, y - .5, z - .5]] ] as const) positions.push(...a, ...b); }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); const material = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: GHOST_DASH[0], gapSize: GHOST_DASH[1], transparent: true, opacity: 0.72, depthTest: true, depthWrite: false }); const mesh = new THREE.LineSegments(geometry, material); mesh.computeLineDistances(); mesh.renderOrder = 2; return mesh;
}
export function updateGhostTransform(mesh: THREE.LineSegments, activePiece: Pick<Piece, 'anchor' | 'typeId' | 'rotationStateId'>, board: BoardArray): void { const state = ROTATION_STATES[Number(activePiece.typeId)]!.find((candidate) => Number(candidate.stateId) === Number(activePiece.rotationStateId)) ?? ROTATION_STATES[Number(activePiece.typeId)]![0]!; const cells = unpackCells(state); const anchor: [number, number, number] = [activePiece.anchor[0]!, activePiece.anchor[1]!, activePiece.anchor[2]!]; while (!hasCollision(board, cells, [anchor[0], anchor[1], anchor[2] - 1], activePiece.typeId)) anchor[2] -= 1; mesh.position.set(anchor[0], anchor[1], anchor[2]); }
