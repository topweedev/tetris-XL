import { describe, expect, it } from 'vitest';
import { createLockedMesh, MAX_INSTANCES, updateLockedMesh } from '../../src/render/locked';
describe('locked renderer', () => { it('uses board capacity and updates visible count', () => { const mesh = createLockedMesh(); expect(MAX_INSTANCES).toBe(300); expect(mesh.renderOrder).toBe(1); updateLockedMesh(mesh, new Uint8Array(300)); expect(mesh.count).toBe(0); const board = new Uint8Array(300); board[0] = 1; updateLockedMesh(mesh, board); expect(mesh.count).toBe(1); }); });
