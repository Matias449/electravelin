const crypto = require('crypto');

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const PASSWORD_KEY_LENGTH = 64;
const SALT_BYTES = 16;

class AuthError extends Error {
  constructor(message, code = 'AUTH_ERROR', status = 401) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
  }
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function signToken(payload, secret, ttlSeconds = TOKEN_TTL_SECONDS) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const issuedAt = Math.floor(Date.now() / 1000);
  const body = base64url(JSON.stringify({ ...payload, iat: issuedAt, exp: issuedAt + ttlSeconds }));
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new AuthError('Token malformado.', 'INVALID_TOKEN');

  const [header, body, signature] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) {
    throw new AuthError('Firma de token inválida.', 'INVALID_TOKEN');
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    throw new AuthError('Token malformado.', 'INVALID_TOKEN');
  }

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new AuthError('La sesión expiró. Vuelve a iniciar sesión.', 'TOKEN_EXPIRED');
  }
  return payload;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const derived = crypto.scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, PASSWORD_KEY_LENGTH);
  const expected = Buffer.from(hash, 'hex');
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

function validateEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

/**
 * Servicio de cuentas: registro, login y emisión/verificación de JWT.
 * Los usuarios se persisten en el store inyectado.
 */
function createAuthService({ store, jwtSecret, tokenTtlSeconds = TOKEN_TTL_SECONDS } = {}) {
  if (!store) throw new Error('createAuthService requiere un store.');
  if (!jwtSecret) throw new Error('createAuthService requiere jwtSecret.');

  function findByEmail(email) {
    const normalised = String(email || '').trim().toLowerCase();
    return store.find('users', (user) => user.email === normalised);
  }

  function register({ nombre, email, password, rol = 'usuario' }) {
    if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2) {
      throw new AuthError('El nombre debe tener al menos 2 caracteres.', 'VALIDATION_ERROR', 400);
    }
    if (!validateEmail(email)) {
      throw new AuthError('El correo electrónico no es válido.', 'VALIDATION_ERROR', 400);
    }
    if (!validatePassword(password)) {
      throw new AuthError('La contraseña debe tener al menos 8 caracteres.', 'VALIDATION_ERROR', 400);
    }
    if (findByEmail(email)) {
      throw new AuthError('Ya existe una cuenta con ese correo.', 'EMAIL_TAKEN', 409);
    }

    const user = store.insert('users', {
      nombre: nombre.trim(),
      email: String(email).trim().toLowerCase(),
      passwordHash: hashPassword(password),
      rol,
      vehiculoFavoritoId: null,
    });

    return { usuario: publicUser(user), token: signToken({ sub: user.id, rol: user.rol }, jwtSecret, tokenTtlSeconds) };
  }

  function login({ email, password }) {
    const user = findByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new AuthError('Correo o contraseña incorrectos.', 'INVALID_CREDENTIALS', 401);
    }
    return { usuario: publicUser(user), token: signToken({ sub: user.id, rol: user.rol }, jwtSecret, tokenTtlSeconds) };
  }

  function authenticate(token) {
    const payload = verifyToken(token, jwtSecret);
    const user = store.findById('users', payload.sub);
    if (!user) throw new AuthError('La cuenta ya no existe.', 'INVALID_TOKEN');
    return publicUser(user);
  }

  function updateProfile(userId, { nombre, vehiculoFavoritoId }) {
    const patch = {};
    if (nombre !== undefined) {
      if (typeof nombre !== 'string' || nombre.trim().length < 2) {
        throw new AuthError('El nombre debe tener al menos 2 caracteres.', 'VALIDATION_ERROR', 400);
      }
      patch.nombre = nombre.trim();
    }
    if (vehiculoFavoritoId !== undefined) {
      patch.vehiculoFavoritoId = vehiculoFavoritoId === null ? null : String(vehiculoFavoritoId);
    }
    const updated = store.update('users', userId, patch);
    if (!updated) throw new AuthError('Usuario no encontrado.', 'NOT_FOUND', 404);
    return publicUser(updated);
  }

  return { register, login, authenticate, updateProfile, publicUser };
}

module.exports = {
  AuthError,
  createAuthService,
  signToken,
  verifyToken,
  hashPassword,
  verifyPassword,
  TOKEN_TTL_SECONDS,
};
