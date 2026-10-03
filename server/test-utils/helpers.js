const { createStore } = require('../src/services/dataStore');
const { createApp } = require('../src/index');
const { createAuthService } = require('../src/services/authService');
const seedVehicles = require('../src/data/vehicles.json');
const seedStations = require('../src/data/stations.json');
const { createLogger } = require('../src/services/logger');

const TEST_JWT_SECRET = 'secreto-de-prueba';

function silentLogger() {
  return createLogger({ level: 'error', stream: { write() {} } });
}

function createTestStore() {
  return createStore({ seed: { vehicles: seedVehicles, stations: seedStations } });
}

function createTestApp(options = {}) {
  const store = options.store || createTestStore();
  const app = createApp({
    store,
    jwtSecret: TEST_JWT_SECRET,
    logger: options.logger || silentLogger(),
    routePlanner: options.routePlanner,
  });
  return { app, store };
}

function createAdminToken(store) {
  const authService = createAuthService({ store, jwtSecret: TEST_JWT_SECRET });
  const { token } = authService.register({
    nombre: 'Admin Test',
    email: `admin_${Date.now()}_${Math.random().toString(16).slice(2)}@test.cl`,
    password: 'admin-segura-123',
    rol: 'admin',
  });
  return token;
}

async function withServer(app, callback) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  try {
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function request(baseUrl, path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, body: json, headers: response.headers };
}

async function registerUser(baseUrl, overrides = {}) {
  const payload = {
    nombre: 'Usuario de prueba',
    email: `usuario_${Date.now()}_${Math.random().toString(16).slice(2)}@test.cl`,
    password: 'clave-segura-123',
    ...overrides,
  };
  const response = await request(baseUrl, '/api/auth/register', { method: 'POST', body: payload });
  return { ...response, payload };
}

module.exports = { createTestStore, createTestApp, createAdminToken, withServer, request, registerUser, silentLogger };
