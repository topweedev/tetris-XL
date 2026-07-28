import * as THREE from 'three';
import { BASE_WALL_ALPHA, BOARD_DEPTH, BOARD_WIDTH, DEPTH_SEGMENTS, FADE_FAR_OFFSET, FADE_NEAR_OFFSET } from './constants';
import { getPreset } from './theme';

const WALL_COLOR = new THREE.Color(0x63788c);

export function bakeZWallNear(camera: THREE.Camera, walls: THREE.Object3D[]): number {
  camera.updateMatrixWorld();
  const point = new THREE.Vector3();
  let near = Number.POSITIVE_INFINITY;
  for (const wall of walls) {
    wall.updateMatrixWorld(true);
    const position = ((wall as THREE.Mesh).geometry as THREE.BufferGeometry).getAttribute('position');
    for (let i = 0; i < position.count; i += 1) {
      point.fromBufferAttribute(position, i).applyMatrix4(wall.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
      near = Math.min(near, Math.abs(point.z));
    }
  }
  return near;
}

export function createWell(camera?: THREE.Camera): THREE.Group {
  const group = new THREE.Group();
  const preset = getPreset();
  const alpha = preset === 'high-contrast' ? BASE_WALL_ALPHA * 0.54 : BASE_WALL_ALPHA;
  const half = BOARD_WIDTH / 2;
  const specs: [number, number, number, number, number][] = [
    [0, -BOARD_DEPTH / 2, -half, 0, Math.PI], [ -half, -BOARD_DEPTH / 2, 0, 0, Math.PI / 2 ],
    [half, -BOARD_DEPTH / 2, 0, 0, -Math.PI / 2], [0, -BOARD_DEPTH / 2, half, 0, 0],
  ];
  const walls = specs.map(([x, y, z, rx, ry]) => { const geometry = new THREE.PlaneGeometry(BOARD_WIDTH, BOARD_DEPTH, 1, DEPTH_SEGMENTS); const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: WALL_COLOR, transparent: true, opacity: 1, vertexColors: true, depthWrite: false, side: THREE.FrontSide })); mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, 0); group.add(mesh); return mesh; });
  if (camera) { const zWallNear = bakeZWallNear(camera, walls); for (const wall of walls) { const position = wall.geometry.getAttribute('position'); const colors = new Float32Array(position.count * 4); for (let i = 0; i < position.count; i += 1) { const point = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(wall.matrixWorld).applyMatrix4(camera.matrixWorldInverse); const fade = THREE.MathUtils.smoothstep(Math.abs(point.z) - zWallNear, FADE_NEAR_OFFSET, FADE_FAR_OFFSET); colors.set([WALL_COLOR.r, WALL_COLOR.g, WALL_COLOR.b, fade * alpha], i * 4); } wall.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4)); } }
  return group;
}
