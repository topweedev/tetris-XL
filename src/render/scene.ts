import * as THREE from 'three';
import { BOARD_DEPTH, WELL_TILT_DEGREES } from './constants';
import { createDepthRings } from './depth-rings';
import { createWell } from './well';
export interface SceneBundle { scene: THREE.Scene; camera: THREE.OrthographicCamera; renderer: THREE.WebGLRenderer; resize: () => void; dispose: () => void; }
export function createScene(container: HTMLElement): SceneBundle {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x071018);
  const aspect = Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1);
  const camera = new THREE.OrthographicCamera(-8 * aspect, 8 * aspect, 8, -8, 0.1, 100);
  camera.position.set(0, -BOARD_DEPTH / 2, 18); camera.rotation.x = THREE.MathUtils.degToRad(WELL_TILT_DEGREES);
  scene.add(camera); scene.add(createWell(camera)); scene.add(createDepthRings()); scene.add(new THREE.AmbientLight(0xffffff, 1));
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2)); container.appendChild(renderer.domElement);
  const resize = (): void => { const width = Math.max(container.clientWidth, 1); const height = Math.max(container.clientHeight, 1); const nextAspect = width / height; camera.left = -8 * nextAspect; camera.right = 8 * nextAspect; camera.updateProjectionMatrix(); renderer.setSize(width, height, false); }; globalThis.addEventListener('resize', resize); resize();
  return { scene, camera, renderer, resize, dispose: () => { globalThis.removeEventListener('resize', resize); scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); if (Array.isArray(m.material)) m.material.forEach((x) => x.dispose()); else m.material?.dispose(); }); renderer.dispose(); renderer.domElement.remove(); } };
}
