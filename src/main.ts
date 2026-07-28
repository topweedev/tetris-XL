// src/main.ts — spike scaffolding placeholder.
//
// Real bootstrapping (game loop, three.js scene, InputMapper, persistence
// wiring) lands in the spike-phase implementation PR.
//
import { createScene } from './render';

const app = document.getElementById('app');
if (app === null) {
  throw new Error('#app root not found');
}
const root = app;

const adrHash = import.meta.env.__ADR_HASH__;
const buildTime = import.meta.env.__BUILD_TIME__;
const commitSha = import.meta.env.__COMMIT_SHA__;

app.textContent = 'tetris-XL scaffolding — real bootstrap arrives in spike-phase PR';

export function bootRenderer(): ReturnType<typeof createScene> {
  root.textContent = '';
  return createScene(root);
}

bootRenderer();

console.info('[tetris-XL] adrHash:', adrHash, '· build:', buildTime, '· commit:', commitSha);
