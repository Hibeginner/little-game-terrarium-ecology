const MATERIAL_GROUPS = [
  {
    label: '🌍 环境',
    items: [
      { id: 'soil', emoji: '🟫', name: '土壤', tip: '土壤：植物生长的基础，没有土植物无法存活' },
      { id: 'water', emoji: '💧', name: '水', tip: '水：提升湿度，滋润植物，但过多会淹死地面动物' },
      { id: 'sunlight', emoji: '☀️', name: '阳光', tip: '阳光：促进光合作用，冬天必须持续投放防止冻死' },
      { id: 'stone', emoji: '🪨', name: '石头', tip: '石头：装饰物，冬天可蓄热缓释温度' },
      { id: 'branch', emoji: '🪵', name: '枯枝', tip: '枯枝：5-8天腐烂为腐殖质，增加土壤肥力' },
    ]
  },
  {
    label: '🌱 植物',
    items: [
      { id: 'seed', emoji: '🫘', name: '种子', tip: '种子：有土有水有阳光时2-3天发芽，可长成草和灌木' },
      { id: 'flower_seed', emoji: '🌸', name: '花种', tip: '花种：3天长出花苞，5天盛开，吸引蝴蝶和蜜蜂授粉' },
      { id: 'grass_turf', emoji: '🌿', name: '草皮', tip: '草皮：直接铺设成熟草地，快速增加植被覆盖，稳定土壤' },
      { id: 'mushroom_spore', emoji: '🍄', name: '蘑菇孢子', tip: '蘑菇孢子：需要humidity>=5和fertility>=3，1-2天长出蘑菇，分解有机物' },
      { id: 'clover_seed', emoji: '☘️', name: '三叶草', tip: '三叶草：生命力强，耐寒耐旱，提升fertility，稀有时带来幸运成就' },
    ]
  },
  {
    label: '🐾 动物',
    items: [
      { id: 'earthworm', emoji: '🪱', name: '蚯蚓', tip: '蚯蚓：松土加速肥力增长，让分解速度翻倍' },
      { id: 'ant', emoji: '🐜', name: '蚂蚁', tip: '蚂蚁：清理碎屑加速分解，但水淹即死' },
      { id: 'snail', emoji: '🐌', name: '蜗牛', tip: '蜗牛：缓慢吃植物0.2/天，分泌物增加湿度' },
      { id: 'mosquito', emoji: '🦟', name: '蚊虫', tip: '蚊虫：吸引蜻蜓/青蛙/蜘蛛来捕食，数量多时让动物生病' },
      { id: 'frog', emoji: '🐸', name: '青蛙', tip: '青蛙：每天吃1只虫子，需要水分维持，冬天冬眠' },
      { id: 'mouse', emoji: '🐭', name: '老鼠', tip: '老鼠：每天啃食0.5单位植物，粪便增加肥力，最耐寒' },
      { id: 'bird', emoji: '🐦', name: '小鸟', tip: '小鸟：赶走老鼠，每天30%概率传播种子' },
    ]
  }
];

// 扁平列表（兼容其他地方使用 MATERIALS 的代码）
const MATERIALS = MATERIAL_GROUPS.flatMap(g => g.items);

// Canvas 中所有实体的 tooltip 文本（鼠标悬停时显示）
const ENTITY_TIPS = {
  soil: '🟫 土壤：植物生长的基础',
  water: '💧 水：渗入土壤的水分',
  puddle: '🫧 积水：湿度过高时出现',
  stone: '🪨 石头：蓄热体，冬天缓释温度',
  branch: '🪵 枯枝：腐烂后变为腐殖质',
  ice: '🧊 冰：冬天积水结冰',
  seed: '🫘 种子：等待发芽中',
  sprout: '🌱 嫩芽：刚刚破土而出',
  grass: '🌿 草：基础植被，稳定土壤',
  grass_turf: '🌿 草皮：直接铺设的成熟草地',
  herb: '🍀 药草：三叶草',
  flower_seed: '🌸 花种子：等待生长',
  mushroom_spore: '🍄 蘑菇孢子：需潮湿+肥沃环境，分解有机物',
  clover_seed: '☘️ 三叶草种子：生命力强，提升肥力',
  flower_bud: '🌷 花苞：即将绽放',
  flower: '🌻 花：盛开中，吸引蝴蝶和蜜蜂',
  wilted_flower: '🥀 枯萎的花：即将死亡',
  bush: '🌳 灌木：成熟植物，秋天掉落叶',
  mushroom: '🍄 蘑菇：潮湿+腐殖质时长出',
  fallen_leaf: '🍂 落叶：4-6天分解为腐殖质',
  maple_leaf: '🍁 红叶：秋天的标志',
  clover: '☘️ 幸运草：稀有植物！',
  earthworm: '🪱 蚯蚓：松土，加速分解',
  ant: '🐜 蚂蚁：清理碎屑，水淹即死',
  snail: '🐌 蜗牛：缓慢吃植物，增加湿度',
  ladybug: '🐞 瓢虫：吃害虫，保护植物',
  butterfly: '🦋 蝴蝶：为花朵授粉加速开花，无花3天后飞走，15~32℃活跃',
  dragonfly: '🪺 蜻蜓：每天捕食0.5只蚊虫，需要水分(humidity>=3)，与青蛙互利+20%效率',
  bee: '🐝 蜜蜂：授粉加速开花',
  cricket: '🦗 蟋蟀：秋天出现的小虫',
  frog: '🐸 青蛙：每天吃1只虫子',
  mouse: '🐭 老鼠：每天啃食0.5单位植物',
  bird: '🐦 小鸟：赶走老鼠，传播种子',
  spider: '🕷️ 蜘蛛：织网捕捉飞虫',
  caterpillar: '🐛 毛毛虫：吃叶子，7天后化蝶',
  mosquito: '🦟 蚊虫：humidity>=4且温度>=15℃时自动滋生，是蜻蜓/青蛙/蜘蛛的食物',
  sun: '☀️ 太阳：阳光充足',
  mild_sun: '🌤️ 微光：阳光较弱',
  cloud: '☁️ 多云：阳光不足',
  rain: '🌧️ 下雨：湿度很高',
  snow: '❄️ 雪：冬天降雪',
  snowflake: '🌨️ 雪花：冬天降雪中',
  rainbow: '🌈 彩虹：雨后奇观！',
  star: '⭐ 星星：夜间装饰',
  moon: '🌙 月亮：夜间装饰',
  droplet: '💦 露珠：清晨水滴',
  dead_plant: '🥀 枯死植物：3天后分解',
  bone: '🦴 骨头：动物残骸，5天后消失',
  compost: '🟤 腐殖质：增加土壤肥力',
  cobweb: '🕸️ 蛛网：蜘蛛的杰作'
};

const LAYER_ROWS = {
  sky: [0, 1], high: [2], mid: [3], low: [4], surface: [5], underground: [6, 7]
};
const COLS = 12;
const ROWS = 8;
const CELL_W = 40;
const CELL_H = 40;

const SEASON_BG = {
  spring: '#E8F5E9',
  summer: '#FFF8E1',
  autumn: '#FBE9E7',
  winter: '#E3F2FD'
};

const SEASON_LABEL = {
  spring: '🌸春天',
  summer: '☀️夏天',
  autumn: '🍂秋天',
  winter: '❄️冬天'
};

const MAX_ACTIONS = 3;
