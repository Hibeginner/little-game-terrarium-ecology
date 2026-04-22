const fs = require('fs');
const path = require('path');

function generatePrompt(state, actions) {
  const rulesPath = path.join(__dirname, 'rules.txt');
  const rules = fs.existsSync(rulesPath) ? fs.readFileSync(rulesPath, 'utf8') : '';
  
  const seasonCnMap = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
  const seasonCn = seasonCnMap[state.season] || state.season;

  return `你是一个微型生态瓶模拟器。请根据规则推演下一天状态并以JSON输出。
## 规则
${rules}

## 当前状态
- 第 ${state.day} 天 / ${state.season}（${seasonCn}）
- 温度：${state.environment.temperature}℃
- 环境：sunlight=${state.environment.sunlight}, humidity=${state.environment.humidity}, fertility=${state.environment.fertility}

## 瓶内实体
${JSON.stringify(state.entities)}

## 玩家操作
${JSON.stringify(actions)}

请推演第 ${state.day + 1} 天状态，严格输出包含 day, season, environment, entities, log, events 的 JSON。`;
}

module.exports = { generatePrompt };
