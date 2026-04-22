const assert = require('assert');
const { invokeLLM } = require('../../backend/llm');

(async () => {
  // Use a mock prompt for testing fast
  const result = await invokeLLM('{"day": 2, "season": "spring"}', true); 
  assert.strictEqual(result.day, 2);
  console.log('LLM invoke mock pass');
})();
