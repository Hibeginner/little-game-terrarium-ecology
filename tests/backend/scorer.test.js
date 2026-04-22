const assert = require('assert');
const { calculateScore } = require('../../backend/scorer');

const state = {
  day: 100,
  season: 'winter',
  environment: { sunlight: 5, humidity: 5, temperature: 3, fertility: 5 },
  entities: [
    { type: 'grass', emoji: '🌿', quantity: 5, layer: 'low', status: 'healthy' },
    { type: 'bush', emoji: '🌳', quantity: 2, layer: 'mid', status: 'healthy' },
    { type: 'mouse', emoji: '🐭', quantity: 1, layer: 'low', status: 'healthy' },
    { type: 'bird', emoji: '🐦', quantity: 1, layer: 'high', status: 'healthy' },
    { type: 'earthworm', emoji: '🪱', quantity: 2, layer: 'underground', status: 'healthy' }
  ]
};

const score = calculateScore(state);
assert.ok(score.total > 0, 'Score should be positive');
assert.strictEqual(score.diversity, 5); // 5 unique species
assert.ok(score.diversityScore === 20); // 4-6 species = 20 points
assert.ok(score.balance > 0);
assert.ok(score.resilience > 0);
console.log('Score:', JSON.stringify(score));
console.log('Scorer test pass');
