/// <reference types="vite/client" />

// ADR-0006 §2.3 + §2.6 F4: whitelist of build-time constants Vite injects.
// Adding fields here without also adding them to vite.config.ts `define`
// (and scripts/security-check-env.mjs whitelist) will not create runtime
// values — TypeScript will let you access them but they will be `undefined`.
interface ImportMetaEnv {
  readonly __ADR_HASH__: string;   // sha256 hex prefix, length 32 (16 bytes)
  readonly __BUILD_TIME__: string; // ISO 8601 UTC timestamp
  readonly __COMMIT_SHA__: string; // git short sha (12 chars) or 'unknown'
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
