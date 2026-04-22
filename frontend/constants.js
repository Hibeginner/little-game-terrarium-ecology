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
const AUTO_ADVANCE_DELAY = 3000; // 3 seconds
