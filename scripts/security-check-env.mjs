#!/usr/bin/env node
// scripts/security-check-env.mjs
//
// ADR-0006 §2.6 F4: the ONLY `import.meta.env.*` values allowed in src/
// are the whitelist injected by vite.config.ts:
//   __ADR_HASH__ / __BUILD_TIME__ / __COMMIT_SHA__
// Standard vite-injected fields (MODE, BASE_URL, DEV, PROD, SSR) are also
// tolerated because they are inherent to vite/client typings.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = 'src';
const EXTS = new Set(['.ts', '.tsx']);

// Our custom build-time constants (see vite.config.ts `define` block)
const CUSTOM_ALLOWED = new Set([
  '__ADR_HASH__',
  '__BUILD_TIME__',
  '__COMMIT_SHA__',
]);
// Vite's own ImportMetaEnv fields — allowed by design
const VITE_BUILTIN = new Set(['MODE', 'BASE_URL', 'DEV', 'PROD', 'SSR']);

const RE = /import\.meta\.env\.([A-Za-z_$][A-Za-z_$0-9]*)/g;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      yield* walk(full);
    } else if (EXTS.has(extname(entry))) {
      yield full;
    }
  }
}

let hits = 0;
try {
  for (const path of walk(ROOT)) {
    const src = readFileSync(path, 'utf8');
    src.split('\n').forEach((line, i) => {
      let m;
      while ((m = RE.exec(line)) !== null) {
        const name = m[1];
        if (CUSTOM_ALLOWED.has(name) || VITE_BUILTIN.has(name)) continue;
        console.error(`${path}:${i + 1}: non-whitelisted env access "import.meta.env.${name}"`);
        console.error(`  ${line.trim()}`);
        hits++;
      }
    });
  }
} catch (err) {
  if (err.code === 'ENOENT') {
    console.log('[security-check-env] src/ not present yet — skipping (scaffolding PR).');
    process.exit(0);
  }
  throw err;
}

if (hits > 0) {
  console.error(
    `\n[security-check-env] FAIL — ${hits} non-whitelisted env access(es). See ADR-0006 §2.6 F4.\n` +
      `Allowed custom: ${[...CUSTOM_ALLOWED].join(', ')}\n` +
      `Allowed vite-built-in: ${[...VITE_BUILTIN].join(', ')}`,
  );
  process.exit(1);
}
console.log('[security-check-env] OK — only whitelisted env constants used in src/.');
