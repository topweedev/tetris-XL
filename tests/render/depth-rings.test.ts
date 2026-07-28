import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createDepthRings } from '../../src/render/depth-rings';

describe('depth rings', () => {
  it('creates eleven rings, rim and floor, with a dashed z=10 warning', () => {
    const group = createDepthRings();
    expect(group.children).toHaveLength(13);
    expect((group.children[9] as THREE.Line).material).toBeInstanceOf(THREE.LineDashedMaterial);
  });
});
