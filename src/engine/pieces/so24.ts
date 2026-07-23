import type { CellTuple } from './connectivity';

export type Mat3 = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

const PERMUTATIONS = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2],
  [1, 2, 0], [2, 0, 1], [2, 1, 0],
] as const;

export function determinant(matrix: Mat3): number {
  const [[a, b, c], [d, e, f], [g, h, i]] = matrix;
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

export function matrixKey(matrix: Mat3): string {
  return matrix.map((row) => row.join(',')).join(';');
}

function generateSO24(): readonly Mat3[] {
  const matrices: Mat3[] = [];
  for (const permutation of PERMUTATIONS) {
    for (const sx of [-1, 1] as const) for (const sy of [-1, 1] as const) for (const sz of [-1, 1] as const) {
      const signs = [sx, sy, sz] as const;
      const matrix = permutation.map((column, row) =>
        [0, 1, 2].map((candidate) => candidate === column ? signs[row]! : 0),
      ) as unknown as Mat3;
      if (determinant(matrix) === 1) matrices.push(matrix);
    }
  }
  const identityIndex = matrices.findIndex((matrix) => matrixKey(matrix) === '1,0,0;0,1,0;0,0,1');
  const [identity] = matrices.splice(identityIndex, 1);
  matrices.unshift(identity!);
  return Object.freeze(matrices.map((matrix) => Object.freeze(
    matrix.map((row) => Object.freeze(row)) as unknown as Mat3,
  )));
}

export function multiplyMatrices(left: Mat3, right: Mat3): Mat3 {
  return [0, 1, 2].map((row) => [0, 1, 2].map((column) =>
    left[row]![0] * right[0]![column]!
    + left[row]![1] * right[1]![column]!
    + left[row]![2] * right[2]![column]!,
  )) as unknown as Mat3;
}

export function applyRotation(matrix: Mat3, cell: CellTuple): CellTuple {
  const [x, y, z] = cell;
  return [
    matrix[0][0] * x + matrix[0][1] * y + matrix[0][2] * z,
    matrix[1][0] * x + matrix[1][1] * y + matrix[1][2] * z,
    matrix[2][0] * x + matrix[2][1] * y + matrix[2][2] * z,
  ];
}

/** Twenty-four proper integer rotations of the cube, identity first. */
export const SO24 = generateSO24();

function assertValidSO24(): void {
  if (SO24.length !== 24) throw new Error(`SO24.length !== 24, got ${SO24.length}`);
  const keys = new Set(SO24.map(matrixKey));
  if (keys.size !== 24) throw new Error('SO24 contains duplicates');
  for (const left of SO24) for (const right of SO24) {
    if (!keys.has(matrixKey(multiplyMatrices(left, right)))) {
      throw new Error('SO24 is not closed under multiplication');
    }
  }
  for (const matrix of SO24) {
    if (determinant(matrix) !== 1) throw new Error('SO24 contains a non-proper rotation');
    for (const row of matrix) {
      if (row.filter((entry) => entry !== 0).length !== 1) throw new Error('invalid SO24 row');
    }
    for (let column = 0; column < 3; column++) {
      if (matrix.filter((row) => row[column] !== 0).length !== 1) throw new Error('invalid SO24 column');
    }
  }
}

assertValidSO24();
