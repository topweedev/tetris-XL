import * as THREE from 'three';
import { BOARD_DEPTH, CAMERA_HEIGHT, WELL_TILT_DEGREES } from './constants';
import { createDepthRings } from './depth-rings';
import { createWell } from './well';
export interface SceneBundle { scene: THREE.Scene; camera: THREE.OrthographicCamera; renderer: THREE.WebGLRenderer; resize: () => void; dispose: () => void; }
function disposeGroup(group: THREE.Object3D): void { const materials = new Set<THREE.Material>(); group.traverse((object) => { const mesh = object as THREE.Mesh; mesh.geometry?.dispose(); const mats = Array.isArray(mesh.material) ? mesh.material : (mesh.material ? [mesh.material] : []); mats.forEach((material) => materials.add(material)); }); materials.forEach((material) => material.dispose()); }
export function createScene(container: HTMLElement): SceneBundle {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x071018);
  const aspect = Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1);
  const camera = new THREE.OrthographicCamera(-8 * aspect, 8 * aspect, 8, -8, 0.1, 100);
  camera.position.set(0, CAMERA_HEIGHT, 0); camera.up.set(0, 0, -1); camera.lookAt(0, -BOARD_DEPTH / 2, 0); camera.rotateX(THREE.MathUtils.degToRad(WELL_TILT_DEGREES)); camera.updateMatrixWorld();
  let well = createWell(camera); let rings = createDepthRings(); scene.add(well); scene.add(rings);
  // TODO(M4-P4.1c): wire theme.subscribe for well and active/locked/ghost live preset updates.
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2)); container.appendChild(renderer.domElement);
  const onContextLost = (event: Event): void => { event.preventDefault(); };
  const onContextRestored = (): void => { disposeGroup(well); disposeGroup(rings); scene.remove(well, rings); well = createWell(camera); rings = createDepthRings(); scene.add(well, rings); };
  const resize = (): void => { const width = Math.max(container.clientWidth, 1); const height = Math.max(container.clientHeight, 1); const nextAspect = width / height; camera.left = -8 * nextAspect; camera.right = 8 * nextAspect; camera.updateProjectionMatrix(); renderer.setSize(width, height, false); }; globalThis.addEventListener('resize', resize); renderer.domElement.addEventListener('webglcontextlost', onContextLost); renderer.domElement.addEventListener('webglcontextrestored', onContextRestored); resize();
  return { scene, camera, renderer, resize, dispose: () => { globalThis.removeEventListener('resize', resize); renderer.domElement.removeEventListener('webglcontextlost', onContextLost); renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored); disposeGroup(well); disposeGroup(rings); renderer.dispose(); renderer.domElement.remove(); } };
}
