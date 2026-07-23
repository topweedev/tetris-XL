import { GameAction, rotationStateId } from '@engine/types';
import type { RotationStateId } from '@engine/types';
import { ROTATION_STATES, canonicalCellKey, normalizeCells, unpackCells } from './rotations';
import { applyRotation, matrixKey, multiplyMatrices } from './so24';
import type { Mat3 } from './so24';

export const ROTATION_ACTIONS = Object.freeze([
  GameAction.RotateYawNeg, GameAction.RotateYawPos,
  GameAction.RotatePitchNeg, GameAction.RotatePitchPos,
  GameAction.RotateRollNeg, GameAction.RotateRollPos,
  GameAction.Flip,
] as const);
export type RotationAction = (typeof ROTATION_ACTIONS)[number];
export type RotationTransitions = Readonly<Record<RotationAction, RotationStateId>>;

function freezeMat3(matrix: Mat3): Mat3 {
  return Object.freeze(matrix.map((row) => Object.freeze(row)) as unknown as Mat3);
}

const X_POS = freezeMat3([[1, 0, 0], [0, 0, -1], [0, 1, 0]]);
const X_NEG = freezeMat3([[1, 0, 0], [0, 0, 1], [0, -1, 0]]);
const Y_POS = freezeMat3([[0, 0, 1], [0, 1, 0], [-1, 0, 0]]);
const Y_NEG = freezeMat3([[0, 0, -1], [0, 1, 0], [1, 0, 0]]);
const Z_POS = freezeMat3([[0, -1, 0], [1, 0, 0], [0, 0, 1]]);
const Z_NEG = freezeMat3([[0, 1, 0], [-1, 0, 0], [0, 0, 1]]);

export const ROTATION_AXIS_MATRICES: Readonly<Record<RotationAction, Mat3>> = Object.freeze({
  [GameAction.RotateYawNeg]: Z_NEG,
  [GameAction.RotateYawPos]: Z_POS,
  [GameAction.RotatePitchNeg]: X_NEG,
  [GameAction.RotatePitchPos]: X_POS,
  [GameAction.RotateRollNeg]: Y_NEG,
  [GameAction.RotateRollPos]: Y_POS,
  [GameAction.Flip]: freezeMat3(multiplyMatrices(Y_POS, Y_POS)),
});

function buildRotationGraph(): readonly (readonly RotationTransitions[])[] {
  return Object.freeze(ROTATION_STATES.map((states, typeIndex) => {
    const stateByKey = new Map(states.map((state) => [canonicalCellKey(unpackCells(state)), state.stateId]));
    return Object.freeze(states.map((state) => {
      const cells = unpackCells(state);
      const entries = ROTATION_ACTIONS.map((action) => {
        const transformed = normalizeCells(cells.map((cell) =>
          applyRotation(ROTATION_AXIS_MATRICES[action], cell),
        ));
        const destination = stateByKey.get(canonicalCellKey(transformed));
        if (destination === undefined) {
          throw new Error(`rotation graph not closed: type ${typeIndex}, state ${state.stateId}, action ${action}`);
        }
        return [action, destination] as const;
      });
      return Object.freeze(Object.fromEntries(entries)) as RotationTransitions;
    }));
  }));
}

function assertValidAxisMatrices(): void {
  const identityKey = '1,0,0;0,1,0;0,0,1';
  const inversePairs = [
    [GameAction.RotateYawNeg, GameAction.RotateYawPos],
    [GameAction.RotatePitchNeg, GameAction.RotatePitchPos],
    [GameAction.RotateRollNeg, GameAction.RotateRollPos],
  ] as const;
  for (const [negative, positive] of inversePairs) {
    if (matrixKey(multiplyMatrices(
      ROTATION_AXIS_MATRICES[negative], ROTATION_AXIS_MATRICES[positive],
    )) !== identityKey) {
      throw new Error('rotation axis matrices are not inverse');
    }
  }
  const flipKey = matrixKey(ROTATION_AXIS_MATRICES[GameAction.Flip]);
  const rollSquared = matrixKey(multiplyMatrices(Y_POS, Y_POS));
  const pitchSquared = matrixKey(multiplyMatrices(X_POS, X_POS));
  if (flipKey !== rollSquared) throw new Error('Flip must equal two positive Roll rotations');
  if (flipKey === pitchSquared) throw new Error('Flip must differ from two positive Pitch rotations');
}

assertValidAxisMatrices();

export const ROTATION_GRAPH = buildRotationGraph();

function assertValidRotationGraph(): void {
  const inversePairs = [
    [GameAction.RotateYawNeg, GameAction.RotateYawPos],
    [GameAction.RotatePitchNeg, GameAction.RotatePitchPos],
    [GameAction.RotateRollNeg, GameAction.RotateRollPos],
  ] as const;
  ROTATION_GRAPH.forEach((states, typeIndex) => states.forEach((edges, stateIndex) => {
    for (const action of ROTATION_ACTIONS) {
      const destination = edges[action];
      if (destination < 0 || destination >= states.length) {
        throw new Error(`invalid graph destination: type ${typeIndex}, state ${stateIndex}`);
      }
    }
    for (const [first, inverse] of inversePairs) {
      if (states[edges[first]]![inverse] !== rotationStateId(stateIndex)) {
        throw new Error(`inverse failed: type ${typeIndex}, state ${stateIndex}`);
      }
    }
    const rollOnce = edges[GameAction.RotateRollPos];
    if (states[rollOnce]![GameAction.RotateRollPos] !== edges[GameAction.Flip]) {
      throw new Error(`flip mismatch: type ${typeIndex}, state ${stateIndex}`);
    }
  }));
}

assertValidRotationGraph();
