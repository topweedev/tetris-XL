import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { createWell } from '../../src/render/well';
import { DEPTH_SEGMENTS } from '../../src/render/constants';

describe('well geometry', () => {
  it('uses twelve vertical segments and twenty-six vertices per wall', () => {
    const group = createWell();
    expect(group.children).toHaveLength(4);
    for (const child of group.children) {
      const mesh = child as THREE.Mesh;
      expect(mesh.geometry.getAttribute('position').count).toBe(2 * (DEPTH_SEGMENTS + 1));
    }
  });
});
