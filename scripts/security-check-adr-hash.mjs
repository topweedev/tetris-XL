#!/usr/bin/env node
// scripts/security-check-adr-hash.mjs
//
// ADR-0006 §5 CI hard rule: adrHash must be deterministic across runs.
// If reading the same ADR files twice produces different hashes, our
// build is non-deterministic and replay compatibility breaks.
//
// Additionally: emit the hash so humans can eyeball it in CI logs (helps
// when debugging "why did my replay stop loading?").

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// The script is run with Node 22.6+'s --experimental-strip-types flag so the
// shared TypeScript helper is always cross-checked below.

const { computeAdrHash } = await import(pathToFileURL(
  resolve(process.cwd(), 'src/build/adr-hash-plugin.ts'),
).href);
if (typeof computeAdrHash !== 'function') {
  console.error('[security-check-adr-hash] FAIL — helper does not export computeAdrHash');
  process.exit(1);
}

const first = computeAdrHash();
const second = computeAdrHash();

if (first !== second) {
  console.error(
    `[security-check-adr-hash] FAIL — non-deterministic hash.\n` +
      `  first:  ${first}\n` +
      `  second: ${second}\n` +
      `Filesystem read differing bytes between calls; check .gitattributes eol=lf.`,
  );
  process.exit(1);
}

console.log(`[security-check-adr-hash] OK — deterministic adrHash = ${first}`);
