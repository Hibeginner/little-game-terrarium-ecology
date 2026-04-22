const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function invokeLLM(promptText, mock = false) {
  if (mock) {
    try { return JSON.parse(promptText); } catch (e) { return null; }
  }

  const tempFile = path.join(os.tmpdir(), `terrarium_prompt_${Date.now()}.txt`);
  fs.writeFileSync(tempFile, promptText);

  return new Promise((resolve, reject) => {
    exec(`codemaker chat --no-interactive < "${tempFile}"`, (error, stdout, stderr) => {
      fs.unlinkSync(tempFile);
      
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        const match = stdout.match(/```json\s*([\s\S]*?)\s*```/);
        if (match && match[1]) {
          try { resolve(JSON.parse(match[1])); }
          catch (e2) { reject(new Error('Failed to parse LLM output')); }
        } else {
          reject(new Error('No JSON found in LLM output'));
        }
      }
    });
  });
}

module.exports = { invokeLLM };
