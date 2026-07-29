import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createActivePieceMesh, updateActivePieceTransform } from '../../src/render/piece';
import { PIECE_PALETTE } from '../../src/render/constants';
import { depthScale } from '../../src/render/coords';
import { typeId, rotationStateId } from '../../src/engine/types';
describe('active piece renderer', () => { it('uses palette fill, child order, and preset alpha for all typeIds', () => { for (let i = 0; i < 12; i += 1) { const group = createActivePieceMesh(typeId(i), rotationStateId(0), 'translucent'); for (const cell of group.children) for (const child of cell.children) expect(child.renderOrder).toBe(3); const fill = group.children[0]!.children[0] as THREE.Mesh; const material = fill.material as THREE.MeshBasicMaterial; expect(material.opacity).toBe(0.58); expect(material.color.toArray()).toEqual(PIECE_PALETTE[i]); } }); it('maps z11 edge anchor inside the scaled well', () => { const group = createActivePieceMesh(typeId(0), rotationStateId(0), 'high-contrast'); updateActivePieceTransform(group, new THREE.Vector3(4, 4, 11), rotationStateId(0)); expect(group.position.x).toBeCloseTo(2 * depthScale(11)); expect(group.position.z).toBeCloseTo(2 * depthScale(11)); expect(group.position.y).toBe(-11); expect(group.scale.y).toBe(1); }); });
