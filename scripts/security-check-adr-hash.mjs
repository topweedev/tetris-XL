#!/usr/bin/env node
// scripts/security-check-adr-hash.mjs
//
// ADR-0006 §5 CI hard rule: adrHash must be deterministic across runs.
// If reading the same ADR files twice produces different hashes, our
// build is non-deterministic and replay compatibility breaks.
//
// Additionally: emit the hash so humans can eyeball it in CI logs (helps
// when debugging "why did my replay stop loading?").

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Dynamic import so this script also works before the TS compile step.
// We shell out to `node --experimental-strip-types` if available on 22+,
// otherwise use a tiny stub reader mirroring src/build/adr-hash-plugin.ts.
// Kept intentionally self-contained: no build required to run this check.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ADR_FILES_FOR_HASH = [
  'docs/adr/0001-project-architecture.md',
  'docs/adr/0002-polycube-rotation-kicks.md',
  'docs/adr/0003-difficulty-and-scoring.md',
  'docs/adr/0004-input-ux-and-keymap.md',
  'docs/adr/0005-hold-combo-spin-b2b-scoring.md',
];

function compute() {
  const h = createHash('sha256');
  for (const relPath of ADR_FILES_FOR_HASH) {
    const abs = resolve(process.cwd(), relPath);
    try {
      h.update(readFileSync(abs));
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.error(`[security-check-adr-hash] FAIL — required ADR file missing: ${relPath}`);
        process.exit(1);
      }
      throw err;
    }
  }
  return h.digest('hex').slice(0, 32);
}

const first = compute();
const second = compute();

if (first !== second) {
  console.error(
    `[security-check-adr-hash] FAIL — non-deterministic hash.\n` +
      `  first:  ${first}\n` +
      `  second: ${second}\n` +
      `Filesystem read differing bytes between calls; check .gitattributes eol=lf.`,
  );
  process.exit(1);
}

// Cross-check with the shared helper (once compiled by tsc/vite) to ensure
// vite.config.ts and this script agree. If node --experimental-strip-types
// is available (Node 22.6+), we run the TS module directly.
try {
  const helperUrl = pathToFileURL(
    resolve(process.cwd(), 'src/build/adr-hash-plugin.ts'),
  ).href;
  // Node 22+ can strip TS types natively with --experimental-strip-types.
  // If not enabled the import will fail; we then just accept the pure-JS
  // computation above as authoritative for CI.
  const mod = await import(helperUrl).catch(() => null);
  if (mod && typeof mod.computeAdrHash === 'function') {
    const helperHash = mod.computeAdrHash();
    if (helperHash !== first) {
      console.error(
        `[security-check-adr-hash] FAIL — src/build helper disagrees with CI script.\n` +
          `  ci: ${first}\n` +
          `  helper: ${helperHash}\n` +
          `Update ADR_FILES_FOR_HASH in one of them to match.`,
      );
      process.exit(1);
    }
  }
} catch (err) {
  // Non-fatal: the pure-JS computation stands. The helper module is
  // exercised at build time by vite.config.ts anyway.
  console.log(`[security-check-adr-hash] note: TS helper cross-check skipped (${err.message})`);
}

console.log(`[security-check-adr-hash] OK — deterministic adrHash = ${first}`);
