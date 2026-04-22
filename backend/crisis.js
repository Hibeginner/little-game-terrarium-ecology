/**
 * Crisis event system - rolls dice each day to trigger ecological crises.
 * At most 1 crisis per day, with a 2-day cooldown after each trigger.
 */

const CRISIS_TYPES = [
  {
    id: 'drought',
    name: '干旱',
    emoji: '🏜️',
    seasons: ['summer'],
    probability: 0.25,
    condition: (state) => state.environment.humidity >= 3,
    description: '连日高温无雨，土地龟裂。humidity -3，所有植物 quantity -30%。',
    prompt: '⚠️ 危机事件【干旱】：连续高温无降水，湿度骤降3点，所有植物因缺水 quantity 减少30%（向下取整，最少保留0.5）。请在推演中体现干旱对生态的破坏。'
  },
  {
    id: 'storm',
    name: '暴雨',
    emoji: '🌊',
    seasons: ['summer', 'autumn'],
    probability: 0.20,
    condition: () => true,
    description: '瓢泼大雨冲刷瓶壁。humidity +4，地面小型动物(蚂蚁、蚯蚓)被冲走 quantity -50%。',
    prompt: '⚠️ 危机事件【暴雨】：倾盆大雨灌入瓶中，湿度暴涨4点，蚂蚁和蚯蚓被水冲走 quantity 减半（向下取整，最少保留0.5）。请在推演中体现暴雨的冲击。'
  },
  {
    id: 'pest_outbreak',
    name: '虫害',
    emoji: '🦗',
    seasons: ['spring', 'summer'],
    probability: 0.20,
    condition: (state) => {
      const insectTypes = ['mosquito', 'caterpillar', 'ant', 'cricket'];
      const insectQty = state.entities
        .filter(e => insectTypes.includes(e.type) && e.quantity > 0)
        .reduce((sum, e) => sum + e.quantity, 0);
      return insectQty >= 3;
    },
    description: '害虫大量繁殖，啃食植被。所有植物 quantity -40%，毛毛虫 +2。',
    prompt: '⚠️ 危机事件【虫害爆发】：害虫大量繁殖侵袭植被，所有植物 quantity 减少40%（向下取整，最少保留0.5），毛毛虫数量 +2（如果没有毛毛虫则新增 caterpillar type）。请在推演中体现虫害的蔓延。'
  },
  {
    id: 'cold_snap',
    name: '寒潮',
    emoji: '🥶',
    seasons: ['winter'],
    probability: 0.30,
    condition: () => true,
    description: '极地寒流来袭，气温骤降。temperature -8，不耐寒物种(蚂蚁、蜗牛、蝴蝶、蚊虫)直接死亡。',
    prompt: '⚠️ 危机事件【寒潮】：极寒空气侵入，温度骤降8℃，蚂蚁、蜗牛、蝴蝶、蚊虫因无法耐受严寒全部死亡（quantity 归零移除）。花朵凋零变为 wilted_flower。请在推演中体现寒潮的致命打击。'
  },
  {
    id: 'heat_wave',
    name: '热浪',
    emoji: '🔥',
    seasons: ['summer'],
    probability: 0.20,
    condition: () => true,
    description: '酷暑难耐，水分蒸发。temperature +8，humidity -2，嫩芽和蘑菇被灼伤 quantity -50%。',
    prompt: '⚠️ 危机事件【热浪】：极端高温侵袭，温度飙升8℃，湿度下降2点，嫩芽(sprout)和蘑菇(mushroom)被灼伤 quantity 减半。请在推演中体现高温的破坏。'
  },
  {
    id: 'plague',
    name: '瘟疫',
    emoji: '☠️',
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    probability: 0.15,
    condition: (state) => {
      const animalTypes = ['earthworm', 'ant', 'snail', 'mosquito', 'frog', 'mouse', 'bird',
        'butterfly', 'dragonfly', 'bee', 'cricket', 'spider', 'caterpillar'];
      const totalAnimals = state.entities
        .filter(e => animalTypes.includes(e.type) && e.quantity > 0)
        .reduce((sum, e) => sum + e.quantity, 0);
      return totalAnimals >= 6;
    },
    description: '神秘疾病蔓延。随机 2 种动物 quantity -50%。',
    prompt: '⚠️ 危机事件【瘟疫】：一种神秘的疾病在瓶中蔓延，随机选择2种动物，它们的 quantity 减少50%（向下取整，最少保留0.5）。请在推演中体现瘟疫的扩散和动物的衰弱。'
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

  // 2-day cooldown after last crisis
  if (lastCrisisDay > 0 && day - lastCrisisDay < 3) {
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
