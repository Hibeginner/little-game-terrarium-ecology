// 已知实体类型 → emoji + layer 映射（用于自动补全）
const KNOWN_ENTITIES = {
  earthworm: { emoji: '🪱', layer: 'underground' },
  ant: { emoji: '🐜', layer: 'surface' },
  snail: { emoji: '🐌', layer: 'low' },
  ladybug: { emoji: '🐞', layer: 'low' },
  butterfly: { emoji: '🦋', layer: 'high' },
  dragonfly: { emoji: '🪺', layer: 'high' },
  bee: { emoji: '🐝', layer: 'mid' },
  cricket: { emoji: '🦗', layer: 'surface' },
  frog: { emoji: '🐸', layer: 'low' },
  mouse: { emoji: '🐭', layer: 'low' },
  bird: { emoji: '🐦', layer: 'high' },
  spider: { emoji: '🕷️', layer: 'mid' },
  caterpillar: { emoji: '🐛', layer: 'low' },
  mosquito: { emoji: '🦟', layer: 'mid' },
  seed: { emoji: '🫘', layer: 'surface' },
  sprout: { emoji: '🌱', layer: 'low' },
  grass: { emoji: '🌿', layer: 'low' },
  herb: { emoji: '🍀', layer: 'low' },
  flower_bud: { emoji: '🌷', layer: 'mid' },
  flower: { emoji: '🌻', layer: 'mid' },
  bush: { emoji: '🌳', layer: 'mid' },
  mushroom: { emoji: '🍄', layer: 'surface' },
  clover: { emoji: '☘️', layer: 'low' },
  fallen_leaf: { emoji: '🍂', layer: 'surface' },
  compost: { emoji: '🟤', layer: 'underground' },
};

function validateAndFix(newState, oldState) {
  const result = { ...newState };
  
  // 1. Field completeness
  if (!result.day) result.day = oldState.day + 1;
  if (!result.season) result.season = oldState.season;
  if (!result.entities || !Array.isArray(result.entities)) result.entities = oldState.entities || [];
  if (!result.log) result.log = '今天很平静。';
  if (!result.events || !Array.isArray(result.events)) result.events = [];
  
  // 2. Environment parameter ranges
  if (result.environment) {
    result.environment.sunlight = Math.max(0, Math.min(10, result.environment.sunlight ?? 5));
    result.environment.humidity = Math.max(0, Math.min(10, result.environment.humidity ?? 5));
    result.environment.fertility = Math.max(0, Math.min(10, result.environment.fertility ?? 5));
    result.environment.temperature = result.environment.temperature ?? oldState.environment.temperature;
  } else {
    result.environment = { ...oldState.environment };
  }

  // 3. Remove entities with quantity <= 0, round quantity to integer
  result.entities = result.entities
    .map(e => ({ ...e, quantity: Math.round(e.quantity) }))
    .filter(e => e.quantity > 0);

  // 4. Correct season based on day (4 days per season, 16 days total)
  if (result.day <= 4) result.season = 'spring';
  else if (result.day <= 8) result.season = 'summer';
  else if (result.day <= 12) result.season = 'autumn';
  else result.season = 'winter';

  // 5. Fix missing entities: if log/events mention a creature but entities don't contain it, add it
  const existingTypes = new Set(result.entities.map(e => e.type));
  const textToScan = result.log + ' ' + result.events.map(ev =>
    typeof ev === 'string' ? ev : (ev.description || ev.text || '')
  ).join(' ');

  for (const [type, info] of Object.entries(KNOWN_ENTITIES)) {
    if (existingTypes.has(type)) continue;
    // Check if the type name (English or Chinese equivalent) is mentioned in log/events
    const patterns = [type];
    // Add Chinese name patterns
    const cnNames = {
      cricket: '蟋蟀', butterfly: '蝴蝶', ladybug: '瓢虫', caterpillar: '毛毛虫',
      bee: '蜜蜂', spider: '蜘蛛', dragonfly: '蜻蜓', snail: '蜗牛',
      frog: '青蛙', mouse: '老鼠', bird: '小鸟', ant: '蚂蚁',
      earthworm: '蚯蚓', mosquito: '蚊虫', mushroom: '蘑菇', clover: '三叶草',
    };
    if (cnNames[type]) patterns.push(cnNames[type]);

    const mentioned = patterns.some(p => textToScan.includes(p));
    // Only add if mentioned in a "spawn/appear" context (not death/disappear)
    if (mentioned) {
      const spawnKeywords = ['出现', '涌现', '吸引', '飞来', '爬来', '长出', '孵化', '化蝶', 'spawn', '加入'];
      const deathKeywords = ['死亡', '死去', '消失', '离开', '冻死', '饿死', '移除', '全灭'];
      const isSpawn = spawnKeywords.some(k => textToScan.includes(k));
      const isDeath = deathKeywords.some(k => {
        // Check if death keyword is near this entity's name
        for (const p of patterns) {
          const idx = textToScan.indexOf(p);
          if (idx >= 0) {
            const nearby = textToScan.substring(Math.max(0, idx - 20), idx + p.length + 20);
            if (nearby.includes(k)) return true;
          }
        }
        return false;
      });
      if (isSpawn && !isDeath) {
        result.entities.push({
          type, emoji: info.emoji, quantity: 1, layer: info.layer, status: 'healthy'
        });
        console.log(`[Validator] Auto-added missing entity: ${type} (mentioned in log/events but not in entities)`);
      }
    }
  }

  return result;
}
module.exports = { validateAndFix };
