/**
 * Crisis event system - rolls dice each day to trigger ecological crises.
 * At most 1 crisis per day, with a 2-day cooldown after each trigger.
 */

const CRISIS_TYPES = [
  {
    id: 'late_frost',
    name: '倒春寒',
    emoji: '🌨️',
    seasons: ['spring'],
    probability: 0.40,
    condition: () => true,
    description: '冷空气突然回流，气温骤降。temperature -8，所有植物 quantity -50%，花苞全部冻死。',
    prompt: '⚠️ 危机事件【倒春寒】：冷空气猛烈回流，温度骤降8℃。所有植物（sprout、grass、herb、flower、bush等）quantity 减半（向下取整），花苞(flower_bud)全部冻死移除，嫩芽(sprout)直接死亡移除。这是毁灭性打击。请在推演中严格执行。'
  },
  {
    id: 'storm',
    name: '暴雨',
    emoji: '🌊',
    seasons: ['spring', 'summer', 'autumn'],
    probability: 0.35,
    condition: () => true,
    description: '瓢泼大雨冲刷瓶壁。humidity +5，所有地面和低层动物 quantity -50%，土壤流失 fertility -2。',
    prompt: '⚠️ 危机事件【暴雨】：倾盆大雨灌入瓶中，湿度暴涨5点。所有 surface 和 low 层的动物（蚂蚁、蚯蚓、蜗牛、蟋蟀、毛毛虫、瓢虫）quantity 减半（向下取整），土壤被冲刷 fertility -2。种子和蘑菇孢子被冲走移除。请在推演中严格执行。'
  },
  {
    id: 'drought',
    name: '干旱',
    emoji: '🏜️',
    seasons: ['summer'],
    probability: 0.40,
    condition: (state) => state.environment.humidity >= 3,
    description: '连日高温无雨，土地龟裂。humidity -4，所有植物 quantity -50%，蘑菇全部枯死。',
    prompt: '⚠️ 危机事件【干旱】：持续极端高温无降水，湿度骤降4点。所有植物 quantity 减半（向下取整），蘑菇(mushroom)因完全脱水全部死亡移除，蜗牛因缺水死亡移除。请在推演中严格执行。'
  },
  {
    id: 'pest_outbreak',
    name: '虫害',
    emoji: '🦗',
    seasons: ['spring', 'summer'],
    probability: 0.35,
    condition: (state) => {
      const insectTypes = ['mosquito', 'caterpillar', 'ant', 'cricket'];
      const insectQty = state.entities
        .filter(e => insectTypes.includes(e.type) && e.quantity > 0)
        .reduce((sum, e) => sum + e.quantity, 0);
      return insectQty >= 3;
    },
    description: '害虫大爆发，植被被啃食殆尽。所有植物 quantity -60%，毛毛虫 +3，花朵全部凋零。',
    prompt: '⚠️ 危机事件【虫害爆发】：害虫大规模爆发侵袭所有植被，所有植物 quantity 减少60%（向下取整），毛毛虫数量 +3（如果没有毛毛虫则新增 caterpillar），所有花朵(flower)变为 wilted_flower。请在推演中严格执行。'
  },
  {
    id: 'cold_snap',
    name: '寒潮',
    emoji: '🥶',
    seasons: ['autumn', 'winter'],
    probability: 0.45,
    condition: () => true,
    description: '极地寒流来袭，气温骤降。temperature -10，所有昆虫和冷血动物直接死亡，植物 quantity -30%。',
    prompt: '⚠️ 危机事件【寒潮】：极寒空气猛烈侵入，温度骤降10℃。所有昆虫（蚂蚁、蝴蝶、蜜蜂、蚊虫、蟋蟀、毛毛虫、瓢虫、蜻蜓）和冷血动物（蜗牛、青蛙）全部死亡移除。所有植物 quantity -30%（向下取整）。花朵凋零变为 wilted_flower。请在推演中严格执行。'
  },
  {
    id: 'heat_wave',
    name: '热浪',
    emoji: '🔥',
    seasons: ['summer'],
    probability: 0.35,
    condition: () => true,
    description: '酷暑难耐，水分蒸发。temperature +10，humidity -3，所有植物 quantity -40%，嫩芽和蘑菇全灭。',
    prompt: '⚠️ 危机事件【热浪】：极端高温侵袭，温度飙升10℃，湿度下降3点。所有植物 quantity -40%（向下取整），嫩芽(sprout)和蘑菇(mushroom)因灼烧全部死亡移除。蚯蚓钻入深层（quantity -50%）。请在推演中严格执行。'
  },
  {
    id: 'plague',
    name: '瘟疫',
    emoji: '☠️',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    probability: 0.25,
    condition: (state) => {
      const animalTypes = ['earthworm', 'ant', 'snail', 'mosquito', 'frog', 'mouse', 'bird',
        'butterfly', 'dragonfly', 'bee', 'cricket', 'spider', 'caterpillar'];
      const totalAnimals = state.entities
        .filter(e => animalTypes.includes(e.type) && e.quantity > 0)
        .reduce((sum, e) => sum + e.quantity, 0);
      return totalAnimals >= 6;
    },
    description: '致命瘟疫蔓延。随机 3 种动物全部死亡，其余动物 quantity -30%。',
    prompt: '⚠️ 危机事件【瘟疫】：一种致命的传染病在瓶中爆发蔓延，随机选择3种动物全部死亡移除（quantity 归零），其余所有动物 quantity -30%（向下取整）。请在推演中严格执行。'
  }
];

/**
 * Roll for crisis events.
 * @param {object} state - current game state
 * @param {number} lastCrisisDay - the day the last crisis occurred (0 if none)
 * @returns {{ crisis: object|null, lastCrisisDay: number }}
 */
function rollCrisis(state, lastCrisisDay = 0) {
  const day = state.day;

  // Day 1 never has a crisis (game just started)
  if (day <= 1) return { crisis: null, lastCrisisDay };

  // 1-day cooldown after last crisis
  if (lastCrisisDay > 0 && day - lastCrisisDay < 2) {
    return { crisis: null, lastCrisisDay };
  }

  // Filter eligible crises for current season
  const eligible = CRISIS_TYPES.filter(c =>
    c.seasons.includes(state.season) && c.condition(state)
  );

  if (eligible.length === 0) return { crisis: null, lastCrisisDay };

  // Shuffle and try each one
  const shuffled = eligible.sort(() => Math.random() - 0.5);
  for (const crisis of shuffled) {
    if (Math.random() < crisis.probability) {
      return {
        crisis: {
          id: crisis.id,
          name: crisis.name,
          emoji: crisis.emoji,
          description: crisis.description,
          prompt: crisis.prompt
        },
        lastCrisisDay: day
      };
    }
  }

  return { crisis: null, lastCrisisDay };
}

module.exports = { rollCrisis, CRISIS_TYPES };
