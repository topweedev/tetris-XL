import { describe, expect, it } from 'vitest';
import { buildBootState } from '../../src/engine/core';
import { createHud } from '../../src/render/hud';

class FakeElement {
  id = '';
  textContent = '';
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  ownerDocument!: FakeDocument;
  parent: FakeElement | null = null;
  append(...nodes: FakeElement[]): void { nodes.forEach((node) => { node.parent = this; this.children.push(node); }); }
  appendChild(node: FakeElement): FakeElement { this.append(node); return node; }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  remove(): void { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); }
}
class FakeDocument {
  createElement(): FakeElement { const element = new FakeElement(); element.ownerDocument = this; return element; }
}

function root(): HTMLElement { const doc = new FakeDocument(); const element = doc.createElement(); return element as unknown as HTMLElement; }

describe('HUD', () => {
  it('creates an accessible status and updates text with textContent', () => {
    const container = root();
    const hud = createHud(container);
    const state = { ...buildBootState(7), score: 120, level: 2, totalLayersCleared: 4 };
    hud.update(state);
    expect(hud.element.id).toBe('hud');
    expect(hud.element.getAttribute('role')).toBe('status');
    expect(hud.element.getAttribute('aria-live')).toBe('polite');
    expect(hud.element.textContent).not.toContain('<');
    expect(Array.from(hud.element.children, (child) => child.textContent)).toEqual([
      'Score 120', 'Level 2', 'Lines 4', expect.stringMatching(/^Next /),
    ]);
    hud.dispose();
    expect(container.children).toHaveLength(0);
  });
});
