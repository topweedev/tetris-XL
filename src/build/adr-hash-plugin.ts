// src/build/adr-hash-plugin.ts
//
// Reusable helper that computes the adrHash per ADR-0006 §2.3.
// vite.config.ts and scripts/security-check-adr-hash.mjs both use this
// so the hash algorithm has a single source of truth.
//
// NOTE: Kept as a standalone module (not a vite plugin object) so that
// node scripts (.mjs) and vite.config.ts can share the same code without
// pulling vite as a peer dependency into CI-only paths.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

/**
 * ADR markdown files whose raw bytes feed the adrHash.
 * Per ADR-0006 §2.3: ADR-0001..0005 (constant-carrying ADRs). ADR-0006 itself
 * is excluded because it describes replay format only and is not consumed at
 * runtime; including it would invalidate replays every time ADR-0006 is
 * revised, defeating the guard's intent.
 *
 * Future constant-carrying ADRs (e.g. ADR-0007 for gamepad rebinding) must
 * be added HERE and the replay schemaVersion bumped in ADR-0006 §2.2.
 */
export const ADR_FILES_FOR_HASH = Object.freeze([
  'docs/adr/0001-project-architecture.md',
  'docs/adr/0002-polycube-rotation-kicks.md',
  'docs/adr/0003-difficulty-and-scoring.md',
  'docs/adr/0004-input-ux-and-keymap.md',
  'docs/adr/0005-hold-combo-spin-b2b-scoring.md',
] as const);

/**
 * Compute the adrHash: sha256 of ADR_FILES_FOR_HASH raw byte concatenation,
 * truncated to the first 32 hex characters (= 16 bytes = 128-bit prefix).
 *
 * Collision probability ~2^-64 per birthday bound; adequate as a
 * version-marker for replay compatibility (ADR-0006 §2.3 alternatives §3).
 *
 * @param repoRoot Absolute path to the repo root. Defaults to `process.cwd()`.
 */
export function computeAdrHash(repoRoot: string = process.cwd()): string {
  const h = createHash('sha256');
  for (const relPath of ADR_FILES_FOR_HASH) {
    const abs = resolve(repoRoot, relPath);
    // Raw bytes only; NO normalization. .gitattributes pins
    // docs/adr/*.md to eol=lf so cross-platform checkouts agree.
    h.update(readFileSync(abs));
  }
  return h.digest('hex').slice(0, 32);
}
