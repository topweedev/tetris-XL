import * as THREE from 'three';
import { BOARD_DEPTH, CAMERA_HEIGHT, WELL_TILT_DEGREES } from './constants';
import { createDepthRings } from './depth-rings';
import { createWell } from './well';
import { getHighContrastCutaway, getPreset } from './theme';
export interface SceneBundle { scene: THREE.Scene; camera: THREE.OrthographicCamera; renderer: THREE.WebGLRenderer; resize: () => void; dispose: () => void; }
export function createScene(container: HTMLElement): SceneBundle {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x071018);
  const aspect = Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1);
  const camera = new THREE.OrthographicCamera(-8 * aspect, 8 * aspect, 8, -8, 0.1, 100);
  camera.position.set(0, CAMERA_HEIGHT, 0); camera.up.set(0, 0, -1); camera.lookAt(0, -BOARD_DEPTH / 2, 0); camera.rotateX(THREE.MathUtils.degToRad(WELL_TILT_DEGREES)); camera.updateMatrixWorld();
  let well = createWell(camera); let rings = createDepthRings(); scene.add(well); scene.add(rings);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2)); container.appendChild(renderer.domElement);
  const onContextLost = (event: Event): void => { event.preventDefault(); };
  const onContextRestored = (): void => { const materials = new Set<THREE.Material>(); well.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); if (m.material instanceof THREE.Material) materials.add(m.material); }); rings.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); if (m.material instanceof THREE.Material) materials.add(m.material); }); materials.forEach((m) => m.dispose()); scene.remove(well, rings); well = createWell(camera); rings = createDepthRings(); scene.add(well, rings); void getPreset(); void getHighContrastCutaway(); };
  const resize = (): void => { const width = Math.max(container.clientWidth, 1); const height = Math.max(container.clientHeight, 1); const nextAspect = width / height; camera.left = -8 * nextAspect; camera.right = 8 * nextAspect; camera.updateProjectionMatrix(); renderer.setSize(width, height, false); }; globalThis.addEventListener('resize', resize); renderer.domElement.addEventListener('webglcontextlost', onContextLost); renderer.domElement.addEventListener('webglcontextrestored', onContextRestored); resize();
  return { scene, camera, renderer, resize, dispose: () => { globalThis.removeEventListener('resize', resize); renderer.domElement.removeEventListener('webglcontextlost', onContextLost); renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored); scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose()); else m.material?.dispose(); }); renderer.dispose(); renderer.domElement.remove(); } };
}
