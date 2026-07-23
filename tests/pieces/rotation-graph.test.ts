import { describe, expect, it } from 'vitest';
import { GameAction } from '@engine/types';
import {
  ROTATION_ACTIONS,
  ROTATION_AXIS_MATRICES,
  ROTATION_GRAPH,
  ROTATION_STATES,
  matrixKey,
  multiplyMatrices,
} from '@engine/pieces';

const INVERSE_PAIRS = [
  [GameAction.RotateYawNeg, GameAction.RotateYawPos],
  [GameAction.RotatePitchNeg, GameAction.RotatePitchPos],
  [GameAction.RotateRollNeg, GameAction.RotateRollPos],
] as const;

describe('rotation graph', () => {
  it('follows the ADR-0004 action values and axis mapping', () => {
    expect(ROTATION_ACTIONS).toEqual([10, 11, 12, 13, 14, 15, 20]);
    expect(ROTATION_AXIS_MATRICES[GameAction.RotateYawPos]).toEqual(
      [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    );
    expect(ROTATION_AXIS_MATRICES[GameAction.RotatePitchPos]).toEqual(
      [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
    );
    expect(ROTATION_AXIS_MATRICES[GameAction.RotateRollPos]).toEqual(
      [[0, 0, 1], [0, 1, 0], [-1, 0, 0]],
    );
  });

  it('is closed and each quarter-turn pair is inverse', () => {
    ROTATION_GRAPH.forEach((graph, typeId) => graph.forEach((edges, stateId) => {
      for (const action of ROTATION_ACTIONS) {
        expect(Number(edges[action])).toBeGreaterThanOrEqual(0);
        expect(Number(edges[action])).toBeLessThan(ROTATION_STATES[typeId]!.length);
      }
      for (const [negative, positive] of INVERSE_PAIRS) {
        expect(graph[edges[negative]]![positive]).toBe(stateId);
        expect(graph[edges[positive]]![negative]).toBe(stateId);
      }
    }));
  });

  it('defines Flip as two positive roll rotations around Y', () => {
    const roll = ROTATION_AXIS_MATRICES[GameAction.RotateRollPos];
    expect(matrixKey(ROTATION_AXIS_MATRICES[GameAction.Flip]))
      .toBe(matrixKey(multiplyMatrices(roll, roll)));
    ROTATION_GRAPH.forEach((graph) => graph.forEach((edges) => {
      const once = edges[GameAction.RotateRollPos];
      expect(graph[once]![GameAction.RotateRollPos]).toBe(edges[GameAction.Flip]);
    }));
  });

  it('preserves the world pivot across all 735 transitions', () => {
    let transitions = 0;
    ROTATION_GRAPH.forEach((graph, typeId) => graph.forEach((edges, stateId) => {
      const current = ROTATION_STATES[typeId]![stateId]!;
      const anchor = [7, -3, 11] as const;
      for (const action of ROTATION_ACTIONS) {
        const next = ROTATION_STATES[typeId]![edges[action]]!;
        const anchorNext = anchor.map((coordinate, axis) =>
          coordinate + current.origin[axis]! - next.origin[axis]!,
        );
        const pivotCurrent = anchor.map((coordinate, axis) => coordinate + current.origin[axis]!);
        const pivotNext = anchorNext.map((coordinate, axis) => coordinate + next.origin[axis]!);
        expect(pivotNext).toEqual(pivotCurrent);
        transitions++;
      }
    }));
    expect(transitions).toBe(105 * 7);
  });
});
