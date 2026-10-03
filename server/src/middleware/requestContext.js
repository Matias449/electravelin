const crypto = require('crypto');

/**
 * Asigna un request ID (entrante o generado), lo expone en la respuesta y
 * registra el término de cada request con datos mínimos, sin cuerpos ni headers.
 */
function createRequestContext({ logger }) {
  return function requestContext(req, res, next) {
    const incoming = req.headers['x-request-id'];
    const requestId = typeof incoming === 'string' && incoming.trim()
      ? incoming.trim().slice(0, 128)
      : crypto.randomUUID();

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      logger.info('http_request', {
        requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        userId: req.user?.id || null,
      });
    });

    next();
  };
}

module.exports = { createRequestContext };
