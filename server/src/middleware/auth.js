const { AuthError } = require('../services/authService');

/**
 * Middleware de autenticación por Bearer token.
 * - requireAuth: exige token válido.
 * - requireAdmin: exige token válido con rol admin.
 * - optionalAuth: agrega req.user si hay token, sin bloquear.
 */
function createAuthMiddleware({ authService }) {
  function readToken(req) {
    const header = req.headers.authorization || '';
    return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  }

  function attachUser(req) {
    const token = readToken(req);
    if (!token) return null;
    req.user = authService.authenticate(token);
    return req.user;
  }

  function requireAuth(req, res, next) {
    try {
      const user = attachUser(req);
      if (!user) {
        return res.status(401).json({
          exito: false,
          code: 'AUTH_REQUIRED',
          error: 'Debes iniciar sesión para continuar.',
        });
      }
      return next();
    } catch (error) {
      if (error instanceof AuthError) {
        return res.status(error.status).json({ exito: false, code: error.code, error: error.message });
      }
      return next(error);
    }
  }

  function requireAdmin(req, res, next) {
    return requireAuth(req, res, () => {
      if (req.user.rol !== 'admin') {
        return res.status(403).json({
          exito: false,
          code: 'ADMIN_REQUIRED',
          error: 'Se requieren permisos de administrador.',
        });
      }
      return next();
    });
  }

  return { requireAuth, requireAdmin };
}

module.exports = { createAuthMiddleware };
