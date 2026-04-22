const renderer = new TerrariumRenderer('terrarium');
let ws;
let selectedActions = {};
let totalActions = 0;
let isPaused = false;
let autoTimer = null;

// --- WebSocket ---
function initWS() {
  ws = new WebSocket('ws://localhost:3001');
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'start_game' }));
  };
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'day_result') {
      handleDayResult(msg);
    } else if (msg.type === 'game_over') {
      handleDayResult(msg);
      showGameOver(msg);
    }
  };
  ws.onclose = () => {
    console.log('Disconnected, reconnecting in 2s...');
    setTimeout(initWS, 2000);
  };
  ws.onerror = (err) => console.error('WS error:', err);
}

// --- Handle day result ---
function handleDayResult(data) {
  // Update header
  document.getElementById('title-day').textContent = `🌿 微型生态瓶 Day ${data.day}/100`;
  const seasonLabel = SEASON_LABEL[data.season] || data.season;
  const env = data.environment || data.state?.environment;
  if (env) {
    document.getElementById('season-temp').textContent = `${seasonLabel} 🌡️${env.temperature}℃`;
    document.getElementById('env-stats').textContent = `💧${env.humidity} ☀️${env.sunlight} 🌱${env.fertility}`;
  }

  // Render canvas
  renderer.setSeason(data.season);
  const entities = data.entities || data.state?.entities || [];
  renderer.render(entities);

  // Update log panel
  if (data.log) {
    const logPanel = document.getElementById('log-panel');
    const div = document.createElement('div');
    div.className = 'log-day';
    let html = `<strong>Day ${data.day}:</strong> ${data.log}`;
    if (data.events && data.events.length > 0) {
      const eventText = data.events.map(ev => ev.description || ev.type).join('、');
      html += `<div class="log-events">${eventText}</div>`;
    }
    div.innerHTML = html;
    logPanel.insertBefore(div, logPanel.firstChild);
  }

  // Re-enable UI
  resetSelection();
  const confirmBtn = document.getElementById('btn-confirm');
  confirmBtn.disabled = false;
  confirmBtn.textContent = '▶️ 确认';

  // Auto-advance
  if (!isPaused && data.day < 100) {
    startAutoAdvance();
  }
}

// --- Material selection ---
function initUI() {
  const container = document.getElementById('material-btns');
  MATERIALS.forEach(mat => {
    const btn = document.createElement('div');
    btn.className = 'mat-btn';
    btn.id = `mat-${mat.id}`;
    btn.innerHTML = `${mat.emoji} ${mat.name}<div class="badge" id="badge-${mat.id}">0</div>`;
    btn.onclick = () => selectMaterial(mat.id);
    container.appendChild(btn);
  });

  document.getElementById('btn-confirm').onclick = confirmActions;
  document.getElementById('btn-pause').onclick = togglePause;
}

function selectMaterial(id) {
  if (totalActions >= MAX_ACTIONS) return;
  selectedActions[id] = (selectedActions[id] || 0) + 1;
  totalActions++;
  updateSelectionUI();

  // Interrupt auto-advance when player makes a choice
  if (autoTimer) {
    clearTimeout(autoTimer);
    autoTimer = null;
  }
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

  // Enable confirm if anything selected OR allow empty submit
  document.getElementById('btn-confirm').disabled = false;
}

function resetSelection() {
  selectedActions = {};
  totalActions = 0;
  updateSelectionUI();
}

// --- Actions ---
function confirmActions() {
  if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }

  const confirmBtn = document.getElementById('btn-confirm');
  confirmBtn.disabled = true;
  confirmBtn.textContent = '🔄 推演中...';

  const actions = Object.entries(selectedActions)
    .filter(([_, qty]) => qty > 0)
    .map(([item, quantity]) => ({ item, quantity }));

  ws.send(JSON.stringify({ type: 'player_action', actions }));
}

function togglePause() {
  isPaused = !isPaused;
  const btn = document.getElementById('btn-pause');
  btn.textContent = isPaused ? '▶️ 继续' : '⏸ 暂停';
  if (isPaused && autoTimer) {
    clearTimeout(autoTimer);
    autoTimer = null;
  } else if (!isPaused) {
    startAutoAdvance();
  }
}

function startAutoAdvance() {
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = setTimeout(() => {
    if (!isPaused && totalActions === 0) {
      confirmActions(); // Auto-submit empty actions
    }
  }, AUTO_ADVANCE_DELAY);
}

// --- Game Over ---
function showGameOver(data) {
  if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  document.getElementById('btn-confirm').disabled = true;
  document.getElementById('btn-pause').disabled = true;

  const score = data.score || { total: 0, diversity: 0, balance: 0 };
  
  // Determine rating
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
  initUI();
  initWS();
};
