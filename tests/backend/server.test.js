const WebSocket = require('ws');
const { startServer } = require('../../backend/server');

const wss = startServer(3002);
const ws = new WebSocket('ws://localhost:3002');

ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'start_game' }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'day_result') {
    console.log('Server test pass');
    ws.close();
    wss.close();
    process.exit(0);
  }
});

setTimeout(() => {
  console.error('Server test timeout');
  process.exit(1);
}, 2000);
