import { createScene } from './render';

const app = document.getElementById('app');
if (app === null) {
  throw new Error('#app root not found');
}
const root = app;

const adrHash = import.meta.env.__ADR_HASH__;
const buildTime = import.meta.env.__BUILD_TIME__;
const commitSha = import.meta.env.__COMMIT_SHA__;

let bundle: ReturnType<typeof createScene> | null = null;
export function bootRenderer(): ReturnType<typeof createScene> {
  if (bundle !== null) return bundle;
  root.textContent = '';
  bundle = createScene(root);
  return bundle;
}

bootRenderer();

if (import.meta.env.DEV) console.info('[tetris-XL] adrHash:', adrHash, '· build:', buildTime, '· commit:', commitSha);
