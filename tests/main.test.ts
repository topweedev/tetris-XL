import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildBootState } from '../src/engine/core';
import { GameAction } from '../src/engine/types';

const mocks = vi.hoisted(() => ({
  render: vi.fn(), sceneDispose: vi.fn(), hudDispose: vi.fn(), unsubscribe: vi.fn(),
  updateLocked: vi.fn(), updateHud: vi.fn(),
}));

vi.mock('../src/render', async () => {
  const actual = await vi.importActual('../src/render') as object;
  return {
    ...actual,
    createScene: () => ({
      scene: new THREE.Scene(), camera: new THREE.OrthographicCamera(),
      renderer: { render: mocks.render }, resize: vi.fn(), applyPreset: vi.fn(), dispose: mocks.sceneDispose,
    }),
    createHud: () => ({ element: {}, update: vi.fn(), dispose: mocks.hudDispose }),
    createLockedMesh: () => new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 300),
    updateLockedMesh: mocks.updateLocked,
    updateHud: mocks.updateHud,
    subscribe: () => mocks.unsubscribe,
  };
});

import { advanceGameState, bootRenderer, capFrameDelta, MAX_ACCUMULATOR_MS, shouldUpdateLocked, toKeyInputEvent } from '../src/main';

const gameOver = (seed: number) => Object.freeze({ ...buildBootState(seed), fsmState: 'GAME_OVER' as const });

describe('main integration helpers', () => {
  it('uses a fresh seed and sequence for each game-over restart', () => {
    const first = advanceGameState(gameOver(7), [GameAction.Restart], 10, () => 11);
    const second = advanceGameState(gameOver(7), [GameAction.Restart], 11, () => 99);
    expect(first.seed).toBe(11); expect(second.seed).toBe(99);
    expect(first.bagQueue).not.toEqual(second.bagQueue);
  });
  it('keeps deterministic engine stepping for non-restart actions', () => {
    const state = advanceGameState(buildBootState(42), [], 0, () => 99);
    expect(state.seed).toBe(42); expect(state.fsmState).toBe('SPAWN');
  });
  it('does not upload locked cells when no simulation step ran', () => {
    const previous = new Uint8Array(300); const changed = previous.slice(); changed[0] = 1;
    expect(shouldUpdateLocked(false, previous, changed)).toBe(false);
  });
  it('does not upload locked cells when stepped board bytes are unchanged', () => {
    expect(shouldUpdateLocked(true, new Uint8Array(300), new Uint8Array(300))).toBe(false);
  });
  it('uploads locked cells once a stepped board actually changes', () => {
    const previous = new Uint8Array(300); const changed = previous.slice(); changed[299] = 12;
    expect(shouldUpdateLocked(true, previous, changed)).toBe(true);
  });
  it('caps hidden-tab catch-up at 250ms', () => {
    expect(capFrameDelta(1_000)).toBe(MAX_ACCUMULATOR_MS); expect(capFrameDelta(-1)).toBe(0);
  });
  it('maps only game keys and retains Shift for soft drop', () => {
    expect(toKeyInputEvent({ type: 'keydown', code: 'ShiftLeft', ctrlKey: false, altKey: false, metaKey: false, shiftKey: true }))
      .toMatchObject({ type: 'keydown', code: 'ShiftLeft', shiftKey: true });
    expect(toKeyInputEvent({ type: 'keydown', code: 'KeyZ', ctrlKey: false, altKey: false, metaKey: false, shiftKey: false })).toBeNull();
  });
});

describe('bootRenderer lifecycle', () => {
  beforeEach(() => { Object.values(mocks).forEach((mock) => mock.mockClear()); });
  it('boots, advances a fixed frame, renders, and disposes listeners/subscription', () => {
    const root = { textContent: '', ownerDocument: {} } as unknown as HTMLElement;
    const listeners = new Map<string, EventListener>();
    const doc = {
      readyState: 'loading', getElementById: vi.fn(() => root),
      addEventListener: vi.fn((name: string, cb: EventListener) => listeners.set(name, cb)),
      removeEventListener: vi.fn((name: string) => listeners.delete(name)),
    };
    let frame: FrameRequestCallback | undefined;
    Object.defineProperty(globalThis, 'document', { value: doc, configurable: true });
    Object.defineProperty(globalThis, 'crypto', { value: { getRandomValues: (array: Uint32Array) => { array[0] = 123; return array; } }, configurable: true });
    Object.defineProperty(globalThis, 'performance', { value: { now: () => 0 }, configurable: true });
    Object.defineProperty(globalThis, 'requestAnimationFrame', { value: vi.fn((cb: FrameRequestCallback) => { frame = cb; return 1; }), configurable: true });
    Object.defineProperty(globalThis, 'cancelAnimationFrame', { value: vi.fn(), configurable: true });
    Object.defineProperty(globalThis, 'addEventListener', { value: vi.fn((name: string, cb: EventListener) => listeners.set(name, cb)), configurable: true });
    Object.defineProperty(globalThis, 'removeEventListener', { value: vi.fn((name: string) => listeners.delete(name)), configurable: true });

    const runtime = bootRenderer();
    expect(runtime.state().seed).toBe(123);
    frame?.(17);
    expect(runtime.state().fsmState).toBe('SPAWN');
    expect(mocks.render).toHaveBeenCalledOnce();
    expect(mocks.updateLocked).not.toHaveBeenCalled();
    frame?.(34);
    expect(runtime.state().fsmState).toBe('FALLING');
    const preventDefault = vi.fn();
    listeners.get('keydown')?.({ type: 'keydown', code: 'Space', ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, preventDefault } as unknown as Event);
    frame?.(51);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(runtime.state().piece).toBeNull();
    expect(mocks.updateLocked).toHaveBeenCalledOnce();
    listeners.get('beforeunload')?.(new Event('beforeunload'));
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
    expect(mocks.sceneDispose).toHaveBeenCalledOnce();
    expect(doc.removeEventListener).toHaveBeenCalled();
  });
});
