const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp, withServer, request, registerUser } = require('../test-utils/helpers');

test('usuario autenticado puede registrar su propio auto no existente en catálogo', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const registro = await registerUser(baseUrl, { nombre: 'Camila Conductora', email: 'camila@ev.cl', password: 'password123' });
    const token = registro.body.token;

    // Crear vehículo personalizado
    const resCrear = await request(baseUrl, '/api/mis-vehiculos', {
      method: 'POST',
      token,
      body: {
        marca: 'Nissan',
        modelo: 'Leaf e+ 62kWh',
        bateriaUtilizable_kWh: 59,
        consumoReferencia_kWhPor100km: 17.5,
        potenciaCargaMaxima_kW: 100,
        conectoresCompatibles: ['CHAdeMO', 'Type 2'],
        esHabitual: true,
      },
    });

    assert.equal(resCrear.status, 201);
    assert.equal(resCrear.body.exito, true);
    assert.ok(resCrear.body.vehiculo.id);
    assert.equal(resCrear.body.vehiculo.marca, 'Nissan');
    assert.equal(resCrear.body.vehiculo.modelo, 'Leaf e+ 62kWh');
    assert.equal(resCrear.body.vehiculo.bateriaUtilizable_kWh, 59);
    assert.equal(resCrear.body.vehiculo.esPersonalizado, true);
    assert.deepEqual(resCrear.body.vehiculo.conectoresCompatibles, ['CHAdeMO', 'Type 2']);

    const autoId = resCrear.body.vehiculo.id;

    // Verificar que en su perfil quedó como habitual porque esHabitual era true
    const me = await request(baseUrl, '/api/auth/me', { token });
    assert.equal(me.body.usuario.vehiculoFavoritoId, autoId);

    // Listar mis vehículos
    const resLista = await request(baseUrl, '/api/mis-vehiculos', { token });
    assert.equal(resLista.status, 200);
    assert.equal(resLista.body.vehiculos.length, 1);
    assert.equal(resLista.body.vehiculos[0].id, autoId);

    // Listar catálogo público con token de este usuario: debe incluir su vehículo
    const resCatAutenticado = await request(baseUrl, '/api/vehiculos', { token });
    assert.ok(resCatAutenticado.body.vehiculos.some((v) => v.id === autoId));

    // Listar catálogo público sin token: NO debe incluir el vehículo personalizado
    const resCatAnonimo = await request(baseUrl, '/api/vehiculos');
    assert.ok(!resCatAnonimo.body.vehiculos.some((v) => v.id === autoId));
  });
});

test('validación estricta de atributos al subir vehículo personalizado', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const registro = await registerUser(baseUrl, { nombre: 'Test Validacion', email: 'val@ev.cl', password: 'password123' });
    const token = registro.body.token;

    // Falta marca y modelo
    const resIncompleto = await request(baseUrl, '/api/mis-vehiculos', {
      method: 'POST',
      token,
      body: {
        bateriaUtilizable_kWh: 50,
        consumoReferencia_kWhPor100km: 15,
        potenciaCargaMaxima_kW: 80,
        conectoresCompatibles: ['CCS2'],
      },
    });
    assert.equal(resIncompleto.status, 400);
    assert.equal(resIncompleto.body.exito, false);

    // Batería <= 0 o no numérica
    const resBateriaMala = await request(baseUrl, '/api/mis-vehiculos', {
      method: 'POST',
      token,
      body: {
        marca: 'Test',
        modelo: 'EV Zero',
        bateriaUtilizable_kWh: 0,
        consumoReferencia_kWhPor100km: 15,
        potenciaCargaMaxima_kW: 80,
        conectoresCompatibles: ['CCS2'],
      },
    });
    assert.equal(resBateriaMala.status, 400);

    // Conectores inválidos
    const resConectorInvalido = await request(baseUrl, '/api/mis-vehiculos', {
      method: 'POST',
      token,
      body: {
        marca: 'Test',
        modelo: 'EV Fake',
        bateriaUtilizable_kWh: 50,
        consumoReferencia_kWhPor100km: 15,
        potenciaCargaMaxima_kW: 80,
        conectoresCompatibles: ['ConectorFantasma'],
      },
    });
    assert.equal(resConectorInvalido.status, 400);
  });
});

test('edición y eliminación de vehículo personalizado con aislamiento entre usuarios', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const user1 = await registerUser(baseUrl, { nombre: 'User 1', email: 'user1@ev.cl', password: 'password123' });
    const user2 = await registerUser(baseUrl, { nombre: 'User 2', email: 'user2@ev.cl', password: 'password123' });

    // User 1 crea un auto
    const resCrear = await request(baseUrl, '/api/mis-vehiculos', {
      method: 'POST',
      token: user1.body.token,
      body: {
        marca: 'Hyundai',
        modelo: 'Kona EV 2021',
        bateriaUtilizable_kWh: 64,
        consumoReferencia_kWhPor100km: 14.8,
        potenciaCargaMaxima_kW: 77,
        conectoresCompatibles: ['CCS2'],
      },
    });
    const autoId = resCrear.body.vehiculo.id;

    // User 2 NO puede ver el auto en su lista privada
    const listaUser2 = await request(baseUrl, '/api/mis-vehiculos', { token: user2.body.token });
    assert.equal(listaUser2.body.vehiculos.length, 0);

    // User 2 NO puede editar el auto de User 1
    const resEditUser2 = await request(baseUrl, `/api/mis-vehiculos/${autoId}`, {
      method: 'PUT',
      token: user2.body.token,
      body: { potenciaCargaMaxima_kW: 150 },
    });
    assert.equal(resEditUser2.status, 404);

    // User 2 NO puede eliminar el auto de User 1
    const resDelUser2 = await request(baseUrl, `/api/mis-vehiculos/${autoId}`, {
      method: 'DELETE',
      token: user2.body.token,
    });
    assert.equal(resDelUser2.status, 404);

    // User 1 sí puede editar su propio auto
    const resEditUser1 = await request(baseUrl, `/api/mis-vehiculos/${autoId}`, {
      method: 'PUT',
      token: user1.body.token,
      body: { potenciaCargaMaxima_kW: 80 },
    });
    assert.equal(resEditUser1.status, 200);
    assert.equal(resEditUser1.body.vehiculo.potenciaCargaMaxima_kW, 80);

    // User 1 sí puede eliminar su propio auto
    const resDelUser1 = await request(baseUrl, `/api/mis-vehiculos/${autoId}`, {
      method: 'DELETE',
      token: user1.body.token,
    });
    assert.equal(resDelUser1.status, 200);

    // Ya no existe en su lista
    const listaDespues = await request(baseUrl, '/api/mis-vehiculos', { token: user1.body.token });
    assert.equal(listaDespues.body.vehiculos.length, 0);
  });
});

test('planificación de ruta funciona correctamente con el vehículo personalizado del usuario', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const registro = await registerUser(baseUrl, { nombre: 'Viajero EV', email: 'viajero@ev.cl', password: 'password123' });
    const token = registro.body.token;

    // Crear vehículo
    const resCrear = await request(baseUrl, '/api/mis-vehiculos', {
      method: 'POST',
      token,
      body: {
        marca: 'Kia',
        modelo: 'EV6 Long Range',
        bateriaUtilizable_kWh: 77.4,
        consumoReferencia_kWhPor100km: 16.5,
        potenciaCargaMaxima_kW: 235,
        conectoresCompatibles: ['CCS2'],
      },
    });
    const autoId = resCrear.body.vehiculo.id;

    // Planificar ruta con este vehículo
    const planRes = await request(baseUrl, '/api/routes/plan', {
      method: 'POST',
      body: {
        origen: 'Santiago',
        destino: 'Rancagua',
        vehiculoId: autoId,
        socInicial: 80,
      },
    });

    assert.equal(planRes.status, 200);
    assert.equal(planRes.body.exito, true);
    assert.equal(planRes.body.vehiculo.id, autoId);
    assert.equal(planRes.body.vehiculo.modelo, 'EV6 Long Range');
    assert.equal(planRes.body.vehiculo.bateriaUtilizable_kWh, 77.4);
    assert.ok(planRes.body.resumen);
  });
});
