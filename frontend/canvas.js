class TerrariumRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.prevEntities = [];
  }

  setSeason(season) {
    const bg = SEASON_BG[season] || SEASON_BG.spring;
    this.canvas.parentElement.style.background = bg;
  }

  render(entities) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Draw glass jar outline
    ctx.save();
    ctx.strokeStyle = 'rgba(180, 210, 220, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    // Jar shape: rounded rectangle with narrow top
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

    // Set font size for emoji
    ctx.font = '28px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';

    // Group entities by layer
    const layerMap = {};
    for (const layer of Object.keys(LAYER_ROWS)) {
      layerMap[layer] = [];
    }

    entities.forEach(e => {
      const count = Math.max(1, Math.round(e.quantity));
      const layer = e.layer || 'surface';
      if (layerMap[layer]) {
        for (let i = 0; i < count; i++) {
          layerMap[layer].push(e.emoji);
        }
      }
    });

    // Draw each layer
    for (const [layer, rows] of Object.entries(LAYER_ROWS)) {
      const items = layerMap[layer] || [];
      if (items.length === 0) continue;

      const totalCells = rows.length * COLS;
      const usedCells = new Set();

      items.forEach(emoji => {
        let cellIndex;
        let attempts = 0;
        do {
          cellIndex = Math.floor(Math.random() * totalCells);
          attempts++;
        } while (usedCells.has(cellIndex) && attempts < 20);

        usedCells.add(cellIndex);

        const rowOffset = Math.floor(cellIndex / COLS);
        const col = cellIndex % COLS;
        const row = rows[0] + rowOffset;

        const jitter = 3;
        const x = col * CELL_W + CELL_W / 2 + (Math.random() * jitter * 2 - jitter);
        const y = row * CELL_H + CELL_H / 2 + (Math.random() * jitter * 2 - jitter);

        ctx.fillText(emoji, x, y);
      });
    }

    this.prevEntities = entities;
  }
}
