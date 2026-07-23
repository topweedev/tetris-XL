import { spawnSync } from 'node:child_process';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { describe, expect, it } from 'vitest';

describe('security-check-eval', () => {
  it('rejects eslint-disabled eval lines', () => {
    mkdirSync('tests/fixtures/security', { recursive: true });
    const fixture = 'tests/fixtures/security/eval-fixture.mjs';
    writeFileSync(fixture, "eval" + "('x'); // eslint-disable-line no-eval\n");
    try {
      const result = spawnSync('node', ['scripts/security-check-eval.mjs'], {
        encoding: 'utf8',
        env: { ...process.env, SECURITY_CHECK_EVAL_EXTRA_ROOTS: 'tests/fixtures/security' },
      });
      expect(result.status).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain('forbidden pattern');
    } finally {
      unlinkSync(fixture);
    }
  });
});
