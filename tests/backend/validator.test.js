const assert = require('assert');
const { validateAndFix } = require('../../backend/validator');

const oldState = {
  day: 1, season: 'spring',
  environment: { sunlight: 5, humidity: 5, temperature: 15, fertility: 5 },
  entities: [{ type: 'soil', emoji: '🟫', quantity: 3, layer: 'underground', status: 'healthy' }]
};

// Test 1: Out of range values get clamped
const badState = { day: 2, environment: { sunlight: 15, humidity: -2, temperature: 20, fertility: 12 } };
const fixed = validateAndFix(badState, oldState);
assert.strictEqual(fixed.environment.sunlight, 10); // clamped to max
assert.strictEqual(fixed.environment.humidity, 0);   // clamped to min
assert.strictEqual(fixed.environment.fertility, 10);  // clamped to max
assert.ok(Array.isArray(fixed.entities)); // fallback to old entities
console.log('Validator test 1 pass');

// Test 2: Zero quantity entities removed
const stateWithZero = {
  day: 2, season: 'spring',
  environment: { sunlight: 5, humidity: 5, temperature: 15, fertility: 5 },
  entities: [
    { type: 'soil', emoji: '🟫', quantity: 3, layer: 'underground', status: 'healthy' },
    { type: 'grass', emoji: '🌿', quantity: 0, layer: 'low', status: 'dead' }
  ]
};
const fixed2 = validateAndFix(stateWithZero, oldState);
assert.strictEqual(fixed2.entities.length, 1); // grass removed
console.log('Validator test 2 pass');

console.log('All validator tests pass');
