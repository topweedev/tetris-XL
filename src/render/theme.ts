import { readValidated, SettingsSchema, writeValidated } from '../engine/persistence/storage';
export type RenderPreset = 'translucent' | 'high-contrast' | 'opaque-fallback';
export const DEFAULT_PRESET: RenderPreset = 'translucent';
export const DEFAULT_HIGH_CONTRAST_CUTAWAY = false;
export type ThemeState = { preset: RenderPreset; highContrastCutaway: boolean };
const KEY = 'tetris-xl:settings:v2';
const listeners = new Set<(state: ThemeState) => void>();
let state: ThemeState | undefined;
function load(): ThemeState { const saved = readValidated(KEY, SettingsSchema, { v: 2, renderPreset: DEFAULT_PRESET, highContrastCutaway: DEFAULT_HIGH_CONTRAST_CUTAWAY }); return { preset: saved.renderPreset ?? DEFAULT_PRESET, highContrastCutaway: saved.highContrastCutaway ?? DEFAULT_HIGH_CONTRAST_CUTAWAY }; }
function current(): ThemeState { return state ??= load(); }
function persist(): void { writeValidated(KEY, SettingsSchema, { v: 2, renderPreset: current().preset, highContrastCutaway: current().highContrastCutaway }); }
function notify(): void { const snapshot = { ...current() }; listeners.forEach((cb) => cb(snapshot)); }
export function getPreset(): RenderPreset { return current().preset; }
export function setPreset(preset: RenderPreset): void { current().preset = preset; persist(); notify(); }
export function getHighContrastCutaway(): boolean { return current().highContrastCutaway; }
export function setHighContrastCutaway(enabled: boolean): void { current().highContrastCutaway = enabled; persist(); notify(); }
export function subscribe(cb: (state: ThemeState) => void): () => void { listeners.add(cb); return () => listeners.delete(cb); }
