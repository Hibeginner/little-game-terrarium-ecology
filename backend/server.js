const WebSocket = require('ws');
const { GameState } = require('./gameState');
const { generatePrompt } = require('./prompt');
const { invokeLLM } = require('./llm');
const { validateAndFix } = require('./validator');
const { calculateScore } = require('./scorer');

function log(tag, msg) {
  const ts = new Date().toLocaleTimeString();
  console.log(`[${ts}] [Server] ${tag}: ${msg}`);
}

function startServer(port = 30001, mockLLM = false) {
  const wss = new WebSocket.Server({ port });
  const gameState = new GameState();

  log('INIT', `WebSocket server started on port ${port} (mockLLM=${mockLLM})`);

  wss.on('connection', (ws) => {
    log('CONN', 'Client connected');

    ws.on('message', async (message) => {
      try {
        const msg = JSON.parse(message);
        log('RECV', `type=${msg.type}` + (msg.actions ? ` actions=${JSON.stringify(msg.actions)}` : ''));

        if (msg.type === 'start_game') {
          // Reset state on each new game (page refresh = new game)
          gameState.reset();
          log('STATE', 'Game state reset for new game');
          const state = gameState.get();
          const response = { type: 'day_result', ...state };
          ws.send(JSON.stringify(response));
          log('SEND', `day_result day=${state.day} season=${state.season}`);

        } else if (msg.type === 'player_action') {
          const currentState = gameState.get();
          log('LLM', `Generating prompt for day ${currentState.day}...`);
          const promptText = generatePrompt(currentState, msg.actions || []);
          log('LLM', `Prompt length: ${promptText.length} chars`);

          let nextStateRaw;
          try {
            log('LLM', 'Invoking LLM...');
            const startTime = Date.now();
            nextStateRaw = await invokeLLM(promptText, mockLLM);
            log('LLM', `LLM responded in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
          } catch (err) {
            log('ERROR', `LLM failed: ${err.message}`);
            nextStateRaw = {
              ...currentState,
              day: currentState.day + 1,
              log: 'LLM推演失败，生态瓶静静等待着。',
              events: []
            };
          }

          const fixedState = validateAndFix(nextStateRaw, currentState);
          gameState.update(fixedState);
          log('STATE', `day=${fixedState.day} season=${fixedState.season} entities=${fixedState.entities.length} temp=${fixedState.environment.temperature}℃`);

          if (fixedState.day >= 20) {
            const score = calculateScore(fixedState);
            const response = { type: 'game_over', ...fixedState, score };
            ws.send(JSON.stringify(response));
            log('SEND', `game_over score=${score.total}`);
          } else {
            const response = { type: 'day_result', ...fixedState };
            ws.send(JSON.stringify(response));
            log('SEND', `day_result day=${fixedState.day} log="${fixedState.log.substring(0, 40)}..."`);
          }

        } else if (msg.type === 'pause' || msg.type === 'resume') {
          ws.send(JSON.stringify({ type: msg.type + '_ack' }));
          log('SEND', `${msg.type}_ack`);
        }
      } catch (e) {
        log('ERROR', `Message handling: ${e.message}`);
      }
    });

    ws.on('close', () => log('CONN', 'Client disconnected'));
    ws.on('error', (err) => log('ERROR', `WebSocket error: ${err.message}`));
  });

  return wss;
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
