import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

// ─── ADR-0006 §2.3: adrHash injection ──────────────────────────────────
// sha256 over the concatenated raw bytes of ADR-0001..0005 (docs-only ADRs
// carrying runtime constants). ADR-0006 itself is excluded per §2.3.

const ADR_FILES_FOR_HASH = [
  'docs/adr/0001-project-architecture.md',
  'docs/adr/0002-polycube-rotation-kicks.md',
  'docs/adr/0003-difficulty-and-scoring.md',
  'docs/adr/0004-input-ux-and-keymap.md',
  'docs/adr/0005-hold-combo-spin-b2b-scoring.md',
] as const;

function computeAdrHash(): string {
  const h = createHash('sha256');
  for (const path of ADR_FILES_FOR_HASH) {
    h.update(readFileSync(path));
  }
  return h.digest('hex').slice(0, 32); // 32 hex chars = 16 bytes; see ADR-0006 §2.3
}

function safeCommitSha(): string {
  try {
    return execSync('git rev-parse --short=12 HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

// ─── ADR-0006 §2.6 F4: env constant whitelist ──────────────────────────
// The ONLY constants Vite is allowed to inject into the static build.
// Anything else (VITE_* env vars, GITHUB_TOKEN, etc.) is forbidden.
// `scripts/security-check-env.mjs` grep-verifies this at CI time.

const ADR_HASH = computeAdrHash();
const BUILD_TIME = new Date().toISOString();
const COMMIT_SHA = safeCommitSha();

export default defineConfig({
  resolve: { alias: { '@engine': resolve('src/engine') } },
  // Vanilla TS + three.js; no framework runtime (per ADR-0001 §2.1)
  root: '.',
  publicDir: 'public',

  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    // No CDN / no split - single-origin bundle keeps CSP `connect-src 'none'` viable
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },

  server: {
    // Local-only dev server; no external connections in code (ADR-0006 §2.6 F5)
    port: 5173,
    strictPort: true,
  },

  // ADR-0006 §2.3 + §2.6 F4: build-time constant injection.
  // These three (and ONLY these three) are exposed to runtime code as
  // `import.meta.env.__ADR_HASH__` / `__BUILD_TIME__` / `__COMMIT_SHA__`.
  // No `process.env.*` or `VITE_*` values are injected.
  define: {
    'import.meta.env.__ADR_HASH__': JSON.stringify(ADR_HASH),
    'import.meta.env.__BUILD_TIME__': JSON.stringify(BUILD_TIME),
    'import.meta.env.__COMMIT_SHA__': JSON.stringify(COMMIT_SHA),
  },

  // Do NOT set `envPrefix` (would allow arbitrary VITE_* injection).
  // Keep the whitelist strictly to the `define` block above.
  envPrefix: [],
});
