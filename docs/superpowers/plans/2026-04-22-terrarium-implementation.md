# 微型生态瓶推演游戏 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个基于 H5 Canvas 和 LLM 的微型生态推演游戏，前端渲染生态瓶和交互，后端调用本地 `codemaker` CLI 进行推演并通过 WebSocket 通信。

**Architecture:** 前端纯 HTML/JS/CSS，基于 Canvas 绘制网格。后端 Node.js 提供 WebSocket 服务，维护全局状态，每次收到玩家操作后组装 prompt 调用 CLI，解析 JSON 并广播新状态。

**Tech Stack:** HTML5 Canvas, Vanilla JS, Node.js, `ws` (WebSocket), `child_process` (Codemaker CLI).

---

## 阶段 1: 基础设施与数据模型

### Task 1: 初始化项目结构和后端基础

**Files:**
- Create: `package.json` (update)
- Create: `backend/server.js`
- Create: `backend/gameState.js`

- [ ] **Step 1: Write the failing test for GameState initialization**
```javascript
// tests/backend/gameState.test.js
const assert = require('assert');
const { GameState } = require('../../backend/gameState');

const state = new GameState();
const initial = state.get();
assert.strictEqual(initial.day, 1);
assert.strictEqual(initial.season, 'spring');
assert.strictEqual(initial.environment.temperature, 15);
console.log('GameState init pass');
```

- [ ] **Step 2: Run test to verify it fails**
Run: `node tests/backend/gameState.test.js`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**
```javascript
// package.json (update)
{
  "name": "terrarium-game",
  "version": "1.0.0",
  "main": "backend/server.js",
  "dependencies": {
    "ws": "^8.16.0"
  },
  "scripts": {
    "start": "node backend/server.js"
  }
}

// backend/gameState.js
class GameState {
  constructor() {
    this.state = {
      day: 1,
      season: 'spring',
      environment: { sunlight: 5, humidity: 5, temperature: 15, fertility: 5 },
      entities: [],
      log: '欢迎来到你的生态瓶，往里面放点什么吧',
      events: []
    };
  }
  get() { return this.state; }
  update(newState) { this.state = newState; }
}
module.exports = { GameState };
```

- [ ] **Step 4: Install dependencies and run test**
Run: `npm install && node tests/backend/gameState.test.js`
Expected: PASS with "GameState init pass"

- [ ] **Step 5: Commit**
```bash
git add package.json backend/gameState.js tests/backend/gameState.test.js
git commit -m "feat: init project structure and GameState model"
```

### Task 2: 实现 WebSocket Server 基础框架

**Files:**
- Create: `backend/server.js`
- Create: `tests/backend/server.test.js`

- [ ] **Step 1: Write the failing test**
```javascript
// tests/backend/server.test.js
const WebSocket = require('ws');
const { startServer } = require('../../backend/server');

const wss = startServer(3002);
const ws = new WebSocket('ws://localhost:3002');

ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'start_game' }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'day_result') {
    console.log('Server test pass');
    ws.close();
    wss.close();
    process.exit(0);
  }
});

setTimeout(() => {
  console.error('Server test timeout');
  process.exit(1);
}, 2000);
```

- [ ] **Step 2: Run test to verify it fails**
Run: `node tests/backend/server.test.js`
Expected: FAIL with "Cannot find module" or connection refused

- [ ] **Step 3: Write minimal implementation**
```javascript
// backend/server.js
const WebSocket = require('ws');
const { GameState } = require('./gameState');

function startServer(port = 3001) {
  const wss = new WebSocket.Server({ port });
  const gameState = new GameState();

  wss.on('connection', (ws) => {
    ws.on('message', (message) => {
      try {
        const msg = JSON.parse(message);
        if (msg.type === 'start_game') {
          ws.send(JSON.stringify({
            type: 'day_result',
            ...gameState.get()
          }));
        }
      } catch (e) {
        console.error('Invalid message', e);
      }
    });
  });
  
  console.log(`WebSocket server started on port ${port}`);
  return wss;
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
```

- [ ] **Step 4: Run test to verify it passes**
Run: `node tests/backend/server.test.js`
Expected: PASS with "Server test pass"

- [ ] **Step 5: Commit**
```bash
git add backend/server.js tests/backend/server.test.js
git commit -m "feat: implement basic WebSocket server"
```

---

## 阶段 2: LLM 推演核心

### Task 3: 编写规则文本与 Prompt 生成器

**Files:**
- Create: `backend/rules.txt`
- Create: `backend/prompt.js`
- Create: `tests/backend/prompt.test.js`

- [ ] **Step 1: Write the failing test**
```javascript
// tests/backend/prompt.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**
Run: `node tests/backend/prompt.test.js`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**
```javascript
// backend/rules.txt
// (将设计文档中 Section 6 的规则简写放入此处，确保 LLM 能理解)
1. 无土不生长：soil=0 时种子不发芽，植物每天 quantity -0.5。
2. 水分控制：humidity<=1 植物枯萎，humidity>=9 地面动物淹死。
3. 数量守恒：实体必须有规则依据才能增减，数量精确到小数点后1位。

// backend/prompt.js
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
```

- [ ] **Step 4: Run test to verify it passes**
Run: `node tests/backend/prompt.test.js`
Expected: PASS with "Prompt generation pass"

- [ ] **Step 5: Commit**
```bash
git add backend/rules.txt backend/prompt.js tests/backend/prompt.test.js
git commit -m "feat: add prompt generator and rules"
```

### Task 4: 实现 LLM 调用与解析 (Mock for testing)

**Files:**
- Create: `backend/llm.js`
- Create: `tests/backend/llm.test.js`

- [ ] **Step 1: Write the failing test**
```javascript
// tests/backend/llm.test.js
const assert = require('assert');
const { invokeLLM } = require('../../backend/llm');

(async () => {
  // Use a mock prompt for testing fast
  const result = await invokeLLM('{"day": 2, "season": "spring"}', true); 
  assert.strictEqual(result.day, 2);
  console.log('LLM invoke mock pass');
})();
```

- [ ] **Step 2: Run test to verify it fails**
Run: `node tests/backend/llm.test.js`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**
```javascript
// backend/llm.js
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function invokeLLM(promptText, mock = false) {
  if (mock) {
    // For unit tests, just return parsed mock JSON
    try { return JSON.parse(promptText); } catch (e) { return null; }
  }

  const tempFile = path.join(os.tmpdir(), `terrarium_prompt_${Date.now()}.txt`);
  fs.writeFileSync(tempFile, promptText);

  return new Promise((resolve, reject) => {
    // 实际调用 codemaker CLI
    exec(`codemaker chat --no-interactive < "${tempFile}"`, (error, stdout, stderr) => {
      fs.unlinkSync(tempFile); // cleanup
      
      try {
        // 尝试直接解析
        resolve(JSON.parse(stdout));
      } catch (e) {
        // 尝试提取 markdown json 块
        const match = stdout.match(/```json\s*([\s\S]*?)\s*```/);
        if (match && match[1]) {
          try { resolve(JSON.parse(match[1])); }
          catch (e2) { reject(new Error('Failed to parse LLM output')); }
        } else {
          reject(new Error('No JSON found in LLM output'));
        }
      }
    });
  });
}

module.exports = { invokeLLM };
```

- [ ] **Step 4: Run test to verify it passes**
Run: `node tests/backend/llm.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add backend/llm.js tests/backend/llm.test.js
git commit -m "feat: add LLM CLI invocation and JSON parser"
```

### Task 5: 实现校验器与后端主流程整合

**Files:**
- Create: `backend/validator.js`
- Modify: `backend/server.js`
- Create: `tests/backend/validator.test.js`

- [ ] **Step 1: Write failing test for validator**
```javascript
// tests/backend/validator.test.js
const assert = require('assert');
const { validateAndFix } = require('../../backend/validator');

const oldState = { day: 1, season: 'spring' };
const badState = { day: 2, environment: { sunlight: 15, humidity: -2 } }; 
// Missing entities, out of bounds values

const fixed = validateAndFix(badState, oldState);
assert.strictEqual(fixed.environment.sunlight, 10);
assert.strictEqual(fixed.environment.humidity, 0);
assert.ok(Array.isArray(fixed.entities));
console.log('Validator pass');
```

- [ ] **Step 2: Run test to verify it fails**
Run: `node tests/backend/validator.test.js`

- [ ] **Step 3: Write minimal implementation**
```javascript
// backend/validator.js
function validateAndFix(newState, oldState) {
  const result = { ...newState };
  
  // 1. 完整性
  if (!result.day) result.day = oldState.day + 1;
  if (!result.season) result.season = oldState.season;
  if (!result.entities || !Array.isArray(result.entities)) result.entities = oldState.entities || [];
  if (!result.log) result.log = "今天很平静。";
  if (!result.events || !Array.isArray(result.events)) result.events = [];
  
  // 2. 环境参数范围
  if (result.environment) {
    result.environment.sunlight = Math.max(0, Math.min(10, result.environment.sunlight || 5));
    result.environment.humidity = Math.max(0, Math.min(10, result.environment.humidity || 5));
    result.environment.fertility = Math.max(0, Math.min(10, result.environment.fertility || 5));
    // 温度可以负数，不限制 0-10
    result.environment.temperature = result.environment.temperature ?? oldState.environment.temperature;
  } else {
    result.environment = { ...oldState.environment };
  }

  // 3. 实体清理 (移除 quantity <= 0 的实体)
  result.entities = result.entities.filter(e => e.quantity > 0);

  return result;
}
module.exports = { validateAndFix };
```
```javascript
// Modify backend/server.js to integrate logic
const WebSocket = require('ws');
const { GameState } = require('./gameState');
const { generatePrompt } = require('./prompt');
const { invokeLLM } = require('./llm');
const { validateAndFix } = require('./validator');

function startServer(port = 3001, mockLLM = false) {
  const wss = new WebSocket.Server({ port });
  const gameState = new GameState();

  wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
      try {
        const msg = JSON.parse(message);
        if (msg.type === 'start_game') {
          ws.send(JSON.stringify({ type: 'day_result', ...gameState.get() }));
        } else if (msg.type === 'player_action') {
          const promptText = generatePrompt(gameState.get(), msg.actions || []);
          
          let nextStateRaw;
          try {
            nextStateRaw = await invokeLLM(promptText, mockLLM);
          } catch (err) {
            console.error("LLM Error, retrying...", err);
            // Simple retry logic could go here, for now just use old state + 1 day
            nextStateRaw = { ...gameState.get(), day: gameState.get().day + 1 };
          }

          const fixedState = validateAndFix(nextStateRaw, gameState.get());
          gameState.update(fixedState);
          
          ws.send(JSON.stringify({ type: 'day_result', ...gameState.get() }));
        }
      } catch (e) { console.error(e); }
    });
  });
  return wss;
}
if (require.main === module) startServer();
module.exports = { startServer };
```

- [ ] **Step 4: Run test to verify it passes**
Run: `node tests/backend/validator.test.js`

- [ ] **Step 5: Commit**
```bash
git add backend/validator.js backend/server.js tests/backend/validator.test.js
git commit -m "feat: integrate LLM logic and state validation in server"
```

---

## 阶段 3: 前端基础与 Canvas 渲染

### Task 6: 前端骨架与基础样式

**Files:**
- Create: `frontend/index.html`
- Create: `frontend/style.css`
- Create: `frontend/constants.js`

- [ ] **Step 1: Write HTML & CSS files**
```html
<!-- frontend/index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>微型生态瓶</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="header">
    <span id="title-day">🌿 微型生态瓶 Day 1/100</span>
    <span id="season-temp">🌸春天 🌡️15℃</span>
    <span id="env-stats">💧5 ☀️5 🌱5</span>
  </div>
  
  <div class="main-container">
    <div class="canvas-container">
      <canvas id="terrarium" width="480" height="320"></canvas>
    </div>
    <div class="log-container" id="log-panel">
      <!-- logs go here -->
    </div>
  </div>

  <div class="controls">
    <div class="actions-header">今日操作 (剩余 <span id="action-remain">3</span>/3)</div>
    <div class="materials" id="material-btns"></div>
    <div class="action-buttons">
      <button id="btn-pause">⏸ 暂停</button>
      <button id="btn-confirm" disabled>▶️ 确认</button>
    </div>
  </div>

  <script src="constants.js"></script>
  <script src="canvas.js"></script>
  <script src="app.js"></script>
</body>
</html>
```
```css
/* frontend/style.css */
body { font-family: sans-serif; margin: 0; padding: 20px; background: #f0f0f0; display: flex; flex-direction: column; align-items: center; }
.header { width: 800px; display: flex; justify-content: space-between; background: white; padding: 10px 20px; border-radius: 8px; margin-bottom: 10px; font-weight: bold; }
.main-container { width: 840px; display: flex; gap: 20px; margin-bottom: 10px; }
.canvas-container { background: #E8F5E9; border-radius: 20px; padding: 10px; border: 4px solid rgba(255,255,255,0.5); box-shadow: inset 0 0 20px rgba(0,0,0,0.1); transition: background 1s; }
canvas { display: block; }
.log-container { flex: 1; background: white; border-radius: 8px; padding: 15px; height: 310px; overflow-y: auto; font-size: 14px; }
.log-day { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
.controls { width: 800px; background: white; padding: 15px 20px; border-radius: 8px; }
.materials { display: flex; flex-wrap: wrap; gap: 10px; margin: 10px 0; }
.mat-btn { padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; background: #fafafa; cursor: pointer; position: relative; }
.mat-btn.selected { border-color: #4CAF50; background: #E8F5E9; }
.badge { position: absolute; top: -5px; right: -5px; background: #f44336; color: white; border-radius: 50%; width: 18px; height: 18px; font-size: 12px; text-align: center; line-height: 18px; display: none; }
.action-buttons { display: flex; justify-content: flex-end; gap: 10px; }
button { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; background: #2196F3; color: white; }
button:disabled { background: #ccc; cursor: not-allowed; }
#btn-pause { background: #FF9800; }
```
```javascript
// frontend/constants.js
const MATERIALS = [
  { id: 'soil', emoji: '🟫', name: '土壤' },
  { id: 'water', emoji: '💧', name: '水' },
  { id: 'sunlight', emoji: '☀️', name: '阳光' },
  { id: 'seed', emoji: '🫘', name: '种子' },
  { id: 'flower_seed', emoji: '🌸', name: '花种' },
  { id: 'stone', emoji: '🪨', name: '石头' },
  { id: 'branch', emoji: '🪵', name: '枯枝' },
  { id: 'earthworm', emoji: '🪱', name: '蚯蚓' },
  { id: 'ant', emoji: '🐜', name: '蚂蚁' },
  { id: 'mouse', emoji: '🐭', name: '老鼠' },
  { id: 'bird', emoji: '🐦', name: '小鸟' },
  { id: 'frog', emoji: '🐸', name: '青蛙' },
  { id: 'snail', emoji: '🐌', name: '蜗牛' }
];

const LAYER_ROWS = {
  sky: [0, 1], high: [2], mid: [3], low: [4], surface: [5], underground: [6, 7]
};
const COLS = 12;
const ROWS = 8;
const CELL_W = 40; // 480/12
const CELL_H = 40; // 320/8
```

- [ ] **Step 2: Commit**
```bash
git add frontend/index.html frontend/style.css frontend/constants.js
git commit -m "feat: add frontend HTML shell and basic styles"
```

### Task 7: Canvas 渲染逻辑

**Files:**
- Create: `frontend/canvas.js`

- [ ] **Step 1: Write Canvas rendering logic**
```javascript
// frontend/canvas.js
class TerrariumRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.font = '28px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
  }

  setSeason(season) {
    const bgMap = { spring: '#E8F5E9', summer: '#FFF8E1', autumn: '#FBE9E7', winter: '#E3F2FD' };
    this.canvas.parentElement.style.background = bgMap[season] || bgMap.spring;
  }

  render(entities) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 按 layer 分组
    const layerMap = { sky:[], high:[], mid:[], low:[], surface:[], underground:[] };
    entities.forEach(e => {
      const q = Math.floor(e.quantity) || 1; // 至少显示1个（如果 quantity > 0）
      for (let i = 0; i < q; i++) {
        if (layerMap[e.layer]) layerMap[e.layer].push(e.emoji);
      }
    });

    // 绘制网格
    for (const [layer, rows] of Object.entries(LAYER_ROWS)) {
      const items = layerMap[layer] || [];
      const totalCells = rows.length * COLS;
      
      // 简单随机分配格子，为避免重叠使用 Set 记录已占用的 cellIndex
      const usedCells = new Set();
      
      items.forEach(emoji => {
        let attempts = 0;
        let cellIndex;
        do {
          cellIndex = Math.floor(Math.random() * totalCells);
          attempts++;
        } while (usedCells.has(cellIndex) && attempts < 10);
        
        usedCells.add(cellIndex);
        
        const rowOffset = Math.floor(cellIndex / COLS);
        const col = cellIndex % COLS;
        const row = rows[0] + rowOffset;
        
        const x = col * CELL_W + CELL_W/2 + (Math.random()*6 - 3); // 轻微抖动
        const y = row * CELL_H + CELL_H/2 + (Math.random()*6 - 3);
        
        this.ctx.fillText(emoji, x, y);
      });
    }
  }
}
```

- [ ] **Step 2: Commit**
```bash
git add frontend/canvas.js
git commit -m "feat: implement Canvas grid rendering logic"
```

---

## 阶段 4: 前端交互与 WebSocket 集成

### Task 8: WebSocket 通信与 UI 更新

**Files:**
- Create: `frontend/app.js`

- [ ] **Step 1: Write app logic**
```javascript
// frontend/app.js
const renderer = new TerrariumRenderer('terrarium');
let ws;
let selectedActions = {}; // id -> count
let totalActions = 0;
let isPaused = false;
let autoTimer = null;

function initWS() {
  ws = new WebSocket('ws://localhost:3001');
  ws.onopen = () => ws.send(JSON.stringify({ type: 'start_game' }));
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'day_result') handleDayResult(msg);
  };
  ws.onclose = () => setTimeout(initWS, 2000); // auto reconnect
}

function handleDayResult(data) {
  // 1. Update Top Bar
  const seasonMap = { spring: '🌸春天', summer: '☀️夏天', autumn: '🍂秋天', winter: '❄️冬天' };
  document.getElementById('title-day').textContent = `🌿 微型生态瓶 Day ${data.day}/100`;
  document.getElementById('season-temp').textContent = `${seasonMap[data.season] || data.season} 🌡️${data.environment.temperature}℃`;
  document.getElementById('env-stats').textContent = `💧${data.environment.humidity} ☀️${data.environment.sunlight} 🌱${data.environment.fertility}`;
  
  // 2. Render Canvas
  renderer.setSeason(data.season);
  renderer.render(data.state.entities || []);

  // 3. Update Log
  const logPanel = document.getElementById('log-panel');
  const div = document.createElement('div');
  div.className = 'log-day';
  div.innerHTML = `<strong>Day ${data.day}:</strong> ${data.log}<br>`;
  if (data.events && data.events.length) {
    div.innerHTML += `<div style="color:#666; margin-top:5px; font-size:12px;">Events: ${data.events.map(e => e.description).join(', ')}</div>`;
  }
  logPanel.insertBefore(div, logPanel.firstChild);

  // 4. Reset UI & Start auto-advance
  resetSelection();
  document.getElementById('btn-confirm').disabled = false;
  document.getElementById('btn-confirm').textContent = '▶️ 确认';
  
  if (!isPaused) startAutoAdvance();
}

function initUI() {
  const btnContainer = document.getElementById('material-btns');
  MATERIALS.forEach(mat => {
    const btn = document.createElement('div');
    btn.className = 'mat-btn';
    btn.innerHTML = `${mat.emoji} ${mat.name}<div class="badge" id="badge-${mat.id}">0</div>`;
    btn.onclick = () => selectMaterial(mat.id);
    btnContainer.appendChild(btn);
  });

  document.getElementById('btn-confirm').onclick = confirmActions;
  document.getElementById('btn-pause').onclick = togglePause;
}

function selectMaterial(id) {
  if (totalActions >= 3) return;
  selectedActions[id] = (selectedActions[id] || 0) + 1;
  totalActions++;
  updateSelectionUI();
  
  // Interrupt auto-advance if player clicks
  if (autoTimer) {
    clearTimeout(autoTimer);
    autoTimer = null;
  }
}

function updateSelectionUI() {
  document.getElementById('action-remain').textContent = 3 - totalActions;
  MATERIALS.forEach(mat => {
    const badge = document.getElementById(`badge-${mat.id}`);
    const count = selectedActions[mat.id] || 0;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'block' : 'none';
    badge.parentElement.classList.toggle('selected', count > 0);
  });
}

function resetSelection() {
  selectedActions = {};
  totalActions = 0;
  updateSelectionUI();
}

function confirmActions() {
  if (autoTimer) clearTimeout(autoTimer);
  document.getElementById('btn-confirm').disabled = true;
  document.getElementById('btn-confirm').textContent = '推演中...';
  
  const actionsArray = Object.keys(selectedActions).map(id => ({
    item: id, quantity: selectedActions[id]
  }));
  
  ws.send(JSON.stringify({ type: 'player_action', actions: actionsArray }));
}

function togglePause() {
  isPaused = !isPaused;
  const btn = document.getElementById('btn-pause');
  btn.textContent = isPaused ? '▶️ 继续自动' : '⏸ 暂停';
  if (!isPaused) startAutoAdvance();
  else if (autoTimer) clearTimeout(autoTimer);
}

function startAutoAdvance() {
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = setTimeout(() => {
    if (!isPaused && totalActions === 0) confirmActions(); // 自动提交空操作
  }, 3000);
}

window.onload = () => {
  initUI();
  initWS();
};
```

- [ ] **Step 2: Commit**
```bash
git add frontend/app.js
git commit -m "feat: implement frontend interaction logic and WebSocket client"
```

---

## 阶段 5: 最终整合与评分系统

### Task 9: 添加评分逻辑 (Backend)

**Files:**
- Modify: `backend/server.js`
- Create: `backend/scorer.js`

- [ ] **Step 1: Write scorer module**
```javascript
// backend/scorer.js
function calculateScore(finalState) {
  let score = 0;
  const entities = finalState.entities || [];
  
  // 1. 多样性 (max 40)
  const uniqueSpecies = new Set(entities.map(e => e.type)).size;
  if (uniqueSpecies >= 10) score += 40;
  else if (uniqueSpecies >= 7) score += 30;
  else if (uniqueSpecies >= 4) score += 20;
  else if (uniqueSpecies >= 1) score += 10;
  
  // 2. 生态平衡 (max 30) - 简单模拟
  let balance = 0;
  const hasPlant = entities.some(e => ['sprout','grass','bush'].includes(e.type));
  const hasHerbivore = entities.some(e => ['mouse','caterpillar'].includes(e.type));
  const hasPredator = entities.some(e => ['bird','spider'].includes(e.type));
  if (hasPlant && hasHerbivore && hasPredator) balance += 10;
  else if (hasPlant && hasHerbivore) balance += 6;
  
  const env = finalState.environment;
  if (env.sunlight>=3&&env.sunlight<=7 && env.humidity>=3&&env.humidity<=7) balance += 10;
  
  const plantCount = entities.filter(e => ['grass','bush','flower'].includes(e.type)).reduce((sum, e) => sum + e.quantity, 0);
  if (plantCount >= 5) balance += 10;
  
  score += balance;
  
  // 3. 生存韧性 (max 20)
  if (finalState.day >= 100 && entities.length > 0) score += 20;
  else if (entities.length > 0) score += 10;

  return { total: score, diversity: uniqueSpecies, balance };
}
module.exports = { calculateScore };
```

- [ ] **Step 2: Update server to handle day 100**
```javascript
// Append to backend/server.js in the message handler
const { calculateScore } = require('./scorer');

// Inside ws.on('message'):
// after gameState.update(fixedState);
if (gameState.get().day >= 100) {
  const score = calculateScore(gameState.get());
  ws.send(JSON.stringify({ 
    type: 'game_over', 
    ...gameState.get(),
    score 
  }));
} else {
  ws.send(JSON.stringify({ type: 'day_result', ...gameState.get() }));
}
```

- [ ] **Step 3: Update app.js to handle game_over**
```javascript
// Append to handleDayResult in frontend/app.js:
// change ws.onmessage
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === 'day_result') handleDayResult(msg);
  else if (msg.type === 'game_over') {
    handleDayResult(msg);
    showGameOver(msg.score);
  }
};

function showGameOver(score) {
  if (autoTimer) clearTimeout(autoTimer);
  document.getElementById('btn-confirm').disabled = true;
  document.getElementById('btn-pause').disabled = true;
  
  const div = document.createElement('div');
  div.style.position = 'fixed';
  div.style.top = '50%'; div.style.left = '50%';
  div.style.transform = 'translate(-50%, -50%)';
  div.style.background = 'rgba(0,0,0,0.8)';
  div.style.color = 'white';
  div.style.padding = '40px';
  div.style.borderRadius = '10px';
  div.style.textAlign = 'center';
  div.innerHTML = `<h2>100天推演结束</h2>
  <p>最终得分: ${score.total}/100</p>
  <button onclick="location.reload()" style="margin-top:20px; font-size:18px;">再来一次</button>`;
  document.body.appendChild(div);
}
```

- [ ] **Step 4: Commit**
```bash
git add backend/server.js backend/scorer.js frontend/app.js
git commit -m "feat: add scoring system and day 100 game over state"
```
