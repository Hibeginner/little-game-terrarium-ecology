class TerrariumRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.drawnItems = [];
    this.crisis = null;
    this.posCache = {}; // key: "type_layer_idx" → cellIndex, 保持未变化实体位置稳定

    // Canvas hover tooltip
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      let found = null;
      for (const item of this.drawnItems) {
        if (item.hitTest) {
          // 矩形区域检测（土壤/水背景层）
          if (item.hitTest(mx, my)) { found = item; break; }
        } else {
          const dx = mx - item.x;
          const dy = my - item.y;
          if (dx * dx + dy * dy < 18 * 18) { found = item; break; }
        }
      }

      this.canvas.title = found ? (found.tip || ENTITY_TIPS[found.type] || `${found.emoji}`) : '';
      this.canvas.style.cursor = found ? 'help' : 'default';
    });
  }

  setSeason(season) {
    const bg = SEASON_BG[season] || SEASON_BG.spring;
    this.canvas.parentElement.style.background = bg;
  }

  setCrisis(crisis) {
    this.crisis = crisis || null;
  }

  // 带渐变过渡的渲染：旧画面淡出 → 新画面淡入
  renderWithTransition(entities, duration = 600) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // 1. 截取当前画面（旧帧）
    const oldImage = this.ctx.getImageData(0, 0, w, h);

    // 2. 将新画面渲染到离屏 canvas（只渲染一次，位置固定）
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const offCtx = offscreen.getContext('2d');

    // 临时替换 ctx 来渲染到离屏
    const realCtx = this.ctx;
    this.ctx = offCtx;
    this._renderFrame(entities);
    this.ctx = realCtx;

    const newImage = offscreen;
    const bgColor = this.canvas.parentElement.style.background || '#f0f0f0';
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease in-out
      const ease = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const ctx = realCtx;
      ctx.clearRect(0, 0, w, h);

      // 旧画面淡出（putImageData 不支持 alpha，用覆盖层遮盖）
      ctx.putImageData(oldImage, 0, 0);
      ctx.save();
      ctx.globalAlpha = ease;
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      // 新画面淡入（drawImage 支持 alpha）
      ctx.save();
      ctx.globalAlpha = ease;
      ctx.drawImage(newImage, 0, 0);
      ctx.restore();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // 最终帧：直接画离屏结果，确保干净
        ctx.globalAlpha = 1.0;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(newImage, 0, 0);
      }
    };

    requestAnimationFrame(animate);
  }

  // 直接渲染（无过渡）
  render(entities) {
    this._renderFrame(entities);
  }

  _renderFrame(entities) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    this.drawnItems = [];

    // 瓶子内部可用区域
    const padLeft = 35;
    const padRight = 35;
    const padTop = 30;
    const padBottom = 10;
    const usableW = w - padLeft - padRight;
    const usableH = h - padTop - padBottom;
    const cellW = usableW / COLS;
    const cellH = usableH / ROWS;

    // --- 1. 提取土壤和水的 quantity，用于背景填充 ---
    let soilQty = 0;
    let waterQty = 0;
    const drawEntities = []; // 非土壤/水的实体
    entities.forEach(e => {
      if (e.type === 'soil') { soilQty += e.quantity; }
      else if (e.type === 'water') { waterQty += e.quantity; }
      else { drawEntities.push(e); }
    });

    // --- 2. 绘制土壤背景填充（限制在 underground 区域 rows 6-7，不覆盖 surface） ---
    if (soilQty > 0) {
      // 土壤只填充 underground 层（rows 6-7），用 quantity 控制深浅
      const underRows = LAYER_ROWS.underground;
      const soilY = padTop + underRows[0] * cellH;
      const soilH = underRows.length * cellH + padBottom;
      const richness = Math.min(soilQty / 10, 1); // 0~1 控制颜色深浅

      // 土壤渐变（quantity 越多颜色越深越肥沃）
      const grad = ctx.createLinearGradient(0, soilY, 0, soilY + soilH);
      const r1 = Math.round(160 - richness * 50);
      const g1 = Math.round(120 - richness * 40);
      const b1 = Math.round(60 - richness * 30);
      const r2 = Math.round(100 - richness * 30);
      const g2 = Math.round(70 - richness * 20);
      const b2 = Math.round(30 - richness * 10);
      grad.addColorStop(0, `rgb(${r1},${g1},${b1})`);
      grad.addColorStop(1, `rgb(${r2},${g2},${b2})`);
      ctx.fillStyle = grad;

      // 填充瓶子底部（圆角）
      ctx.beginPath();
      const bL = padLeft - 15;
      const bR = w - padRight + 15;
      const bB = h - 5;
      ctx.moveTo(bL, soilY);
      ctx.lineTo(bL, bB - 15);
      ctx.quadraticCurveTo(bL, bB, bL + 15, bB);
      ctx.lineTo(bR - 15, bB);
      ctx.quadraticCurveTo(bR, bB, bR, bB - 15);
      ctx.lineTo(bR, soilY);
      ctx.closePath();
      ctx.fill();

      // 土壤表面纹理
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      for (let i = 0; i < soilQty * 6; i++) {
        const px = bL + 10 + Math.random() * (bR - bL - 20);
        const py = soilY + 2 + Math.random() * (soilH - 4);
        ctx.beginPath();
        ctx.arc(px, py, 1 + Math.random() * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // tooltip
      this.drawnItems.push({
        x: w / 2, y: soilY + soilH / 2,
        type: 'soil', emoji: '🟫',
        hitTest: (mx, my) => mx >= bL && mx <= bR && my >= soilY && my <= bB
      });
    }

    // --- 3. 绘制水分层（土壤上方的蓝色半透明层） ---
    if (waterQty > 0 && soilQty > 0) {
      const underRows = LAYER_ROWS.underground;
      const waterY = padTop + underRows[0] * cellH;
      const waterH = Math.min(waterQty * 3, 15);
      const alpha = Math.min(0.15 + waterQty * 0.04, 0.5);

      ctx.fillStyle = `rgba(66, 165, 245, ${alpha})`;
      const bL = padLeft - 10;
      const bR = w - padRight + 10;
      ctx.fillRect(bL, waterY - waterH, bR - bL, waterH + 4);

      // 水面波纹
      ctx.strokeStyle = `rgba(66, 165, 245, ${alpha + 0.1})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const wy = waterY - waterH + i * 3;
        ctx.beginPath();
        ctx.moveTo(bL, wy);
        for (let x = bL; x <= bR; x += 20) {
          ctx.quadraticCurveTo(x + 5, wy - 2, x + 10, wy);
          ctx.quadraticCurveTo(x + 15, wy + 2, x + 20, wy);
        }
        ctx.stroke();
      }
    }

    // --- 4. 绘制瓶子轮廓（在背景之上） ---
    ctx.save();
    ctx.strokeStyle = 'rgba(180, 210, 220, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const jarTop = 5, jarBottom = h - 5, jarLeft = 15, jarRight = w - 15;
    const neckLeft = jarLeft + 40, neckRight = jarRight - 40, neckTop = 0;
    ctx.moveTo(neckLeft, neckTop);
    ctx.lineTo(neckLeft, jarTop + 20);
    ctx.quadraticCurveTo(jarLeft, jarTop + 20, jarLeft, jarTop + 50);
    ctx.lineTo(jarLeft, jarBottom - 15);
    ctx.quadraticCurveTo(jarLeft, jarBottom, jarLeft + 15, jarBottom);
    ctx.lineTo(jarRight - 15, jarBottom);
    ctx.quadraticCurveTo(jarRight, jarBottom, jarRight, jarBottom - 15);
    ctx.lineTo(jarRight, jarTop + 50);
    ctx.quadraticCurveTo(jarRight, jarTop + 20, neckRight, jarTop + 20);
    ctx.lineTo(neckRight, neckTop);
    ctx.stroke();
    ctx.restore();

    // --- 5. 绘制 emoji 实体（土壤/水已用背景表示，其他正常绘制） ---
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 1.0;
    ctx.font = '28px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';

    // Group by layer, 每种类型最多画 3 个 emoji
    const layerMap = {};
    for (const layer of Object.keys(LAYER_ROWS)) {
      layerMap[layer] = [];
    }

    // 按 type 聚合计数，每种最多 3 个视觉 emoji
    const typeCount = {};
    drawEntities.forEach(e => {
      const layer = e.layer || 'surface';
      if (!layerMap[layer]) return;
      const count = Math.max(1, Math.round(e.quantity));
      const visualCount = Math.min(count, 3);
      typeCount[e.type] = count;
      for (let i = 0; i < visualCount; i++) {
        layerMap[layer].push({ emoji: e.emoji, type: e.type, total: count, _idx: i });
      }
    });

    // 构建新的位置缓存，保留已有实体位置
    const newPosCache = {};

    for (const [layer, rows] of Object.entries(LAYER_ROWS)) {
      const items = layerMap[layer] || [];
      if (items.length === 0) continue;

      const totalCells = rows.length * COLS;
      // 收集本层所有已缓存的 cellIndex，防止新实体分配到已占用位置
      const usedCells = new Set();

      // 第一轮：复用缓存位置
      items.forEach(item => {
        const cacheKey = `${item.type}_${layer}_${item._idx}`;
        const cached = this.posCache[cacheKey];
        if (cached !== undefined && cached < totalCells) {
          usedCells.add(cached);
          newPosCache[cacheKey] = cached;
          item._cell = cached;
        }
      });

      // 第二轮：为没有缓存的实体分配新位置
      items.forEach(item => {
        if (item._cell !== undefined) return;
        const cacheKey = `${item.type}_${layer}_${item._idx}`;
        let cellIndex;
        let attempts = 0;
        do {
          cellIndex = Math.floor(Math.random() * totalCells);
          attempts++;
        } while (usedCells.has(cellIndex) && attempts < 20);
        usedCells.add(cellIndex);
        newPosCache[cacheKey] = cellIndex;
        item._cell = cellIndex;
      });

      // 绘制
      items.forEach(item => {
        const cellIndex = item._cell;
        const rowOffset = Math.floor(cellIndex / COLS);
        const col = cellIndex % COLS;
        const row = rows[0] + rowOffset;

        const x = padLeft + col * cellW + cellW / 2;
        const y = padTop + row * cellH + cellH / 2;

        ctx.fillText(item.emoji, x, y);

        // 数量角标（只在第一个 emoji 上显示，且数量 > 1）
        if (item.total > 1 && !item._badgeDrawn) {
          ctx.save();
          ctx.font = '11px sans-serif';
          ctx.fillStyle = '#fff';
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = 2;
          const label = `x${item.total}`;
          const tx = x + 12;
          const ty = y - 12;
          ctx.strokeText(label, tx, ty);
          ctx.fillText(label, tx, ty);
          ctx.restore();
          ctx.font = '28px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
          // 标记同类型已画角标
          items.forEach(it => { if (it.type === item.type) it._badgeDrawn = true; });
        }

        this.drawnItems.push({ x, y, type: item.type, emoji: item.emoji });
      });
    }

    // 更新缓存（旧的不在新缓存中的会被自然丢弃）
    this.posCache = newPosCache;

    // --- 6. 绘制危机事件（画在最上层，瓶子右上角） ---
    if (this.crisis) {
      const cx = w - padRight - 10;
      const cy = padTop + 18;

      // 半透明红色警告背景圆
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(229, 57, 53, 0.18)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(229, 57, 53, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // 危机 emoji
      ctx.save();
      ctx.globalAlpha = 1.0;
      ctx.font = '26px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000';
      ctx.fillText(this.crisis.emoji, cx, cy);
      ctx.restore();

      // 红色感叹号角标
      ctx.save();
      const bx = cx + 14;
      const by = cy - 14;
      ctx.beginPath();
      ctx.arc(bx, by, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#e53935';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText('!', bx, by);
      ctx.restore();

      // 恢复主绘制字体
      ctx.font = '28px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // tooltip（优先级最高，插入 drawnItems 开头）
      this.drawnItems.unshift({
        x: cx, y: cy,
        type: this.crisis.id,
        emoji: this.crisis.emoji,
        tip: `⚠️ ${this.crisis.name}：${this.crisis.description}`
      });
    }
  }
}
