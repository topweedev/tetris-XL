import * as THREE from 'three';
import type { TypeId, RotationStateId } from '@engine/types';
import { ROTATION_STATES, unpackCells } from '@engine/pieces/rotations';
import type { RenderPreset } from './theme';
import { ACTIVE_FILL_ALPHA_BY_PRESET, ACTIVE_OUTLINE_COLOR } from './constants';

const activeAlpha = (preset: RenderPreset): number => ACTIVE_FILL_ALPHA_BY_PRESET[preset];
function stateCells(typeId: TypeId, rotationStateId: RotationStateId) { const states = ROTATION_STATES[Number(typeId)]!; const state = states.find((candidate) => Number(candidate.stateId) === Number(rotationStateId)) ?? states[0]!; return unpackCells(state); }

export function createActivePieceMesh(typeId: TypeId, rotationStateId: RotationStateId, preset: RenderPreset): THREE.Group {
  const group = new THREE.Group();
  for (const [x, y, z] of stateCells(typeId, rotationStateId)) {
    const cell = new THREE.Group();
    const fill = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: ACTIVE_OUTLINE_COLOR, transparent: true, opacity: activeAlpha(preset), depthTest: true, depthWrite: false }));
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(fill.geometry), new THREE.LineBasicMaterial({ color: ACTIVE_OUTLINE_COLOR, transparent: true, opacity: 0.7, depthTest: true, depthWrite: false }));
    cell.add(fill, outline); cell.position.set(x, y, z); group.add(cell);
  }
  group.renderOrder = 3; return group;
}

export function updateActivePieceTransform(group: THREE.Group, position: THREE.Vector3, rotationStateId: RotationStateId): void { group.position.copy(position); group.userData['rotationStateId'] = rotationStateId; }
