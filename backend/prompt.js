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

## 当前状态（第 ${state.day} 天 / ${state.season}（${seasonCn}））
- 温度：${state.environment.temperature}℃
- sunlight=${state.environment.sunlight}, humidity=${state.environment.humidity}, fertility=${state.environment.fertility}

## 重要：状态连续性
所有环境参数（temperature、sunlight、humidity、fertility）必须基于上面的"当前状态"数值进行调整，而不是重置为季节基准值。
例如：当前温度是14℃，如果没有特殊事件，下一天温度应在14℃附近小幅波动（±1~2℃），而不是跳回季节基准15℃。
只有玩家投放阳光、季节特殊事件（春雨、暴晒、寒潮等）才应产生较大的参数变化。

## 瓶内实体
${JSON.stringify(state.entities)}

## 玩家今日操作
${JSON.stringify(actions)}

请推演第 ${state.day + 1} 天状态，严格输出包含 day, season, environment, entities, log, events 的 JSON。`;
}

module.exports = { generatePrompt };
