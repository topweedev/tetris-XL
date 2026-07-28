import * as THREE from 'three';

export const BOARD_WIDTH = 5;
export const BOARD_HEIGHT = 5;
export const BOARD_DEPTH = 12;
export const WELL_TILT = THREE.MathUtils.degToRad(-5);
export const BASE_WALL_ALPHA = 0.28;
export const FADE_NEAR_OFFSET = 0.5;
export const FADE_FAR_OFFSET = 2.5;

export interface SceneBundle {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  resize: () => void;
  dispose: () => void;
}

const wallColor = new THREE.Color(0x63788c);
const rimColor = new THREE.Color(0x8fa6b8);
const warningColor = new THREE.Color(0xff5364);

function depthScale(z: number): number {
  return 1 + (z / BOARD_DEPTH) ** 2 * 7;
}

function wallMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uZWallNear: { value: 0 },
      uFadeNearOffset: { value: FADE_NEAR_OFFSET },
      uFadeFarOffset: { value: FADE_FAR_OFFSET },
      uWallColor: { value: wallColor },
      uBaseAlpha: { value: BASE_WALL_ALPHA },
    },
    vertexShader: `varying float vZCam;
      void main() {
        vec4 cameraPosition = modelViewMatrix * vec4(position, 1.0);
        vZCam = -cameraPosition.z;
        gl_Position = projectionMatrix * cameraPosition;
      }`,
    fragmentShader: `uniform float uZWallNear;
      uniform float uFadeNearOffset;
      uniform float uFadeFarOffset;
      uniform vec3 uWallColor;
      uniform float uBaseAlpha;
      varying float vZCam;
      void main() {
        float dist = abs(vZCam) - uZWallNear;
        float fade = smoothstep(uFadeNearOffset, uFadeFarOffset, dist);
        gl_FragColor = vec4(uWallColor, uBaseAlpha * fade);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export function bakeZWallNear(camera: THREE.Camera, walls: THREE.Object3D[]): number {
  camera.updateMatrixWorld();
  const cameraMatrix = camera.matrixWorldInverse;
  const vertex = new THREE.Vector3();
  let near = Number.POSITIVE_INFINITY;
  for (const wall of walls) {
    const geometry = (wall as THREE.Mesh).geometry as THREE.BufferGeometry;
    const position = geometry.getAttribute('position');
    wall.updateMatrixWorld(true);
    for (let i = 0; i < position.count; i += 1) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(wall.matrixWorld).applyMatrix4(cameraMatrix);
      near = Math.min(near, Math.abs(vertex.z));
    }
  }
  return near;
}

function makeWall(geometry: THREE.PlaneGeometry, material: THREE.ShaderMaterial): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 0;
  return mesh;
}

function ring(z: number, color: THREE.Color, dashed = false): THREE.Line {
  const size = depthScale(z) * BOARD_WIDTH;
  const points = [
    new THREE.Vector3(-size / 2, -z, -size / 2),
    new THREE.Vector3(size / 2, -z, -size / 2),
    new THREE.Vector3(size / 2, -z, size / 2),
    new THREE.Vector3(-size / 2, -z, size / 2),
    new THREE.Vector3(-size / 2, -z, -size / 2),
  ];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = dashed
    ? new THREE.LineDashedMaterial({ color, dashSize: 0.3, gapSize: 0.3, linewidth: 1, transparent: true, depthWrite: false })
    : new THREE.LineBasicMaterial({ color, transparent: true, depthWrite: false });
  const line = dashed ? new THREE.Line(geometry, material) : new THREE.Line(geometry, material);
  if (dashed) line.computeLineDistances();
  line.renderOrder = 0;
  return line;
}

function createWell(camera?: THREE.Camera): THREE.Group {
  const well = new THREE.Group();
  const material = wallMaterial();
  const half = BOARD_WIDTH / 2;
  const wallHeight = BOARD_DEPTH;
  const walls = [
    new THREE.Mesh(new THREE.PlaneGeometry(BOARD_WIDTH, wallHeight, 1, BOARD_DEPTH), material),
    new THREE.Mesh(new THREE.PlaneGeometry(BOARD_WIDTH, wallHeight, 1, BOARD_DEPTH), material),
    new THREE.Mesh(new THREE.PlaneGeometry(BOARD_WIDTH, wallHeight, 1, BOARD_DEPTH), material),
    new THREE.Mesh(new THREE.PlaneGeometry(BOARD_WIDTH, wallHeight, 1, BOARD_DEPTH), material),
  ];
  walls[0].rotation.y = Math.PI;
  walls[0].position.set(0, -half, -half);
  walls[1].rotation.y = Math.PI / 2;
  walls[1].position.set(-half, -half, 0);
  walls[2].rotation.y = -Math.PI / 2;
  walls[2].position.set(half, -half, 0);
  walls[3].position.set(0, -half, half);
  const createdWalls: THREE.Mesh[] = [];
  for (const wall of walls) {
    const baked = makeWall(wall.geometry as THREE.PlaneGeometry, material);
    baked.position.copy(wall.position);
    baked.rotation.copy(wall.rotation);
    well.add(baked);
    createdWalls.push(baked);
    wall.geometry.dispose();
  }
  if (camera) {
    well.updateMatrixWorld(true);
    const zWallNear = bakeZWallNear(camera, createdWalls);
    material.uniforms.uZWallNear.value = zWallNear;
  }
  for (let z = 1; z <= BOARD_DEPTH - 1; z += 1) well.add(ring(z, z === 10 ? warningColor : rimColor, z === 10));
  well.add(ring(BOARD_DEPTH, rimColor));
  well.add(ring(0, rimColor));
  return well;
}

export function createScene(container: HTMLElement): SceneBundle {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x071018);
  const aspect = Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1);
  const camera = new THREE.OrthographicCamera(-8 * aspect, 8 * aspect, 8, -8, 0.1, 100);
  camera.position.set(0, 9, 18);
  camera.rotation.x = WELL_TILT;
  camera.lookAt(0, -BOARD_DEPTH / 2, 0);
  scene.add(camera);
  scene.add(createWell(camera));
  scene.add(new THREE.AmbientLight(0xffffff, 1));
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  const resize = (): void => {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    const nextAspect = width / height;
    camera.left = -8 * nextAspect;
    camera.right = 8 * nextAspect;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  window.addEventListener('resize', resize);
  resize();
  return { scene, camera, renderer, resize, dispose: () => { window.removeEventListener('resize', resize); scene.traverse((object) => { const mesh = object as THREE.Mesh; mesh.geometry?.dispose(); if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose()); else mesh.material?.dispose(); }); renderer.dispose(); renderer.domElement.remove(); } };
}
