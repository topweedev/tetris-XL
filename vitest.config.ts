import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environmentMatchGlobs: [
      ['tests/ui/**', 'jsdom'],
      ['tests/**', 'node'],
    ],
    setupFiles: ['./tests/setup.ts'],
    globals: false,
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      thresholds: { lines: 80, branches: 80 },
    },
  },
});
