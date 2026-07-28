import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BOARD_DEPTH } from '../../src/render/constants';
import { createScene } from '../../src/render/scene';

vi.mock('three', async () => ({ ...(await vi.importActual<typeof THREE>('three')), WebGLRenderer: class { domElement = { width: 0, height: 0, addEventListener: vi.fn(), removeEventListener: vi.fn(), remove: vi.fn() } as unknown as HTMLCanvasElement; setPixelRatio = vi.fn(); setSize = vi.fn((w: number, h: number) => { this.domElement.width = w; this.domElement.height = h; }); dispose = vi.fn(); } }));

type Root = { clientWidth: number; clientHeight: number; children: unknown[]; appendChild(node: unknown): void; removeChild(node: unknown): void };
const container = (): HTMLElement => { const root: Root = { clientWidth: 800, clientHeight: 600, children: [], appendChild(node) { root.children.push(node); (node as { remove?: () => void }).remove = () => root.removeChild(node); }, removeChild(node) { root.children = root.children.filter((child) => child !== node); } }; return root as unknown as HTMLElement; };

describe('createScene lifecycle', () => {
  beforeEach(() => { Object.defineProperty(globalThis, 'addEventListener', { value: vi.fn(), configurable: true }); Object.defineProperty(globalThis, 'removeEventListener', { value: vi.fn(), configurable: true }); });
  it('guards the canonical near-vertical camera pose', () => { const bundle = createScene(container()); const aim = new THREE.Vector3(0, 0, -1).applyQuaternion(bundle.camera.quaternion).normalize(); expect(bundle.camera.up.equals(new THREE.Vector3(0, 0, -1))).toBe(true); expect(bundle.camera.position.y).toBeGreaterThanOrEqual(BOARD_DEPTH); expect(Math.abs(aim.y)).toBeGreaterThan(0.99); expect(aim.y).toBeCloseTo(-Math.cos(Math.PI / 36), 3); expect(aim.z).toBeCloseTo(Math.sin(Math.PI / 36), 3); bundle.dispose(); });
  it('keeps camera out of scene and cleans up canvas on dispose', () => { const root = container(); const bundle = createScene(root); expect(bundle.scene.children.every((child) => child !== bundle.camera)).toBe(true); expect(bundle.scene.children).toHaveLength(2); const before = root.children.length; bundle.resize(); const size = [bundle.renderer.domElement.width, bundle.renderer.domElement.height]; bundle.resize(); expect([bundle.renderer.domElement.width, bundle.renderer.domElement.height]).toEqual(size); bundle.dispose(); expect(root.children.length).toBe(before - 1); });
});
