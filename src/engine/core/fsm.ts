import type { FsmState, GameState } from '@engine/types';

const TRANSITIONS: Readonly<Record<FsmState, readonly FsmState[]>> = Object.freeze({
  BOOT: Object.freeze(['SPAWN'] as FsmState[]),
  SPAWN: Object.freeze(['FALLING', 'GAME_OVER'] as FsmState[]),
  FALLING: Object.freeze(['FALLING', 'GROUNDED'] as FsmState[]),
  GROUNDED: Object.freeze(['FALLING', 'GROUNDED', 'LOCKED'] as FsmState[]),
  LOCKED: Object.freeze(['CLEARING', 'SPAWN', 'GAME_OVER'] as FsmState[]),
  CLEARING: Object.freeze(['SPAWN'] as FsmState[]),
  GAME_OVER: Object.freeze(['BOOT'] as FsmState[]),
});

/** Apply one validated FSM transition without mutating the input state. */
export function advanceFsm(state: GameState, nextState: FsmState): GameState {
  if (!TRANSITIONS[state.fsmState].includes(nextState)) {
    throw new Error(`invalid FSM transition: ${state.fsmState} -> ${nextState}`);
  }
  return Object.freeze({ ...state, fsmState: nextState });
}

export function canTransition(from: FsmState, to: FsmState): boolean {
  return TRANSITIONS[from].includes(to);
}
