// src/main.ts — spike scaffolding placeholder.
//
// Real bootstrapping (game loop, three.js scene, InputMapper, persistence
// wiring) lands in the spike-phase implementation PR.
//
// For now this file just verifies the adrHash injection wiring works end
// to end (ADR-0006 §2.3). Runs once on load, then logs to console.

const app = document.getElementById('app');
if (app === null) {
  throw new Error('#app root not found');
}

const adrHash = import.meta.env.__ADR_HASH__;
const buildTime = import.meta.env.__BUILD_TIME__;
const commitSha = import.meta.env.__COMMIT_SHA__;

app.textContent = 'tetris-XL scaffolding — real bootstrap arrives in spike-phase PR';

console.info('[tetris-XL] adrHash:', adrHash, '· build:', buildTime, '· commit:', commitSha);
