// eslint.config.js — flat config (ESLint 9+)
//
// Enforces the ADR-0006 §2.6 F1 / F6 security hard rules:
//   F1 · no eval / new Function / string-arg setTimeout
//   F6 · no direct localStorage / indexedDB.open outside the wrapper files
//
// See ADR-0006 §2.6 for rationale.

import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'public/**'],
  },

  // Baseline JS recommended
  js.configs.recommended,

  // ─── TypeScript rules across src/ + config files ─────────────────────
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      globals: { document: 'readonly', console: 'readonly', process: 'readonly' },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,

      // ADR-0006 §2.6 F1: absolutely no dynamic code execution
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',

      // ADR-0006 §2.6 F2: JSON.parse must be schema-validated at call site.
      // ESLint cannot fully assert this; the CI grep job
      // (scripts/security-check-eval.mjs) handles positive detection.

      // Typescript hygiene consistent with tsconfig strict flags
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      'no-restricted-imports': [
        'error',
        { patterns: ['@engine/../*', '@engine/../**'] },
      ],
    },
  },

  // ─── F6 · restrict raw persistence globals to wrapper files ──────────
  // In every file EXCEPT the two whitelisted wrappers, direct use of
  // `localStorage` / `indexedDB` is banned. Wrappers must use the tools
  // themselves; other code must go through `readValidated` /
  // `writeValidated` / `writeReplay` / `readReplay` / `listReplays`.
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.mjs'],
    ignores: [
      'src/engine/persistence/storage.ts',      // localStorage wrapper (ADR-0006 §2.6 F6)
      'src/engine/persistence/replay-store.ts', // IndexedDB wrapper (ADR-0006 §2.6 F6)
    ],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message:
            'Use readValidated / writeValidated from src/engine/persistence/storage.ts (ADR-0006 §2.6 F6).',
        },
        {
          name: 'indexedDB',
          message:
            'Use writeReplay / readReplay / listReplays from src/engine/persistence/replay-store.ts (ADR-0006 §2.6 F6).',
        },
      ],
    },
  },

  // ─── Node config files (relax browser-only globals; keep no-eval) ────
  {
    files: ['vite.config.ts', 'eslint.config.js', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        document: 'readonly',
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
      },
    },
    rules: {
      'no-restricted-globals': 'off', // node scripts legitimately use process etc.
    },
  },
];
