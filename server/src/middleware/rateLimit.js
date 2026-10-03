/**
 * Limitador de tasa en memoria (ventana fija) por IP y nombre de cubo.
 * Suficiente para una instancia; con réplicas se necesita un store compartido.
 */
function createRateLimiter({ windowMs = 60 * 1000, max = 60, name = 'general' } = {}) {
  const hits = new Map();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs);
  cleanup.unref?.();

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const key = `${name}:${req.ip || req.socket?.remoteAddress || 'desconocido'}`;
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('retry-after', Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({
        exito: false,
        code: 'RATE_LIMITED',
        error: 'Demasiadas solicitudes. Intenta nuevamente en unos minutos.',
      });
    }
    return next();
  };
}

module.exports = { createRateLimiter };
