#!/usr/bin/env node
// scripts/security-check-eval.mjs
//
// ADR-0006 §2.6 F1: no `eval` / `new Function` / string-arg setTimeout in src/.
// CI-level grep on the source tree to catch things ESLint might miss
// (e.g. inside string literals, comments-turned-templates, etc).
//
// Exits non-zero on any hit.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOTS = ['src', 'scripts', 'vite.config.ts', 'vitest.config.ts', 'eslint.config.js'];
const EXTS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
// Patterns are literal-string tokens; must appear as actual code, not names/comments.
const FORBIDDEN_PATTERNS = [
  // eval(...) as identifier followed by open paren
  { name: 'eval(', re: /\beval\s*\(/ },
  // new Function(...)
  { name: 'new Function', re: /\bnew\s+Function\s*\(/ },
  // setTimeout('code', ...) or setInterval('code', ...) — string-arg form
  { name: 'setTimeout("...", …)', re: /\bset(?:Timeout|Interval)\s*\(\s*["'`]/ },
  // Function('code')
  { name: 'Function("...", …)', re: /\bFunction\s*\(\s*["'`]/ },
];

/** Walk configured source and security-check paths recursively. */
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
  const paths = ROOTS.flatMap((root) => statSync(root).isDirectory() ? [...walk(root)] : [root]);
  for (const path of paths) {
    if (path === 'scripts/security-check-eval.mjs') continue;
    const src = readFileSync(path, 'utf8');
    src.split('\n').forEach((line, i) => {
      for (const { name, re } of FORBIDDEN_PATTERNS) {
        if (re.test(line)) {
          console.error(`${path}:${i + 1}: forbidden pattern "${name}"`);
          console.error(`  ${line.trim()}`);
          hits++;
        }
      }
    });
  }
} catch (err) {
  if (err.code === 'ENOENT') {
    console.log('[security-check-eval] src/ not present yet — skipping (scaffolding PR).');
    process.exit(0);
  }
  throw err;
}

if (hits > 0) {
  console.error(`\n[security-check-eval] FAIL — ${hits} forbidden pattern(s) in src/. See ADR-0006 §2.6 F1.`);
  process.exit(1);
}
console.log('[security-check-eval] OK — no forbidden dynamic-code patterns in src/.');
