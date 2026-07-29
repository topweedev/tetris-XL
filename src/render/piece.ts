import * as THREE from 'three';
import type { TypeId, RotationStateId } from '@engine/types';
import { unpackCells } from '@engine/pieces/rotations';
import { findRotationState } from './rotation-state';
import type { RenderPreset } from './theme';
import { ACTIVE_FILL_ALPHA_BY_PRESET, ACTIVE_OUTLINE_COLOR } from './constants';
import { boardToRenderVec3, depthScale } from './coords';

const activeAlpha = (preset: RenderPreset): number => ACTIVE_FILL_ALPHA_BY_PRESET[preset];
function stateCells(typeId: TypeId, rotationStateId: RotationStateId) { return unpackCells(findRotationState(typeId, rotationStateId)); }

export function createActivePieceMesh(typeId: TypeId, rotationStateId: RotationStateId, preset: RenderPreset): THREE.Group {
  const group = new THREE.Group();
  const box = new THREE.BoxGeometry(1, 1, 1); const edges = new THREE.EdgesGeometry(box);
  const fillMaterial = new THREE.MeshBasicMaterial({ color: ACTIVE_OUTLINE_COLOR, transparent: true, opacity: activeAlpha(preset), depthTest: true, depthWrite: false });
  const outlineMaterial = new THREE.LineBasicMaterial({ color: ACTIVE_OUTLINE_COLOR, transparent: true, opacity: 0.7, depthTest: true, depthWrite: false });
  for (const [x, y, z] of stateCells(typeId, rotationStateId)) {
    const cell = new THREE.Group();
    const fill = new THREE.Mesh(box, fillMaterial); const outline = new THREE.LineSegments(edges, outlineMaterial);
    fill.renderOrder = 3; outline.renderOrder = 3; cell.add(fill, outline); cell.position.set(x, -z, y); group.add(cell);
  }
  group.userData['typeId'] = typeId; group.userData['rotationStateId'] = rotationStateId; group.renderOrder = 3; return group;
}

export function updateActivePieceTransform(group: THREE.Group, boardPosition: THREE.Vector3, rotationStateId: RotationStateId): void { const typeId = group.userData['typeId'] as TypeId; const cells = stateCells(typeId, rotationStateId); boardToRenderVec3(group.position, boardPosition.x, boardPosition.y, boardPosition.z); const scale = depthScale(boardPosition.z); group.scale.set(scale, 1, scale); cells.forEach(([x, y, z], index) => group.children[index]?.position.set(x, -z, y)); group.children.forEach((child, index) => { child.visible = index < cells.length; }); group.userData['rotationStateId'] = rotationStateId; }
