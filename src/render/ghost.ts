import * as THREE from 'three';
import type { BoardArray, Piece, RotationStateId, TypeId } from '@engine/types';
import { hasCollision } from '@engine/core/collision';
import { unpackCells } from '@engine/pieces/rotations';
import type { CellTuple } from '@engine/pieces/definitions';
import { findRotationState } from './rotation-state';
import { GHOST_DASH } from './constants';
import { boardToRenderVec3, depthScale } from './coords';

const CELL_EDGES = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]] as const;
const collisionAnchor: [number, number, number] = [0, 0, 0];
const vertexKey = (vertex: readonly number[]): string => vertex.join(',');
export function createGhostMesh(typeId: TypeId, rotationStateId: RotationStateId): THREE.LineSegments {
  const cells = unpackCells(findRotationState(typeId, rotationStateId)); const uniqueEdges = new Map<string, readonly [readonly number[], readonly number[]]>();
  for (const [x, y, z] of cells) { const vertices = [[x-.5,-z+.5,y-.5],[x+.5,-z+.5,y-.5],[x+.5,-z+.5,y+.5],[x-.5,-z+.5,y+.5],[x-.5,-z-.5,y-.5],[x+.5,-z-.5,y-.5],[x+.5,-z-.5,y+.5],[x-.5,-z-.5,y+.5]]; for (const [a, b] of CELL_EDGES) { const edge = [vertices[a]!, vertices[b]!] as const; const keys = edge.map(vertexKey).sort(); uniqueEdges.set(keys.join('|'), edge); } }
  const positions: number[] = []; for (const [a, b] of uniqueEdges.values()) positions.push(...a, ...b);
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); const material = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: GHOST_DASH[0], gapSize: GHOST_DASH[1], transparent: true, opacity: 0.72, depthTest: true, depthWrite: false }); const mesh = new THREE.LineSegments(geometry, material); mesh.computeLineDistances(); mesh.renderOrder = 2; mesh.userData['typeId'] = typeId; mesh.userData['rotationStateId'] = rotationStateId; mesh.userData['cells'] = cells; return mesh;
}
export function updateGhostTransform(mesh: THREE.LineSegments, activePiece: Pick<Piece, 'anchor' | 'typeId' | 'rotationStateId'>, board: BoardArray): void { if (mesh.userData['typeId'] !== activePiece.typeId || mesh.userData['rotationStateId'] !== activePiece.rotationStateId) throw new Error('ghost geometry does not match active piece'); const cells = mesh.userData['cells'] as readonly CellTuple[]; collisionAnchor[0] = activePiece.anchor[0]!; collisionAnchor[1] = activePiece.anchor[1]!; collisionAnchor[2] = activePiece.anchor[2]!; let remaining = 20; while (remaining > 0) { collisionAnchor[2] -= 1; if (hasCollision(board, cells, collisionAnchor, activePiece.typeId)) { collisionAnchor[2] += 1; break; } remaining -= 1; } boardToRenderVec3(mesh.position, collisionAnchor[0], collisionAnchor[1], collisionAnchor[2]); const scale = depthScale(collisionAnchor[2]); mesh.scale.set(scale, 1, scale); }
