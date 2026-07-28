import * as THREE from 'three';
import { BASE_WALL_ALPHA, BOARD_DEPTH, BOARD_WIDTH, DEPTH_SEGMENTS, FADE_FAR_OFFSET, FADE_NEAR_OFFSET } from './constants';

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

function material(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uZWallNear: { value: 0 }, uFadeNearOffset: { value: FADE_NEAR_OFFSET }, uFadeFarOffset: { value: FADE_FAR_OFFSET }, uWallColor: { value: WALL_COLOR }, uBaseAlpha: { value: BASE_WALL_ALPHA } },
    vertexShader: 'varying float vZCam; void main(){ vec4 p=modelViewMatrix*vec4(position,1.0); vZCam=-p.z; gl_Position=projectionMatrix*p; }',
    fragmentShader: 'uniform float uZWallNear; uniform float uFadeNearOffset; uniform float uFadeFarOffset; uniform vec3 uWallColor; uniform float uBaseAlpha; varying float vZCam; void main(){ float d=abs(vZCam)-uZWallNear; float f=smoothstep(uFadeNearOffset,uFadeFarOffset,d); gl_FragColor=vec4(uWallColor,uBaseAlpha*f); }',
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
}

export function createWell(camera?: THREE.Camera): THREE.Group {
  const group = new THREE.Group();
  const shared = material();
  const half = BOARD_WIDTH / 2;
  const specs: [number, number, number, number, number][] = [
    [0, -BOARD_DEPTH / 2, -half, 0, Math.PI], [ -half, -BOARD_DEPTH / 2, 0, 0, Math.PI / 2 ],
    [half, -BOARD_DEPTH / 2, 0, 0, -Math.PI / 2], [0, -BOARD_DEPTH / 2, half, 0, 0],
  ];
  const walls = specs.map(([x, y, z, rx, ry]) => { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_WIDTH, BOARD_DEPTH, 1, DEPTH_SEGMENTS), shared); mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, 0); group.add(mesh); return mesh; });
  if (camera) shared.uniforms['uZWallNear']!.value = bakeZWallNear(camera, walls);
  return group;
}
