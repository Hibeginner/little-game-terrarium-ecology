const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function log(tag, msg) {
  const ts = new Date().toLocaleTimeString();
  console.log(`[${ts}] [LLM] ${tag}: ${msg}`);
}

async function invokeLLM(promptText, mock = false) {
  if (mock) {
    log('MOCK', 'Using mock mode, parsing input as JSON');
    try { return JSON.parse(promptText); } catch (e) { return null; }
  }

  const ts = Date.now();
  const tempFile = path.join(os.tmpdir(), `terrarium_prompt_${ts}.txt`);
  const responseFile = path.join(os.tmpdir(), `terrarium_response_${ts}.txt`);
  fs.writeFileSync(tempFile, promptText, 'utf8');
  log('CALL', `Prompt written to ${tempFile} (${promptText.length} chars)`);

  return new Promise((resolve, reject) => {
    const cmd = `type "${tempFile}" | codemaker run -m "netease-codemaker/kimi-k2.5"`;
    log('EXEC', cmd);

    exec(cmd, { timeout: 120000, maxBuffer: 1024 * 1024, shell: 'cmd.exe' }, (error, stdout, stderr) => {
      log('CALL', `Prompt file kept at: ${tempFile}`);

      // 保存原始返回文本到文件
      fs.writeFileSync(responseFile, stdout, 'utf8');
      log('CALL', `Response file saved to: ${responseFile}`);

      if (error) {
        log('ERROR', `exec error: ${error.message}`);
      }
      if (stderr) {
        log('STDERR', stderr.substring(0, 500));
      }

      log('STDOUT', `Received ${stdout.length} chars`);
      log('STDOUT_PREVIEW', stdout.substring(0, 500));

      // Parse JSON and save formatted version
      let parsed = null;

      // Strategy 1: extract from ```json ... ``` block
      const fenceMatch = stdout.match(/```json\s*([\s\S]*?)\s*```/);
      if (fenceMatch && fenceMatch[1]) {
        try {
          parsed = JSON.parse(fenceMatch[1]);
          log('PARSE', 'OK - extracted from markdown code fence');
        } catch (e) {
          log('PARSE', `Code fence found but JSON invalid: ${e.message}`);
        }
      }

      // Strategy 2: direct parse
      if (!parsed) {
        try {
          parsed = JSON.parse(stdout.trim());
          log('PARSE', 'OK - direct JSON parse');
        } catch (_) {}
      }

      // Strategy 3: brace extraction
      if (!parsed) {
        const braceMatch = stdout.match(/\{[\s\S]*"day"[\s\S]*"entities"[\s\S]*\}/);
        if (braceMatch) {
          try {
            parsed = JSON.parse(braceMatch[0]);
            log('PARSE', 'OK - brace extraction');
          } catch (_) {}
        }
      }

      if (parsed) {
        // 保存格式化的 JSON 到文件
        const jsonFile = path.join(os.tmpdir(), `terrarium_parsed_${ts}.json`);
        fs.writeFileSync(jsonFile, JSON.stringify(parsed, null, 2), 'utf8');
        log('CALL', `Parsed JSON saved to: ${jsonFile}`);
        resolve(parsed);
      } else {
        log('FAIL', 'All parse strategies failed. Full output:');
        log('FAIL', stdout.substring(0, 1000));
        reject(new Error('No valid JSON found in LLM output'));
      }
    });
  });
}

module.exports = { invokeLLM };
