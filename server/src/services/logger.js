const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const SENSITIVE_KEY = /(password|passwd|secret|token|authorization|api[_-]?key)/i;

function sanitize(value, depth = 0) {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? '[REDACTADO]' : sanitize(item, depth + 1),
    ])
  );
}

/**
 * Logger estructurado en JSON, sin dependencias externas.
 * Cada línea incluye ts, level y msg; los campos sensibles se redactan.
 */
function createLogger({ level = process.env.LOG_LEVEL || 'info', stream = process.stdout } = {}) {
  const threshold = LEVELS[String(level).toLowerCase()] ?? LEVELS.info;

  function emit(levelName, message, fields = {}) {
    if (LEVELS[levelName] < threshold) return;
    const record = {
      ts: new Date().toISOString(),
      level: levelName,
      msg: message,
      ...sanitize(fields),
    };
    stream.write(`${JSON.stringify(record)}\n`);
  }

  return {
    debug: (message, fields) => emit('debug', message, fields),
    info: (message, fields) => emit('info', message, fields),
    warn: (message, fields) => emit('warn', message, fields),
    error: (message, fields) => emit('error', message, fields),
    child: (base = {}) => ({
      debug: (message, fields) => emit('debug', message, { ...base, ...fields }),
      info: (message, fields) => emit('info', message, { ...base, ...fields }),
      warn: (message, fields) => emit('warn', message, { ...base, ...fields }),
      error: (message, fields) => emit('error', message, { ...base, ...fields }),
    }),
  };
}

module.exports = { createLogger, sanitize };
