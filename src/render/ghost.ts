import * as THREE from 'three';
import type { BoardArray, Piece, RotationStateId, TypeId } from '@engine/types';
import { hasCollision } from '@engine/core/collision';
import { unpackCells } from '@engine/pieces/rotations';
import type { CellTuple } from '@engine/pieces/definitions';
import { findRotationState } from './rotation-state';
import { GHOST_DASH } from './constants';
import { boardToRenderVec3, depthScale } from './coords';

const collisionAnchor: [number, number, number] = [0, 0, 0];
export function createGhostMesh(typeId: TypeId, rotationStateId: RotationStateId): THREE.Group { const cells = unpackCells(findRotationState(typeId, rotationStateId)); const group = new THREE.Group(); const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)); const material = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: GHOST_DASH[0], gapSize: GHOST_DASH[1], transparent: true, opacity: 0.72, depthTest: true, depthWrite: false }); for (const cell of cells) { const wireframe = new THREE.LineSegments(geometry, material); wireframe.computeLineDistances(); wireframe.renderOrder = 2; wireframe.userData['cell'] = cell; group.add(wireframe); } group.renderOrder = 2; group.userData['typeId'] = typeId; group.userData['rotationStateId'] = rotationStateId; group.userData['cells'] = cells; return group; }
export function updateGhostTransform(group: THREE.Group, activePiece: Pick<Piece, 'anchor' | 'typeId' | 'rotationStateId'>, board: BoardArray): void { if (group.userData['typeId'] !== activePiece.typeId || group.userData['rotationStateId'] !== activePiece.rotationStateId) throw new Error('ghost geometry does not match active piece'); const cells = group.userData['cells'] as readonly CellTuple[]; collisionAnchor[0] = activePiece.anchor[0]!; collisionAnchor[1] = activePiece.anchor[1]!; collisionAnchor[2] = activePiece.anchor[2]!; let remaining = 20; while (remaining > 0) { collisionAnchor[2] -= 1; if (hasCollision(board, cells, collisionAnchor, activePiece.typeId)) { collisionAnchor[2] += 1; break; } remaining -= 1; } group.position.set(0, 0, 0); group.scale.set(1, 1, 1); group.children.forEach((child, index) => { const cell = cells[index]!; const bz = collisionAnchor[2] + cell[2]; boardToRenderVec3(child.position, collisionAnchor[0] + cell[0], collisionAnchor[1] + cell[1], bz); const scale = depthScale(bz); child.scale.set(scale, 1, scale); }); }
