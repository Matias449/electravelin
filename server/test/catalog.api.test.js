const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp, createAdminToken, withServer, request, registerUser } = require('../test-utils/helpers');

test('el catálogo público expone al menos 15 vehículos y 15 estaciones verificadas', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const vehicles = await request(baseUrl, '/api/vehiculos');
    assert.equal(vehicles.status, 200);
    assert.ok(vehicles.body.vehiculos.length >= 15, `vehículos: ${vehicles.body.vehiculos.length}`);

    const stations = await request(baseUrl, '/api/estaciones');
    assert.equal(stations.status, 200);
    assert.ok(stations.body.estaciones.length >= 15, `estaciones: ${stations.body.estaciones.length}`);
    assert.ok(stations.body.estaciones.every((station) => station.ciudad && station.operador && station.conectoresDisponibles.length > 0));
  });
});

test('filtros públicos de vehículos y estaciones', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const tesla = await request(baseUrl, '/api/vehiculos?marca=Tesla');
    assert.equal(tesla.body.vehiculos.length, 2);

    const chademo = await request(baseUrl, '/api/vehiculos?conector=CHAdeMO');
    assert.ok(chademo.body.vehiculos.length >= 1);
    assert.ok(chademo.body.vehiculos.every((vehicle) => vehicle.conectoresCompatibles.includes('CHAdeMO')));

    const potentes = await request(baseUrl, '/api/vehiculos?potenciaMin=150');
    assert.ok(potentes.body.vehiculos.every((vehicle) => vehicle.potenciaCargaMaxima_kW >= 150));

    const talca = await request(baseUrl, '/api/estaciones?ciudad=Talca');
    assert.ok(talca.body.estaciones.length >= 1);
    assert.ok(talca.body.estaciones.every((station) => station.ciudad.includes('Talca')));

    const rapidas = await request(baseUrl, '/api/estaciones?conector=CCS2&potenciaMin=100');
    assert.ok(rapidas.body.estaciones.every((station) => station.conectoresDisponibles.includes('CCS2') && station.potenciaMaxima_kW >= 100));
  });
});

test('el admin puede crear, editar y desactivar vehículos, y queda auditoría', async () => {
  const { app, store } = createTestApp();
  const adminToken = createAdminToken(store);
  await withServer(app, async (baseUrl) => {
    const created = await request(baseUrl, '/api/admin/vehiculos', {
      method: 'POST',
      token: adminToken,
      body: {
        id: 'test_ev_admin',
        modelo: 'EV Admin',
        marca: 'Test',
        bateriaUtilizable_kWh: 60,
        consumoReferencia_kWhPor100km: 15,
        potenciaCargaMaxima_kW: 120,
        conectoresCompatibles: ['CCS2'],
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.vehiculo.id, 'test_ev_admin');

    const publicList = await request(baseUrl, '/api/vehiculos');
    assert.ok(publicList.body.vehiculos.some((vehicle) => vehicle.id === 'test_ev_admin'));

    const updated = await request(baseUrl, '/api/admin/vehiculos/test_ev_admin', {
      method: 'PUT',
      token: adminToken,
      body: { potenciaCargaMaxima_kW: 180 },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.vehiculo.potenciaCargaMaxima_kW, 180);

    const deactivated = await request(baseUrl, '/api/admin/vehiculos/test_ev_admin', { method: 'DELETE', token: adminToken });
    assert.equal(deactivated.status, 200);
    assert.equal(deactivated.body.vehiculo.activo, false);

    const afterDeactivation = await request(baseUrl, '/api/vehiculos');
    assert.ok(!afterDeactivation.body.vehiculos.some((vehicle) => vehicle.id === 'test_ev_admin'));

    const audit = await request(baseUrl, '/api/admin/auditoria?entidad=vehiculo', { token: adminToken });
    assert.equal(audit.status, 200);
    const actions = audit.body.auditoria.map((entry) => entry.accion);
    assert.ok(actions.includes('crear'));
    assert.ok(actions.includes('actualizar'));
    assert.ok(actions.includes('desactivar'));
  });
});

test('validaciones del CRUD administrativo de estaciones', async () => {
  const { app, store } = createTestApp();
  const adminToken = createAdminToken(store);
  await withServer(app, async (baseUrl) => {
    const invalid = await request(baseUrl, '/api/admin/estaciones', {
      method: 'POST',
      token: adminToken,
      body: { nombre: 'Estación mala', ciudad: 'Santiago', operador: 'Test', latitud: -33, longitud: -70, conectoresDisponibles: ['TipoX'], potenciaMaxima_kW: 50, tarifa_CLPporKWh: 200 },
    });
    assert.equal(invalid.status, 400);

    const created = await request(baseUrl, '/api/admin/estaciones', {
      method: 'POST',
      token: adminToken,
      body: {
        nombre: 'Estación Nueva', ciudad: 'Santiago', operador: 'Test', latitud: -33.45, longitud: -70.66,
        conectoresDisponibles: ['CCS2'], potenciaMaxima_kW: 120, tarifa_CLPporKWh: 250, verificada: true,
      },
    });
    assert.equal(created.status, 201);

    const updated = await request(baseUrl, `/api/admin/estaciones/${created.body.estacion.id}`, {
      method: 'PUT',
      token: adminToken,
      body: { disponible: false },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.estacion.disponible, false);

    const publicList = await request(baseUrl, '/api/estaciones');
    assert.ok(!publicList.body.estaciones.some((station) => station.id === created.body.estacion.id));

    const adminList = await request(baseUrl, '/api/admin/estaciones', { token: adminToken });
    assert.ok(adminList.body.estaciones.some((station) => station.id === created.body.estacion.id));
  });
});

test('un usuario común no puede mutar el catálogo', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const registro = await registerUser(baseUrl);
    const response = await request(baseUrl, '/api/admin/vehiculos', {
      method: 'POST',
      token: registro.body.token,
      body: { modelo: 'X', marca: 'Y', bateriaUtilizable_kWh: 1, consumoReferencia_kWhPor100km: 1, potenciaCargaMaxima_kW: 1, conectoresCompatibles: ['CCS2'] },
    });
    assert.equal(response.status, 403);
  });
});
