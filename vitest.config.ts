import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const root = resolve(process.cwd());

export default defineConfig({
  resolve: {
    alias: [{
      find: /^@engine\/(.+)$/,
      replacement: (( _match: string, subpath: string) => {
        if (subpath.split('/').some((segment) => segment === '..')) {
          throw new Error(`@engine alias rejected traversal: ${subpath}`);
        }
        return resolve(root, 'src/engine', subpath);
      }) as unknown as string,
    }],
  },
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
