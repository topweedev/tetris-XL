import { describe, expect, it } from 'vitest';
import { createActivePieceMesh } from '../../src/render/piece';
import { typeId, rotationStateId } from '../../src/engine/types';
describe('active piece renderer', () => { it('builds all canonical type ids', () => { for (let i = 0; i < 12; i += 1) { const group = createActivePieceMesh(typeId(i), rotationStateId(0), 'translucent'); expect(group.renderOrder).toBe(3); expect(group.children.length).toBeGreaterThan(0); expect(group.children[0]!.children.length).toBe(2); } }); });
