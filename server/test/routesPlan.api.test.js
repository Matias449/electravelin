const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/index');
const { RoutingProviderError } = require('../src/services/routingProviders');

async function withServer(routePlanner, callback) {
  const server = createApp({ routePlanner }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  try {
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function post(baseUrl, payload) {
  return fetch(`${baseUrl}/api/routes/plan`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
}

test('POST /api/routes/plan entrega el contrato de una ruta válida', async () => {
  const routePlanner = { plan: async () => ({
    exito: true, geometry: { type: 'LineString', coordinates: [[-70.6, -33.4], [-72.5, -38.7]] },
    resumen: { distanciaTotal_km: 675, socFinal: 20 }, paradas: [], advertencias: [],
  }) };
  await withServer(routePlanner, async (baseUrl) => {
    const response = await post(baseUrl, { origin: 'Santiago', destination: 'Temuco', vehiculoId: 'test-ev', socInicial: 80 });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.exito, true);
    assert.equal(body.geometry.type, 'LineString');
  });
});

test('POST /api/routes/plan conserva una ruta inviable como respuesta controlada', async () => {
  const routePlanner = { plan: async () => ({ exito: false, code: 'ROUTE_NOT_FEASIBLE', error: 'No hay estación compatible alcanzable.' }) };
  await withServer(routePlanner, async (baseUrl) => {
    const response = await post(baseUrl, { origin: 'Santiago', destination: 'Temuco', vehiculoId: 'test-ev', socInicial: 20 });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.code, 'ROUTE_NOT_FEASIBLE');
  });
});

test('POST /api/routes/plan informa una estación incompatible sin convertirla en error 500', async () => {
  const routePlanner = { plan: async () => ({ exito: false, code: 'ROUTE_NOT_FEASIBLE', error: 'No hay estación compatible alcanzable.' }) };
  await withServer(routePlanner, async (baseUrl) => {
    const response = await post(baseUrl, { origin: 'Santiago', destination: 'Temuco', vehiculoId: 'test-ev', socInicial: 20 });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.match(body.error, /compatible/);
  });
});

test('POST /api/routes/plan transforma fallas de proveedor en 502 sin filtrar detalles', async () => {
  const routePlanner = { plan: async () => { throw new RoutingProviderError('clave privada simulada', 'openrouteservice'); } };
  await withServer(routePlanner, async (baseUrl) => {
    const response = await post(baseUrl, { origin: 'Santiago', destination: 'Temuco', vehiculoId: 'test-ev', socInicial: 80 });
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(body.code, 'ROUTING_PROVIDER_ERROR');
    assert.equal(body.proveedor, 'openrouteservice');
    assert.doesNotMatch(JSON.stringify(body), /clave privada simulada/);
  });
});
