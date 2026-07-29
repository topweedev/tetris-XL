import { POLYCUBE_SHORT_NAMES } from '@engine/pieces';
import type { GameState } from '@engine/types';

export interface HudBundle {
  readonly element: HTMLElement;
  update: (state: GameState) => void;
  dispose: () => void;
}

export function createHud(container: HTMLElement): HudBundle {
  const doc = container.ownerDocument;
  const element = doc.createElement('div');
  element.id = 'hud';
  element.setAttribute('role', 'status');
  element.setAttribute('aria-live', 'polite');
  const score = doc.createElement('div');
  const level = doc.createElement('div');
  const lines = doc.createElement('div');
  const next = doc.createElement('div');
  element.append(score, level, lines, next);
  container.appendChild(element);
  let previousScore = -1;
  let previousLevel = -1;
  let previousLines = -1;
  let previousNext = '';
  const update = (state: GameState): void => {
    if (state.score !== previousScore) { score.textContent = `Score ${state.score}`; previousScore = state.score; }
    if (state.level !== previousLevel) { level.textContent = `Level ${state.level}`; previousLevel = state.level; }
    if (state.totalLayersCleared !== previousLines) { lines.textContent = `Lines ${state.totalLayersCleared}`; previousLines = state.totalLayersCleared; }
    let queue = '';
    for (let i = 0; i < 3 && i < state.bagQueue.length; i += 1) queue += `${i === 0 ? '' : ' · '}${POLYCUBE_SHORT_NAMES[Number(state.bagQueue[i])] ?? '?'}`;
    if (queue !== previousNext) { next.textContent = `Next ${queue || '—'}`; previousNext = queue; }
  };
  return { element, update, dispose: () => element.remove() };
}

export function updateHud(hud: HudBundle, state: GameState): void { hud.update(state); }
