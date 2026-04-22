class GameState {
  constructor() {
    this.state = {
      day: 1,
      season: 'spring',
      environment: { sunlight: 5, humidity: 5, temperature: 15, fertility: 5 },
      entities: [],
      log: '欢迎来到你的生态瓶，往里面放点什么吧',
      events: []
    };
  }
  get() { return this.state; }
  update(newState) { this.state = newState; }
}
module.exports = { GameState };
