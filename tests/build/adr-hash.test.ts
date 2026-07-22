import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { computeAdrHash } from '../../src/build/adr-hash-plugin';

describe('adr hash check', () => {
  it('matches the shared plugin helper', () => {
    const output = execFileSync('node', ['--experimental-strip-types', 'scripts/security-check-adr-hash.mjs'], { encoding: 'utf8' });
    expect(output).toContain(`deterministic adrHash = ${computeAdrHash()}`);
  });
});
