const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp, withServer, request } = require('../test-utils/helpers');
const { createLogger, sanitize } = require('../src/services/logger');
const { RoutingProviderError } = require('../src/services/routingProviders');

test('health y ready responden sin exponer secretos', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const health = await request(baseUrl, '/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.status, 'ok');
    assert.ok(health.body.version);
    assert.ok(health.body.requestId);

    const ready = await request(baseUrl, '/api/ready');
    assert.equal(ready.status, 200);
    assert.equal(ready.body.status, 'ready');
    assert.equal(ready.body.checks.almacen, 'ok');
    assert.equal(typeof ready.body.checks.ruteoConfigurado, 'boolean');
    assert.doesNotMatch(JSON.stringify(ready.body), /ORS_API_KEY|JWT_SECRET/);
  });
});

test('cada respuesta incluye x-request-id y respeta el entrante', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const generated = await request(baseUrl, '/api/health');
    assert.ok(generated.headers.get('x-request-id'));

    const incoming = 'request-de-prueba-123';
    const echoed = await fetch(`${baseUrl}/api/health`, { headers: { 'x-request-id': incoming } });
    assert.equal(echoed.headers.get('x-request-id'), incoming);
  });
});

test('el logger redacta campos sensibles', () => {
  const sanitized = sanitize({
    email: 'persona@test.cl',
    password: 'secreta',
    authorization: 'Bearer abc',
    nested: { token: 'xyz', apiKey: 'k' },
  });
  assert.equal(sanitized.password, '[REDACTADO]');
  assert.equal(sanitized.authorization, '[REDACTADO]');
  assert.equal(sanitized.nested.token, '[REDACTADO]');
  assert.equal(sanitized.nested.apiKey, '[REDACTADO]');
  assert.equal(sanitized.email, 'persona@test.cl');
});

test('el logger escribe JSON estructurado y respeta el nivel', () => {
  const lines = [];
  const logger = createLogger({ level: 'info', stream: { write: (line) => lines.push(line) } });
  logger.debug('no_debe_salir');
  logger.info('evento', { requestId: 'abc', password: 'secreta' });
  logger.error('fallo', { message: 'algo pasó' });

  assert.equal(lines.length, 2);
  const first = JSON.parse(lines[0]);
  assert.equal(first.msg, 'evento');
  assert.equal(first.level, 'info');
  assert.equal(first.password, '[REDACTADO]');
  const second = JSON.parse(lines[1]);
  assert.equal(second.level, 'error');
});

test('una falla del proveedor queda registrada en el log con request ID sin filtrarla al cliente', async () => {
  const lines = [];
  const logger = createLogger({ level: 'debug', stream: { write: (line) => lines.push(line) } });
  const routePlanner = {
    plan: async () => { throw new RoutingProviderError('clave privada simulada', 'openrouteservice'); },
  };
  const { app } = createTestApp({ routePlanner, logger });
  await withServer(app, async (baseUrl) => {
    const response = await request(baseUrl, '/api/routes/plan', {
      method: 'POST',
      body: { origin: 'Santiago', destination: 'Temuco', vehiculoId: 'tesla_model3_lr', socInicial: 80 },
    });
    assert.equal(response.status, 502);
    assert.doesNotMatch(JSON.stringify(response.body), /clave privada simulada/);

    const logs = lines.map((line) => JSON.parse(line));
    const providerLog = logs.find((entry) => entry.msg === 'routing_provider_error');
    assert.ok(providerLog, 'debe registrar routing_provider_error');
    assert.equal(providerLog.proveedor, 'openrouteservice');
    assert.ok(providerLog.requestId);
  });
});
