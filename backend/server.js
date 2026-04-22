const WebSocket = require('ws');
const { GameState } = require('./gameState');

function startServer(port = 3001) {
  const wss = new WebSocket.Server({ port });
  const gameState = new GameState();

  wss.on('connection', (ws) => {
    ws.on('message', (message) => {
      try {
        const msg = JSON.parse(message);
        if (msg.type === 'start_game') {
          ws.send(JSON.stringify({
            type: 'day_result',
            ...gameState.get()
          }));
        }
      } catch (e) {
        console.error('Invalid message', e);
      }
    });
  });

  console.log(`WebSocket server started on port ${port}`);
  return wss;
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
