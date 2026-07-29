import * as THREE from 'three';
import type { TypeId, RotationStateId } from '@engine/types';
import { unpackCells } from '@engine/pieces/rotations';
import { findRotationState } from './rotation-state';
import type { RenderPreset } from './theme';
import { ACTIVE_FILL_ALPHA_BY_PRESET, ACTIVE_OUTLINE_COLOR, PIECE_PALETTE } from './constants';
import { boardToRenderVec3, depthScale } from './coords';

const activeAlpha = (preset: RenderPreset): number => ACTIVE_FILL_ALPHA_BY_PRESET[preset];
function stateCells(typeId: TypeId, rotationStateId: RotationStateId) { return unpackCells(findRotationState(typeId, rotationStateId)); }

export function createActivePieceMesh(typeId: TypeId, rotationStateId: RotationStateId, preset: RenderPreset): THREE.Group {
  const group = new THREE.Group();
  const box = new THREE.BoxGeometry(1, 1, 1); const edges = new THREE.EdgesGeometry(box);
  const rgb = PIECE_PALETTE[Number(typeId)]!; const fillColor = new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2]);
  const fillMaterial = new THREE.MeshBasicMaterial({ color: fillColor, transparent: true, opacity: activeAlpha(preset), depthTest: true, depthWrite: false });
  const outlineMaterial = new THREE.LineBasicMaterial({ color: ACTIVE_OUTLINE_COLOR, transparent: true, opacity: 0.7, depthTest: true, depthWrite: false });
  for (const [x, y, z] of stateCells(typeId, rotationStateId)) {
    const cell = new THREE.Group();
    const fill = new THREE.Mesh(box, fillMaterial); const outline = new THREE.LineSegments(edges, outlineMaterial);
    fill.renderOrder = 3; outline.renderOrder = 3; cell.add(fill, outline); cell.position.set(x, -z, y); group.add(cell);
  }
  group.userData['typeId'] = typeId; group.userData['rotationStateId'] = rotationStateId; group.renderOrder = 3; return group;
}

export function updateActivePieceTransform(group: THREE.Group, boardPosition: THREE.Vector3, rotationStateId: RotationStateId): void { const typeId = group.userData['typeId'] as TypeId; const cells = stateCells(typeId, rotationStateId); group.position.set(0, 0, 0); group.scale.set(1, 1, 1); cells.forEach(([cx, cy, cz], index) => { const child = group.children[index]; if (!child) return; const bz = boardPosition.z + cz; boardToRenderVec3(child.position, boardPosition.x + cx, boardPosition.y + cy, bz); const scale = depthScale(bz); child.scale.set(scale, 1, scale); }); group.children.forEach((child, index) => { child.visible = index < cells.length; }); group.userData['rotationStateId'] = rotationStateId; }
