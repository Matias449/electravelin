const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp, withServer, request } = require('../test-utils/helpers');

test('POST /api/calcular-ruta mantiene el contrato v1 sobre el grafo mock', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const response = await request(baseUrl, '/api/calcular-ruta', {
      method: 'POST',
      body: { origenId: 'santiago', destinoId: 'temuco', vehiculoId: 'tesla_model3_lr', socInicial: 90 },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.exito, true);
    assert.ok(response.body.resumen.distanciaTotal_km > 0);
    assert.ok(Array.isArray(response.body.paradas));
    assert.equal(response.body.tramos[0].origenId, 'santiago');
  });
});

test('GET /api/ciudades lista las 14 localidades del grafo', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const response = await request(baseUrl, '/api/ciudades');
    assert.equal(response.status, 200);
    assert.equal(response.body.ciudades.length, 14);
    assert.ok(response.body.ciudades.some((city) => city.id === 'villarrica'));
  });
});

test('POST /api/calcular-ruta responde 400 con ciudades desconocidas', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const response = await request(baseUrl, '/api/calcular-ruta', {
      method: 'POST',
      body: { origenId: 'santiago', destinoId: 'marte', vehiculoId: 'tesla_model3_lr', socInicial: 90 },
    });
    assert.equal(response.status, 400);
  });
});
