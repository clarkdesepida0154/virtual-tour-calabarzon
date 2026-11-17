/** Reads and updates the project's .env file for the Node scripts. */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const ENV_PATH = path.join(ROOT, '.env');

function readEnvFile() {
  if (!fs.existsSync(ENV_PATH)) {
    throw new Error('.env not found. Copy .env.example to .env and fill it in.');
  }
  const values = {};
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return values;
}

function saveEnvValue(key, value) {
  const lines = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/);
  const index = lines.findIndex((line) => new RegExp(`^\\s*${key}\\s*=`).test(line));
  if (index >= 0) lines[index] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
  fs.writeFileSync(ENV_PATH, lines.join('\n'));
}

module.exports = { ROOT, ENV_PATH, readEnvFile, saveEnvValue };
