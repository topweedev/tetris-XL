import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createWell } from '../../src/render/well';
import { BASE_WALL_ALPHA, DEPTH_SEGMENTS } from '../../src/render/constants';

describe('well geometry', () => {
  it('uses twelve vertical segments and twenty-six vertices per wall', () => {
    const group = createWell();
    expect(group.children).toHaveLength(4);
    for (const child of group.children) {
      const mesh = child as THREE.Mesh;
      expect(mesh.geometry.getAttribute('position').count).toBe(2 * (DEPTH_SEGMENTS + 1));
    }
  });
  it('bakes RGBA depth fade from transparent near to baseline far', () => {
    const camera = new THREE.OrthographicCamera(-8, 8, 8, -8, 0.1, 100); camera.position.set(0, 20, 0); camera.up.set(0, 0, -1); camera.lookAt(0, -6, 0); camera.rotateX(THREE.MathUtils.degToRad(-5)); camera.updateMatrixWorld();
    const group = createWell(camera); const color = group.children[0] as THREE.Mesh; const attr = color.geometry.getAttribute('color');
    expect(attr.itemSize).toBe(4); const alpha = Array.from(attr.array as Float32Array).filter((_, i) => i % 4 === 3) as number[];
    expect(Math.min(...alpha)).toBeCloseTo(0, 5); expect(Math.max(...alpha)).toBeCloseTo(BASE_WALL_ALPHA, 5);
  });
});
