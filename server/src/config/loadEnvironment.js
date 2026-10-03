const fs = require('fs');
const path = require('path');

/**
 * Carga un archivo .env local sin reemplazar variables entregadas por el host
 * (Vercel/Render/CI). No registra valores para evitar filtrar secretos.
 */
function loadEnvironment(filePath = path.resolve(__dirname, '../../.env')) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    process.env[match[1]] = value;
  }
}

module.exports = { loadEnvironment };
