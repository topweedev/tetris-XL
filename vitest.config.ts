import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@engine': new URL('./src/engine', import.meta.url).pathname, '@build': new URL('./src/build', import.meta.url).pathname } },
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
