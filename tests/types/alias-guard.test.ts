import { describe, expect, it } from 'vitest';

describe('engine alias guard', () => {
  it('resolves engine types', async () => {
    await expect(import('@engine/types')).resolves.toBeDefined();
  });

  it('rejects traversal outside engine', async () => {
    const traversal = '@engine/../main';
    await expect(import(/* @vite-ignore */ traversal)).rejects.toThrow();
  });
});
