import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createActivePieceMesh, updateActiveFillAlpha } from '../../src/render/piece';
import { createWell, updateWellPreset } from '../../src/render/well';
import { rotationStateId, typeId } from '../../src/engine/types';

function camera(): THREE.OrthographicCamera {
  const value = new THREE.OrthographicCamera(-8, 8, 8, -8, 0.1, 100);
  value.position.set(0, 20, 0); value.up.set(0, 0, -1); value.lookAt(0, -6, 0); value.updateMatrixWorld();
  return value;
}

describe('theme live mutation helpers', () => {
  it('reuses well RGBA attributes while rebaking alpha', () => {
    const view = camera();
    const well = createWell(view);
    const wall = well.children[0] as THREE.Mesh;
    const before = wall.geometry.getAttribute('color') as THREE.BufferAttribute;
    const version = before.version;
    updateWellPreset(well, view, 'high-contrast');
    expect(wall.geometry.getAttribute('color')).toBe(before);
    expect(before.version).toBeGreaterThan(version);
  });
  it('updates active fill opacity without replacing its material', () => {
    const piece = createActivePieceMesh(typeId(0), rotationStateId(0), 'translucent');
    const fill = (piece.children[0] as THREE.Group).children[0] as THREE.Mesh;
    const material = fill.material as THREE.MeshBasicMaterial;
    updateActiveFillAlpha(piece, 'opaque-fallback');
    expect(fill.material).toBe(material);
    expect(material.opacity).toBe(0.92);
  });
});
