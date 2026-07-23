export type CellTuple = readonly [number, number, number];

const FACE_OFFSETS: readonly CellTuple[] = Object.freeze([
  [1, 0, 0], [-1, 0, 0], [0, 1, 0],
  [0, -1, 0], [0, 0, 1], [0, 0, -1],
]);

/** Return whether all cells are reachable through 3D face adjacency. */
export function isFaceConnected(cells: readonly CellTuple[]): boolean {
  const first = cells[0];
  if (first === undefined) return false;
  const cellKeys = new Set(cells.map(cellKey));
  const seen = new Set<string>([cellKey(first)]);
  const queue: CellTuple[] = [first];

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const cell = queue[cursor];
    if (cell === undefined) continue;
    const [x, y, z] = cell;
    for (const [dx, dy, dz] of FACE_OFFSETS) {
      const neighbour: CellTuple = [x + dx, y + dy, z + dz];
      const key = cellKey(neighbour);
      if (cellKeys.has(key) && !seen.has(key)) {
        seen.add(key);
        queue.push(neighbour);
      }
    }
  }
  return seen.size === cells.length;
}

function cellKey([x, y, z]: CellTuple): string {
  return `${x},${y},${z}`;
}
