import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeAdrHash } from './src/build/adr-hash-plugin';
const __dirname = resolve(fileURLToPath(new URL('.', import.meta.url)));

// ─── ADR-0006 §2.3: adrHash injection ──────────────────────────────────
// sha256 over the concatenated raw bytes of ADR-0001..0005 (docs-only ADRs
// carrying runtime constants). ADR-0006 itself is excluded per §2.3.

function safeCommitSha(): string {
  const envSha = process.env['GITHUB_SHA'] ?? process.env['COMMIT_SHA'];
  if (envSha) return envSha.slice(0, 12);
  try {
    return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
      encoding: 'utf8',
      env: { PATH: process.env['PATH'] },
    }).trim();
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
  resolve: {
    alias: [{
      find: /^@engine\/(.+)$/,
      replacement: (( _match: string, subpath: string) => {
        if (subpath.split('/').some((segment) => segment === '..')) {
          throw new Error(`@engine alias rejected traversal: ${subpath}`);
        }
        return resolve(__dirname, 'src/engine', subpath);
      }) as unknown as string,
    }],
  },
  // Vanilla TS + three.js; no framework runtime (per ADR-0001 §2.1)
  root: '.',
  publicDir: 'public',

  build: {
    target: 'es2022',
    outDir: 'dist',
    // project-specific env; SOURCE_MAP is too generic and risks CI runner leakage
    sourcemap: process.env['BUILD_SOURCE_MAP'] === 'true',
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
