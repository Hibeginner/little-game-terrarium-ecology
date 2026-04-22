const assert = require('assert');
const { generatePrompt } = require('../../backend/prompt');

const state = {
  day: 1, season: 'spring',
  environment: { sunlight: 5, humidity: 5, temperature: 15, fertility: 5 },
  entities: []
};
const actions = [{ item: 'water', quantity: 1 }];

const prompt = generatePrompt(state, actions);
assert.ok(prompt.includes('第 1 天'));
assert.ok(prompt.includes('water'));
console.log('Prompt generation pass');
