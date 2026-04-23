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

// --- Diversity indicator (real-time preview of final biodiversity score) ---
function updateDiversityIndicator(entities) {
  const excluded = ['soil', 'water', 'puddle', 'stone', 'branch', 'ice',
    'fallen_leaf', 'maple_leaf', 'compost', 'bone', 'cobweb',
    'dead_plant', 'sun', 'mild_sun', 'cloud', 'rain', 'snow',
    'snowflake', 'rainbow', 'star', 'moon', 'droplet'];
  const alive = entities.filter(e => e.status !== 'dead' && e.quantity > 0 && !excluded.includes(e.type));
  const uniqueCount = new Set(alive.map(e => e.type)).size;

  // Same tiers as scorer.js
  let scorePreview, tier;
  if (uniqueCount >= 15) { scorePreview = 40; tier = 'gold'; }
  else if (uniqueCount >= 12) { scorePreview = 30; tier = 'green'; }
  else if (uniqueCount >= 8) { scorePreview = 20; tier = 'yellow'; }
  else if (uniqueCount >= 4) { scorePreview = 10; tier = 'red'; }
  else if (uniqueCount >= 1) { scorePreview = 5; tier = 'red'; }
  else { scorePreview = 0; tier = 'gray'; }

  document.getElementById('diversity-count').textContent = uniqueCount;
  const previewEl = document.getElementById('diversity-score-preview');
  previewEl.textContent = `(${scorePreview}/40分)`;
  // 整个指标变色
  const indicator = document.getElementById('diversity-indicator');
  indicator.className = `diversity-tier-${tier}`;

  // Next tier hint
  let nextHint = '';
  if (uniqueCount < 4) nextHint = `再增加 ${4 - uniqueCount} 种可提升至10分`;
  else if (uniqueCount < 8) nextHint = `再增加 ${8 - uniqueCount} 种可提升至20分`;
  else if (uniqueCount < 12) nextHint = `再增加 ${12 - uniqueCount} 种可提升至30分`;
  else if (uniqueCount < 15) nextHint = `再增加 ${15 - uniqueCount} 种可提升至满分40分`;
  else nextHint = '已达满分！';

  indicator.title = `物种丰富度：当前 ${uniqueCount} 种存活物种\n` +
    `对应结算「生物多样性」评分：${scorePreview}/40分\n` +
    `${nextHint}\n` +
    `─────────\n` +
    `存活物种：${alive.map(e => e.emoji).join(' ') || '无'}`;
}

// --- Handle day result ---
function handleDayResult(data) {
  log('UI', `Updating UI for day ${data.day}`);

  // Update header
  document.getElementById('title-day').textContent = `🌿 瓶中四季 Day ${data.day}/16`;
  const seasonLabel = SEASON_LABEL[data.season] || data.season;
  const env = data.environment || data.state?.environment;
  if (env) {
    document.getElementById('season-temp').innerHTML = `${seasonLabel} <span title="温度：影响动植物存活">🌡️${env.temperature}℃</span>`;
    document.getElementById('env-stats').innerHTML = `<span title="湿度：0=干燥 5=适中 10=水涝&#10;过低植物枯萎，过高淹死地面动物">💧${env.humidity}</span> <span title="阳光：0=无光 5=适中 10=暴晒&#10;过强灼伤嫩芽，不足植物停滞">☀️${env.sunlight}</span> <span title="肥力：0=贫瘠 10=肥沃&#10;由腐殖质、蚯蚓等积累">🌱${env.fertility}</span>`;
  }

  // Render canvas
  renderer.setSeason(data.season);
  renderer.setCrisis(data.crisis || null);
  const entities = data.entities || data.state?.entities || [];
  log('RENDER', `Drawing ${entities.length} entity types on canvas` + (data.crisis ? ` [CRISIS: ${data.crisis.name}]` : ''));
  renderer.renderWithTransition(entities);

  // Update diversity indicator (matches scorer.js logic exactly)
  updateDiversityIndicator(entities);

  // Update log panel
    if (data.log) {
    let html;
    if (isFirstResult) {
      html = data.log;
      isFirstResult = false;
    } else {
      const actionDay = data.day - 1;
      html = `<strong>Day ${actionDay} 生态日志：</strong><br>${data.log}`;

      // Crisis event banner
      if (data.crisis) {
        html = `<div class="log-crisis">${data.crisis.emoji} <strong>危机事件：${data.crisis.name}</strong> — ${data.crisis.description}</div>` + html;
      }

      if (data.events && data.events.length > 0) {
        const eventText = data.events.map(ev => {
          if (typeof ev === 'string') return ev;
          return ev.description || ev.text || ev.msg || ev.event || ev.type || JSON.stringify(ev);
        }).join('<br>');
        html += `<div class="log-events">${eventText}</div>`;
        log('EVENTS', eventText.replace(/<br>/g, ', '));
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
  MATERIAL_GROUPS.forEach(group => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'mat-group';

    const label = document.createElement('div');
    label.className = 'mat-group-label';
    label.textContent = group.label;
    groupDiv.appendChild(label);

    const itemsDiv = document.createElement('div');
    itemsDiv.className = 'mat-group-items';

    group.items.forEach(mat => {
      const btn = document.createElement('div');
      btn.className = 'mat-btn';
      btn.id = `mat-${mat.id}`;
      btn.title = mat.tip;
      btn.innerHTML = `${mat.emoji} ${mat.name}<div class="badge" id="badge-${mat.id}">0</div>`;
      btn.onclick = () => selectMaterial(mat.id);
      btn.oncontextmenu = (e) => { e.preventDefault(); removeMaterial(mat.id); };
      itemsDiv.appendChild(btn);
    });

    groupDiv.appendChild(itemsDiv);
    container.appendChild(groupDiv);
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

  const score = data.score || { total: 0, diversity: 0, diversityScore: 0, balance: 0, resilience: 0 };

  // Rating tiers
  let rating = 'D', title = '生态灾难', subtitle = '瓶中生命未能延续...';
  if (score.total >= 90) { rating = 'S'; title = '生态大师'; subtitle = '完美的微型世界！生命在这里繁荣昌盛'; }
  else if (score.total >= 80) { rating = 'A'; title = '自然守护者'; subtitle = '一个充满生机的小世界'; }
  else if (score.total >= 60) { rating = 'B'; title = '园艺爱好者'; subtitle = '不错的尝试，生态系统基本稳定'; }
  else if (score.total >= 40) { rating = 'C'; title = '生态新手'; subtitle = '还需要更多实践来维持平衡'; }

  // Collect surviving species
  const entities = data.entities || data.state?.entities || [];
  const survivors = entities
    .filter(e => e.status !== 'dead' && e.quantity > 0 && e.type !== 'soil' && e.type !== 'water')
    .map(e => ({ emoji: e.emoji, type: e.type, quantity: Math.round(e.quantity) }));

  let survivorsHtml = '';
  if (survivors.length > 0) {
    const tags = survivors.map(s =>
      `<span class="go-survivor-tag"><span class="surv-emoji">${s.emoji}</span>${ENTITY_TIPS[s.type] ? ENTITY_TIPS[s.type].split('：')[0].replace(/^.+\s/, '') : s.type} x${s.quantity}</span>`
    ).join('');
    survivorsHtml = `
      <div class="go-survivors">
        <div class="go-survivors-title">存活的生命 (${survivors.length} 种)</div>
        <div class="go-survivors-list">${tags}</div>
      </div>`;
  } else {
    survivorsHtml = `
      <div class="go-survivors">
        <div class="go-survivors-title">没有生命存活下来...</div>
      </div>`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'game-over-overlay';
  overlay.innerHTML = `
    <div class="game-over-card">
      <div class="go-title">🌿 瓶中四季 · 终章 🌿</div>

      <div class="go-rating-wrap">
        <div class="go-rating-badge rating-${rating}">${rating}</div>
        <div class="go-rating-title">${title}</div>
        <div class="go-rating-subtitle">${subtitle}</div>
      </div>

      <div class="go-scores">
        <div class="go-score-item">
          <div class="go-score-icon">🌍</div>
          <div class="go-score-info">
            <div class="go-score-label">生物多样性</div>
            <div class="go-score-sublabel">${score.diversity} 个物种存活</div>
            <div class="go-score-bar"><div class="go-score-bar-fill bar-diversity" data-width="${(score.diversityScore || 0) / 40 * 100}%"></div></div>
          </div>
          <div class="go-score-value">${score.diversityScore || 0}<span style="font-size:11px;color:#8d7b5e">/40分</span></div>
        </div>
        <div class="go-score-item">
          <div class="go-score-icon">⚖️</div>
          <div class="go-score-info">
            <div class="go-score-label">生态平衡</div>
            <div class="go-score-sublabel">食物链 + 环境 + 植被覆盖</div>
            <div class="go-score-bar"><div class="go-score-bar-fill bar-balance" data-width="${(score.balance || 0) / 30 * 100}%"></div></div>
          </div>
          <div class="go-score-value">${score.balance || 0}<span style="font-size:11px;color:#8d7b5e">/30分</span></div>
        </div>
        <div class="go-score-item">
          <div class="go-score-icon">🛡️</div>
          <div class="go-score-info">
            <div class="go-score-label">生存韧性</div>
            <div class="go-score-sublabel">度过严冬的能力</div>
            <div class="go-score-bar"><div class="go-score-bar-fill bar-resilience" data-width="${(score.resilience || 0) / 20 * 100}%"></div></div>
          </div>
          <div class="go-score-value">${score.resilience || 0}<span style="font-size:11px;color:#8d7b5e">/20分</span></div>
        </div>
      </div>

      <div class="go-total">${score.total}<span style="font-size:16px;font-weight:normal;color:#8d7b5e"> / 100 分</span></div>
      <div class="go-total-label">最终评分</div>

      ${survivorsHtml}

      <div class="go-buttons">
        <button class="restart-btn" onclick="location.reload()">🔄 再来一次</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // Animate score bars after a short delay (so CSS transition is visible)
  requestAnimationFrame(() => {
    setTimeout(() => {
      overlay.querySelectorAll('.go-score-bar-fill').forEach(bar => {
        bar.style.width = bar.dataset.width;
      });
    }, 100);
  });
}

// --- Init ---
window.onload = () => {
  log('INIT', 'App starting...');
  initUI();
  initWS();

  // Debug shortcut: Ctrl+Shift+G to preview game-over screen
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'G') {
      e.preventDefault();
      window.debugGameOver();
    }
  });
};

// --- Debug: preview game-over screen ---
// Usage: open browser console, type debugGameOver() or debugGameOver('S')
// Rating options: 'S', 'A', 'B', 'C', 'D' — or omit for random
window.debugGameOver = function(ratingHint) {
  // Remove existing overlay if any
  const existing = document.querySelector('.game-over-overlay');
  if (existing) existing.remove();

  // Generate fake score based on rating hint
  const presets = {
    S: { total: 95, diversity: 12, diversityScore: 40, balance: 28, resilience: 20 },
    A: { total: 82, diversity: 8, diversityScore: 30, balance: 25, resilience: 18 },
    B: { total: 65, diversity: 5, diversityScore: 20, balance: 18, resilience: 15 },
    C: { total: 45, diversity: 3, diversityScore: 10, balance: 12, resilience: 10 },
    D: { total: 18, diversity: 1, diversityScore: 10, balance: 4, resilience: 0 },
  };
  const r = ratingHint && presets[ratingHint.toUpperCase()] ? ratingHint.toUpperCase() : 'A';
  const score = presets[r];

  // Generate fake entities
  const fakeEntities = [
    { type: 'soil', emoji: '🟫', quantity: 5, layer: 'underground', status: 'alive' },
    { type: 'water', emoji: '💧', quantity: 3, layer: 'underground', status: 'alive' },
    { type: 'grass', emoji: '🌿', quantity: 4, layer: 'surface', status: 'alive' },
    { type: 'flower', emoji: '🌻', quantity: 2, layer: 'mid', status: 'alive' },
    { type: 'bush', emoji: '🌳', quantity: 3, layer: 'mid', status: 'alive' },
    { type: 'mushroom', emoji: '🍄', quantity: 2, layer: 'surface', status: 'alive' },
    { type: 'earthworm', emoji: '🪱', quantity: 3, layer: 'underground', status: 'alive' },
    { type: 'snail', emoji: '🐌', quantity: 2, layer: 'surface', status: 'alive' },
    { type: 'frog', emoji: '🐸', quantity: 1, layer: 'surface', status: 'alive' },
    { type: 'bird', emoji: '🐦', quantity: 1, layer: 'sky', status: 'alive' },
    { type: 'butterfly', emoji: '🦋', quantity: 2, layer: 'high', status: 'alive' },
    { type: 'ant', emoji: '🐜', quantity: 4, layer: 'surface', status: 'alive' },
  ];
  // Trim entities to match diversity count
  const visibleEntities = fakeEntities.slice(0, score.diversity + 2);

  showGameOver({
    day: 16,
    season: 'winter',
    entities: visibleEntities,
    score: score,
    environment: { temperature: -2, humidity: 4, sunlight: 3, fertility: 6 },
    log: '[调试] 这是模拟的结算界面'
  });

  log('DEBUG', `Showing game-over preview with rating ${r}`);
};
