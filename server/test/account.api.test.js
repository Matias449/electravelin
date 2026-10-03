const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp, withServer, request, registerUser } = require('../test-utils/helpers');

const tripPayload = {
  origen: 'Santiago',
  destino: 'Temuco',
  vehiculoId: 'tesla_model3_lr',
  socInicial: 80,
  resumen: { distanciaTotal_km: 669, tiempoTotalViaje_min: 490, costoTotal_CLP: 19090, socFinal: 51.6 },
  paradas: [{ orden: 1, estacionId: 'sta_talca_shell', estacionNombre: 'Shell Recharge Talca' }],
  geometry: { type: 'LineString', coordinates: [[-70.6, -33.4], [-72.5, -38.7]] },
  advertencias: [],
};

test('guardar, listar y eliminar viajes del historial propio', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const registro = await registerUser(baseUrl);
    const token = registro.body.token;

    const saved = await request(baseUrl, '/api/viajes', { method: 'POST', token, body: tripPayload });
    assert.equal(saved.status, 201);
    assert.equal(saved.body.viaje.origen, 'Santiago');

    const list = await request(baseUrl, '/api/viajes', { token });
    assert.equal(list.status, 200);
    assert.equal(list.body.viajes.length, 1);

    const detail = await request(baseUrl, `/api/viajes/${saved.body.viaje.id}`, { token });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.viaje.resumen.costoTotal_CLP, 19090);

    const removed = await request(baseUrl, `/api/viajes/${saved.body.viaje.id}`, { method: 'DELETE', token });
    assert.equal(removed.status, 200);

    const empty = await request(baseUrl, '/api/viajes', { token });
    assert.equal(empty.body.viajes.length, 0);
  });
});

test('un viaje inválido responde 400 y no se guarda', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const registro = await registerUser(baseUrl);
    const response = await request(baseUrl, '/api/viajes', {
      method: 'POST',
      token: registro.body.token,
      body: { origen: 'Santiago' },
    });
    assert.equal(response.status, 400);
    assert.ok(response.body.detalles.length >= 3);
  });
});

test('el historial es privado: otro usuario no puede leer ni borrar viajes ajenos', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const owner = await registerUser(baseUrl);
    const intruder = await registerUser(baseUrl);
    const saved = await request(baseUrl, '/api/viajes', { method: 'POST', token: owner.body.token, body: tripPayload });

    const read = await request(baseUrl, `/api/viajes/${saved.body.viaje.id}`, { token: intruder.body.token });
    assert.equal(read.status, 404);

    const remove = await request(baseUrl, `/api/viajes/${saved.body.viaje.id}`, { method: 'DELETE', token: intruder.body.token });
    assert.equal(remove.status, 404);

    const list = await request(baseUrl, '/api/viajes', { token: intruder.body.token });
    assert.equal(list.body.viajes.length, 0);
  });
});

test('favoritos: agrega vehículo y estación, deduplica y elimina', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const registro = await registerUser(baseUrl);
    const token = registro.body.token;

    const vehicle = await request(baseUrl, '/api/favoritos', {
      method: 'POST',
      token,
      body: { tipo: 'vehiculo', referenciaId: 'tesla_model3_lr' },
    });
    assert.equal(vehicle.status, 201);

    const duplicate = await request(baseUrl, '/api/favoritos', {
      method: 'POST',
      token,
      body: { tipo: 'vehiculo', referenciaId: 'tesla_model3_lr' },
    });
    assert.equal(duplicate.status, 201);
    assert.equal(duplicate.body.favorito.id, vehicle.body.favorito.id);

    const station = await request(baseUrl, '/api/favoritos', {
      method: 'POST',
      token,
      body: { tipo: 'estacion', referenciaId: 'sta_talca_shell' },
    });
    assert.equal(station.status, 201);

    const missing = await request(baseUrl, '/api/favoritos', {
      method: 'POST',
      token,
      body: { tipo: 'estacion', referenciaId: 'sta_inexistente' },
    });
    assert.equal(missing.status, 404);

    const list = await request(baseUrl, '/api/favoritos', { token });
    assert.equal(list.body.favoritos.length, 2);
    assert.ok(list.body.favoritos.every((favorite) => favorite.referencia));

    const removed = await request(baseUrl, `/api/favoritos/${vehicle.body.favorito.id}`, { method: 'DELETE', token });
    assert.equal(removed.status, 200);
    const after = await request(baseUrl, '/api/favoritos', { token });
    assert.equal(after.body.favoritos.length, 1);
  });
});
