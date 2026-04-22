const renderer = new TerrariumRenderer('terrarium');
let ws;
let selectedActions = {};
let totalActions = 0;
let isFirstResult = true; // 标记是否为初始状态（start_game 返回）

// --- Logging ---
function log(tag, msg) {
  const ts = new Date().toLocaleTimeString();
  console.log(`[${ts}] [Client] ${tag}: ${msg}`);
}

// --- 材料 id → 中文名 映射 ---
const MATERIAL_NAME = {};
MATERIALS.forEach(m => { MATERIAL_NAME[m.id] = m.emoji + m.name; });

// --- 向日志面板追加一条（新的在最下面，自动滚到底部） ---
function appendLog(html) {
  const logPanel = document.getElementById('log-panel');
  const div = document.createElement('div');
  div.className = 'log-day';
  div.innerHTML = html;
  logPanel.appendChild(div);
  logPanel.scrollTop = logPanel.scrollHeight;
}

// --- WebSocket ---
function initWS() {
  log('WS', 'Connecting to ws://localhost:30001...');
  ws = new WebSocket('ws://localhost:30001');

  ws.onopen = () => {
    log('WS', 'Connected');
    ws.send(JSON.stringify({ type: 'start_game' }));
    log('SEND', 'start_game');
  };

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    log('RECV', `type=${msg.type} day=${msg.day || '-'} season=${msg.season || '-'}`);

    if (msg.type === 'day_result') {
      handleDayResult(msg);
    } else if (msg.type === 'game_over') {
      log('GAME', `Game Over! score=${JSON.stringify(msg.score)}`);
      handleDayResult(msg);
      showGameOver(msg);
    }
  };

  ws.onclose = () => {
    log('WS', 'Disconnected, reconnecting in 2s...');
    setTimeout(initWS, 2000);
  };

  ws.onerror = (err) => log('WS', `Error: ${err.message || err}`);
}

// --- Handle day result ---
function handleDayResult(data) {
  log('UI', `Updating UI for day ${data.day}`);

  // Update header
  document.getElementById('title-day').textContent = `🌿 微型生态瓶 Day ${data.day}/20`;
  const seasonLabel = SEASON_LABEL[data.season] || data.season;
  const env = data.environment || data.state?.environment;
  if (env) {
    document.getElementById('season-temp').innerHTML = `${seasonLabel} <span title="温度：影响动植物存活">🌡️${env.temperature}℃</span>`;
    document.getElementById('env-stats').innerHTML = `<span title="湿度：0=干燥 5=适中 10=水涝&#10;过低植物枯萎，过高淹死地面动物">💧${env.humidity}</span> <span title="阳光：0=无光 5=适中 10=暴晒&#10;过强灼伤嫩芽，不足植物停滞">☀️${env.sunlight}</span> <span title="肥力：0=贫瘠 10=肥沃&#10;由腐殖质、蚯蚓等积累">🌱${env.fertility}</span>`;
  }

  // Render canvas
  renderer.setSeason(data.season);
  const entities = data.entities || data.state?.entities || [];
  log('RENDER', `Drawing ${entities.length} entity types on canvas`);
  renderer.renderWithTransition(entities);

  // Update log panel
  if (data.log) {
    let html;
    if (isFirstResult) {
      html = data.log;
      isFirstResult = false;
    } else {
      const actionDay = data.day - 1;
      html = `<strong>Day ${actionDay} 生态日志：</strong><br>${data.log}`;
      if (data.events && data.events.length > 0) {
        const eventText = data.events.map(ev => ev.description || ev.type).join('<br>');
        html += `<div class="log-events">${eventText}</div>`;
        log('EVENTS', data.events.map(ev => ev.description || ev.type).join(', '));
      }
    }
    appendLog(html);
  }

  // 服务器返回数据和当前状态 → console
  if (env) {
    const entitiesSummary = entities.map(e => `${e.emoji}${e.type}x${e.quantity}`).join(' ');
    log('STATE', `Day ${data.day} ${data.season} 🌡️${env.temperature}℃ 💧${env.humidity} ☀️${env.sunlight} 🌱${env.fertility}`);
    log('STATE', `瓶内: ${entitiesSummary || '空'}`);
    log('RAW', JSON.stringify(data));
  }

  // Re-enable UI
  resetSelection();
  const confirmBtn = document.getElementById('btn-confirm');
  confirmBtn.disabled = false;
  confirmBtn.textContent = '▶️ 确认';
}

// --- Material selection ---
function initUI() {
  const container = document.getElementById('material-btns');
  MATERIALS.forEach(mat => {
    const btn = document.createElement('div');
    btn.className = 'mat-btn';
    btn.id = `mat-${mat.id}`;
    btn.title = mat.tip;
    btn.innerHTML = `${mat.emoji} ${mat.name}<div class="badge" id="badge-${mat.id}">0</div>`;
    btn.onclick = () => selectMaterial(mat.id);
    btn.oncontextmenu = (e) => { e.preventDefault(); removeMaterial(mat.id); };
    container.appendChild(btn);
  });

  document.getElementById('btn-confirm').onclick = confirmActions;
  log('UI', 'Material buttons initialized');
}

function selectMaterial(id) {
  if (totalActions >= MAX_ACTIONS) {
    log('UI', `Max actions reached (${MAX_ACTIONS}), ignoring ${id}`);
    return;
  }
  selectedActions[id] = (selectedActions[id] || 0) + 1;
  totalActions++;
  log('UI', `Selected ${id} (total: ${totalActions}/${MAX_ACTIONS})`);
  updateSelectionUI();
}

function removeMaterial(id) {
  if (!selectedActions[id] || selectedActions[id] <= 0) return;
  selectedActions[id]--;
  totalActions--;
  if (selectedActions[id] === 0) delete selectedActions[id];
  log('UI', `Removed ${id} (total: ${totalActions}/${MAX_ACTIONS})`);
  updateSelectionUI();
}

function updateSelectionUI() {
  document.getElementById('action-remain').textContent = MAX_ACTIONS - totalActions;
  MATERIALS.forEach(mat => {
    const badge = document.getElementById(`badge-${mat.id}`);
    const btn = document.getElementById(`mat-${mat.id}`);
    const count = selectedActions[mat.id] || 0;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'block' : 'none';
    btn.classList.toggle('selected', count > 0);
  });
  document.getElementById('btn-confirm').disabled = false;
}

function resetSelection() {
  selectedActions = {};
  totalActions = 0;
  updateSelectionUI();
}

// --- Actions ---
function confirmActions() {
  const confirmBtn = document.getElementById('btn-confirm');
  confirmBtn.disabled = true;
  confirmBtn.textContent = '🔄 推演中...';

  const actions = Object.entries(selectedActions)
    .filter(([_, qty]) => qty > 0)
    .map(([item, quantity]) => ({ item, quantity }));

  // 先打印玩家操作日志
  const currentDay = document.getElementById('title-day').textContent.match(/Day (\d+)/);
  const dayNum = currentDay ? parseInt(currentDay[1]) : '?';
  if (actions.length > 0) {
    const itemsText = actions.map(a => {
      const name = MATERIAL_NAME[a.item] || a.item;
      return a.quantity > 1 ? `${name}x${a.quantity}` : name;
    }).join('、');
    appendLog(`<strong>Day ${dayNum}</strong> 你放入了 ${itemsText}`);
  } else {
    appendLog(`<strong>Day ${dayNum}</strong> 你什么都没放，静静观察着生态瓶...`);
  }

  log('SEND', `player_action actions=${JSON.stringify(actions)}`);
  ws.send(JSON.stringify({ type: 'player_action', actions }));
}

// --- Game Over ---
function showGameOver(data) {
  document.getElementById('btn-confirm').disabled = true;

  const score = data.score || { total: 0, diversity: 0, balance: 0 };

  let rating = 'D', title = '生态灾难';
  if (score.total >= 90) { rating = 'S'; title = '生态大师'; }
  else if (score.total >= 80) { rating = 'A'; title = '自然守护者'; }
  else if (score.total >= 60) { rating = 'B'; title = '园艺爱好者'; }
  else if (score.total >= 40) { rating = 'C'; title = '生态新手'; }

  const overlay = document.createElement('div');
  overlay.className = 'game-over-overlay';
  overlay.innerHTML = `
    <div class="game-over-card">
      <h2>🌿 你的生态瓶故事 🌿</h2>
      <div class="score-row"><span>🌍 生物多样性</span><span>${score.diversity} 种</span></div>
      <div class="score-row"><span>⚖️ 生态平衡</span><span>${score.balance} 分</span></div>
      <div class="score-total">总分: ${score.total}/100 — ${rating} ${title}</div>
      <button class="restart-btn" onclick="location.reload()">🔄 再来一次</button>
    </div>`;
  document.body.appendChild(overlay);
}

// --- Init ---
window.onload = () => {
  log('INIT', 'App starting...');
  initUI();
  initWS();
};
