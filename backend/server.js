const WebSocket = require('ws');
const { GameState } = require('./gameState');
const { generatePrompt } = require('./prompt');
const { invokeLLM } = require('./llm');
const { validateAndFix } = require('./validator');

function startServer(port = 3001, mockLLM = false) {
  const wss = new WebSocket.Server({ port });
  const gameState = new GameState();

  wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
      try {
        const msg = JSON.parse(message);
        
        if (msg.type === 'start_game') {
          ws.send(JSON.stringify({ type: 'day_result', ...gameState.get() }));
        
        } else if (msg.type === 'player_action') {
          const currentState = gameState.get();
          const promptText = generatePrompt(currentState, msg.actions || []);
          
          let nextStateRaw;
          try {
            nextStateRaw = await invokeLLM(promptText, mockLLM);
          } catch (err) {
            console.error('LLM Error:', err.message);
            // Fallback: increment day, keep state
            nextStateRaw = { ...currentState, day: currentState.day + 1, log: 'LLM推演失败，生态瓶静静等待着。', events: [] };
          }

          const fixedState = validateAndFix(nextStateRaw, currentState);
          gameState.update(fixedState);
          
          // Check game over
          if (fixedState.day >= 100) {
            ws.send(JSON.stringify({ type: 'game_over', ...fixedState }));
          } else {
            ws.send(JSON.stringify({ type: 'day_result', ...fixedState }));
          }
        
        } else if (msg.type === 'pause' || msg.type === 'resume') {
          // Pause/resume is handled client-side, server just acknowledges
          ws.send(JSON.stringify({ type: msg.type + '_ack' }));
        }
      } catch (e) {
        console.error('Message handling error:', e);
      }
    });
  });

  console.log(`Terrarium server started on port ${port}`);
  return wss;
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
