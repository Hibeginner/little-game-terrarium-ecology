const assert = require('assert');
const { GameState } = require('../../backend/gameState');

const state = new GameState();
const initial = state.get();
assert.strictEqual(initial.day, 1);
assert.strictEqual(initial.season, 'spring');
assert.strictEqual(initial.environment.temperature, 15);
console.log('GameState init pass');
