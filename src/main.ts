import * as THREE from 'three';
import { buildBootState, step } from '@engine/core';
import { KEYMAP, MAX_INPUT_EVENTS_PER_TICK, createInputState, sampleInput } from '@engine/input';
import type { InputState, KeyInputEvent } from '@engine/input';
import { GameAction } from '@engine/types';
import type { GameAction as GameActionType, GameState, PhysicalKey, RotationStateId, TypeId } from '@engine/types';
import {
  createActivePieceMesh,
  createGhostMesh,
  createHud,
  createLockedMesh,
  createScene,
  disposeGroup,
  getPreset,
  relightLocked,
  subscribe,
  updateActiveFillAlpha,
  updateActivePieceTransform,
  updateGhostAppearance,
  updateGhostTransform,
  updateHud,
  updateLockedMesh,
} from './render';

export const TICK_MS = 1000 / 60;
export const MAX_ACCUMULATOR_MS = 250;
const relevantCodes = new Set(KEYMAP.map(({ code }) => code));
const queuedEvents: KeyInputEvent[] = [];
const activeAnchor = new THREE.Vector3();

export interface GameRuntime {
  readonly state: () => GameState;
  dispose: () => void;
}

let runtime: GameRuntime | null = null;

function freshSeed(): number {
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0]!;
}

/** Keep restart entropy at the integration boundary without changing deterministic engine semantics. */
export function advanceGameState(
  state: GameState,
  actions: readonly GameActionType[],
  tick: number,
  seedSource: () => number = freshSeed,
): GameState {
  if (state.fsmState === 'GAME_OVER' && actions.includes(GameAction.Restart)) {
    return buildBootState(seedSource());
  }
  return step(state, actions, tick);
}

function boardChanged(previous: Uint8Array, current: Uint8Array): boolean {
  for (let i = 0; i < current.length; i += 1) if (previous[i] !== current[i]) return true;
  return false;
}

/** step() clones board every tick, so byte comparison is required after a step to avoid false GPU uploads. */
export function shouldUpdateLocked(stepRan: boolean, previous: Uint8Array, current: Uint8Array): boolean {
  return stepRan && boardChanged(previous, current);
}

export function capFrameDelta(delta: number): number {
  return Math.min(Math.max(delta, 0), MAX_ACCUMULATOR_MS);
}

export function toKeyInputEvent(event: Pick<KeyboardEvent, 'type' | 'code' | 'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey'>): KeyInputEvent | null {
  if (!relevantCodes.has(event.code as PhysicalKey)) return null;
  return {
    type: event.type === 'keyup' ? 'keyup' : 'keydown',
    code: event.code as PhysicalKey,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
    // Shift is intentionally retained: ShiftLeft is the ADR-0004 SoftDrop game key.
    shiftKey: event.shiftKey,
  };
}

function keyboardEvent(event: KeyboardEvent): void {
  const inputEvent = toKeyInputEvent(event);
  if (inputEvent === null) return;
  event.preventDefault();
  if (queuedEvents.length < MAX_INPUT_EVENTS_PER_TICK) queuedEvents.push(inputEvent);
}

export function bootRenderer(): GameRuntime {
  if (runtime !== null) return runtime;
  const root = document.getElementById('app');
  if (root === null) throw new Error('#app root not found');
  root.textContent = '';
  const bundle = createScene(root);
  const hud = createHud(root);
  const locked = createLockedMesh();
  bundle.scene.add(locked);
  let gameState = buildBootState(freshSeed());
  let inputState: InputState = createInputState();
  let tick = 0;
  let active: THREE.Group | null = null;
  let ghost: THREE.Group | null = null;
  let activeType: TypeId | null = null;
  let activeRotation: RotationStateId | null = null;
  const boardSnapshot = new Uint8Array(gameState.board.length);
  let previousTime = globalThis.performance.now();
  let accumulator = 0;
  let disposed = false;
  let animationId = 0;

  const removeDynamic = (object: THREE.Group | null): void => {
    if (object === null) return;
    bundle.scene.remove(object);
    disposeGroup(object);
  };

  const applyTheme = (preset: ReturnType<typeof getPreset>): void => {
    bundle.applyPreset(preset);
    relightLocked(locked, preset);
    if (active !== null) updateActiveFillAlpha(active, preset);
    if (ghost !== null) updateGhostAppearance(ghost, preset);
  };
  const unsubscribe = subscribe(({ preset }) => applyTheme(preset));

  const renderState = (): void => {
    const piece = gameState.piece;
    if (piece === null) {
      removeDynamic(active); removeDynamic(ghost);
      active = null; ghost = null; activeType = null; activeRotation = null;
    } else {
      if (active === null || activeType !== piece.typeId || activeRotation !== piece.rotationStateId) {
        removeDynamic(active); removeDynamic(ghost);
        active = createActivePieceMesh(piece.typeId, piece.rotationStateId, getPreset());
        ghost = createGhostMesh(piece.typeId, piece.rotationStateId);
        bundle.scene.add(active, ghost);
        activeType = piece.typeId; activeRotation = piece.rotationStateId;
      }
      activeAnchor.set(piece.anchor[0]!, piece.anchor[1]!, piece.anchor[2]!);
      updateActivePieceTransform(active, activeAnchor, piece.rotationStateId);
      updateGhostTransform(ghost!, piece, gameState.board);
    }
    updateHud(hud, gameState);
    bundle.renderer.render(bundle.scene, bundle.camera);
  };

  const frame = (now: number): void => {
    if (disposed) return;
    accumulator += capFrameDelta(now - previousTime);
    previousTime = now;
    let stepRan = false;
    while (accumulator >= TICK_MS) {
      const sample = sampleInput(inputState, 1, queuedEvents);
      queuedEvents.length = 0;
      inputState = sample.state;
      gameState = advanceGameState(gameState, sample.actions, tick);
      tick += 1;
      accumulator -= TICK_MS;
      stepRan = true;
    }
    if (shouldUpdateLocked(stepRan, boardSnapshot, gameState.board)) {
      updateLockedMesh(locked, gameState.board);
      boardSnapshot.set(gameState.board);
    }
    renderState();
    animationId = globalThis.requestAnimationFrame(frame);
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    globalThis.cancelAnimationFrame(animationId);
    document.removeEventListener('keydown', keyboardEvent);
    document.removeEventListener('keyup', keyboardEvent);
    globalThis.removeEventListener('beforeunload', dispose);
    unsubscribe();
    removeDynamic(active); removeDynamic(ghost);
    bundle.scene.remove(locked);
    disposeGroup(locked);
    hud.dispose();
    bundle.dispose();
    queuedEvents.length = 0;
    runtime = null;
  };
  runtime = { state: () => gameState, dispose };
  document.addEventListener('keydown', keyboardEvent, { passive: false });
  document.addEventListener('keyup', keyboardEvent, { passive: false });
  globalThis.addEventListener('beforeunload', dispose, { once: true });
  applyTheme(getPreset());
  animationId = globalThis.requestAnimationFrame(frame);
  return runtime;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => bootRenderer(), { once: true });
  else bootRenderer();
}

if (import.meta.env.DEV) console.info('[tetris-XL] adrHash:', import.meta.env.__ADR_HASH__, '· build:', import.meta.env.__BUILD_TIME__, '· commit:', import.meta.env.__COMMIT_SHA__);
