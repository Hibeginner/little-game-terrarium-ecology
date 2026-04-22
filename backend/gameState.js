const INITIAL_ENTITIES = [
  { type: 'soil', emoji: '🟫', quantity: 1, layer: 'underground', status: 'healthy' },
  { type: 'water', emoji: '💧', quantity: 1, layer: 'underground', status: 'healthy' },
  { type: 'seed', emoji: '🫘', quantity: 1, layer: 'surface', status: 'healthy' },
  { type: 'stone', emoji: '🪨', quantity: 1, layer: 'surface', status: 'healthy' },
  { type: 'earthworm', emoji: '🪱', quantity: 1, layer: 'underground', status: 'healthy' },
];

const INITIAL_STATE = {
  day: 1,
  season: 'spring',
  environment: { sunlight: 5, humidity: 5, temperature: 15, fertility: 3 },
  entities: INITIAL_ENTITIES,
  log: '春天到了，生态瓶里已经有了一些土壤、水和种子，往里面再放点什么吧。',
  events: []
};

class GameState {
  constructor() {
    this.state = JSON.parse(JSON.stringify(INITIAL_STATE));
  }
  get() { return this.state; }
  update(newState) { this.state = newState; }
  reset() { this.state = JSON.parse(JSON.stringify(INITIAL_STATE)); }
}
module.exports = { GameState };
