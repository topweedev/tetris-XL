import { spawnSync } from 'node:child_process';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('security-check-eval', () => {
  it('rejects eslint-disabled eval lines', () => {
    mkdirSync('scripts/__tests__/fixtures', { recursive: true });
    const fixture = 'scripts/__tests__/fixtures/eval-fixture.mjs';
    writeFileSync(fixture, "eval" + "('x'); // eslint-disable-line no-eval\n");
    try {
      const result = spawnSync('node', ['scripts/security-check-eval.mjs'], { encoding: 'utf8' });
      expect(result.status).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain('forbidden pattern');
    } finally {
      unlinkSync(fixture);
    }
  });
});
