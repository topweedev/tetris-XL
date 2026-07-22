#!/usr/bin/env node
// scripts/security-check-csp.mjs
//
// ADR-0006 §2.6 F5: index.html must carry a CSP meta with at least the
// listed critical directives. Whitespace within the content= string is
// tolerated (index.html formats it multi-line for readability).

import { readFileSync } from 'node:fs';

const HTML_PATH = 'index.html';

const REQUIRED_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'none'",
];

let html;
try {
  html = readFileSync(HTML_PATH, 'utf8');
} catch (err) {
  if (err.code === 'ENOENT') {
    console.error(`[security-check-csp] FAIL — ${HTML_PATH} not found. ADR-0006 §2.6 F5.`);
    process.exit(1);
  }
  throw err;
}

// Extract content attribute of the CSP meta tag.
// Backreference \2 ensures we match the same quote type that opens `content=`
// so that inner `'self'` / `'none'` values (which use the opposite quote type)
// don't prematurely terminate the match.
const metaMatch = html.match(
  /<meta[^>]*http-equiv=(["'])Content-Security-Policy\1[^>]*content=(["'])([\s\S]*?)\2[^>]*>/i,
);
if (!metaMatch) {
  console.error(`[security-check-csp] FAIL — no CSP meta found in ${HTML_PATH}. ADR-0006 §2.6 F5.`);
  process.exit(1);
}

// Normalize whitespace in the content string.
const csp = metaMatch[3].replace(/\s+/g, ' ').trim();

const scriptSrc = csp.match(/(?:^|\s)script-src\s+([^;]+)/)?.[1] ?? '';
const ALLOWED_SCRIPT_SRC_TOKENS = new Set(["'self'", "'strict-dynamic'"]);
for (const token of scriptSrc.split(/\s+/).filter(Boolean)) {
  if (!ALLOWED_SCRIPT_SRC_TOKENS.has(token)) {
    console.error(`[security-check-csp] FAIL — disallowed script-src token: ${token}`);
    process.exit(1);
  }
}
// TODO: remove style-src 'unsafe-inline' per ADR-0007 rev.3.

let missing = 0;
for (const directive of REQUIRED_DIRECTIVES) {
  if (!csp.includes(directive)) {
    console.error(`[security-check-csp] missing directive: ${directive}`);
    missing++;
  }
}

if (missing > 0) {
  console.error(`\n[security-check-csp] FAIL — ${missing} required directive(s) missing. See ADR-0006 §2.6 F5.`);
  process.exit(1);
}
console.log('[security-check-csp] OK — all required CSP directives present.');
