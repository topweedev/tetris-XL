import type { BoardArray } from './board';
import type { Piece, TypeId } from './piece';

export type FsmState = 'BOOT' | 'SPAWN' | 'FALLING' | 'GROUNDED' | 'LOCKED' | 'CLEARING' | 'GAME_OVER';
export type DasDir = 'X+' | 'X-' | 'Y+' | 'Y-' | null;
export interface BagSnapshot { readonly queue: readonly TypeId[]; readonly index: number; }

export interface GameState {
  readonly seed: number; readonly bag: BagSnapshot; readonly bagQueue: readonly TypeId[];
  readonly level: number; readonly totalLayersCleared: number; readonly gravityAcc: number; readonly softDropActive: boolean;
  readonly lockDelayTimer: number; readonly lockResets: number;
  readonly board: BoardArray; readonly piece: Piece | null; readonly fsmState: FsmState;
  readonly score: number; readonly combo: number; readonly b2bActive: boolean; readonly b2bCount: number;
  readonly holdSlot: TypeId | null; readonly holdUsedThisPiece: boolean;
  readonly lastActionWasRotation: boolean; readonly lastRotationUsedKick: boolean;
  readonly dasDirection: DasDir; readonly dasCharge: number; readonly dasRepeatCharge: number;
}

export interface GameStateSnapshot {
  readonly fsmState: FsmState; readonly score: number; readonly level: number;
  readonly lines: number; readonly combo: number; readonly b2bActive: boolean;
  readonly holdSlot: TypeId | null; readonly piece: Piece | null;
  readonly nextPieces: readonly TypeId[];
}
