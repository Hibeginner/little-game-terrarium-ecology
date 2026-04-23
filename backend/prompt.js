const fs = require('fs');
const path = require('path');

function generatePrompt(state, actions, crisis = null) {
  const rulesPath = path.join(__dirname, 'rules.txt');
  const rules = fs.existsSync(rulesPath) ? fs.readFileSync(rulesPath, 'utf8') : '';
  
  const seasonCnMap = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
  const seasonCn = seasonCnMap[state.season] || state.season;

  const crisisBlock = crisis
    ? `\n## 本回合危机事件\n${crisis.prompt}\n`
    : '\n## 本回合无危机事件\n';

  return `你是一个生态瓶模拟器（游戏"瓶中四季"）。请根据规则推演下一天状态并以JSON输出。
## 规则
${rules}

## 当前状态（第 ${state.day} 天 / ${state.season}（${seasonCn}））
- 温度：${state.environment.temperature}℃
- sunlight=${state.environment.sunlight}, humidity=${state.environment.humidity}, fertility=${state.environment.fertility}

## 重要：状态连续性
所有环境参数（temperature、sunlight、humidity、fertility）必须基于上面的"当前状态"数值进行调整，而不是重置为季节基准值。
例如：当前温度是14℃，如果没有特殊事件，下一天温度应在14℃附近小幅波动（±1~2℃），而不是跳回季节基准15℃。
只有玩家投放阳光、季节特殊事件（春雨、暴晒、寒潮等）才应产生较大的参数变化。
${crisisBlock}
## 瓶内实体
${JSON.stringify(state.entities)}

## 玩家今日操作
${JSON.stringify(actions)}

请推演第 ${state.day + 1} 天状态，严格按照以下 JSON 模板输出（不要输出任何 JSON 之外的内容）：

\`\`\`json
{
  "day": ${state.day + 1},
  "season": "spring|summer|autumn|winter",
  "environment": {
    "temperature": 数字,
    "sunlight": 0-10整数,
    "humidity": 0-10整数,
    "fertility": 0-10整数
  },
  "entities": [
    {"type": "类型名", "emoji": "对应emoji", "quantity": 正整数, "layer": "sky|high|mid|low|surface|underground", "status": "healthy|wilting|dormant"}
  ],
  "log": "1-3句中文，像自然纪录片旁白描述今天发生的事",
  "events": [
    {"type": "事件类型如spawn/death/grow/crisis/weather", "description": "简短中文描述，如：一只蝴蝶被花香吸引飞来"}
  ]
}
\`\`\`

要求：
- entities 数组包含瓶内所有存活实体（quantity>0），不要遗漏
- events 数组列出本回合所有发生的事件（涌现、死亡、生长、天气变化等），每个事件必须有 type 和 description 两个字段
- quantity 必须为正整数
- 不要输出 JSON 以外的任何文字`;
}

module.exports = { generatePrompt };
