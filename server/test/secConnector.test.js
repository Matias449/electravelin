const test = require('node:test');
const assert = require('node:assert/strict');
const {
  processSecStations,
  validateRawStation,
  normalizeConnector,
  createSecConnectorService,
} = require('../src/services/secConnectorService');
const { createTestApp, createTestStore, withServer, request, registerUser, createAdminToken } = require('../test-utils/helpers');

test('normalización de conectores mapea variantes hacia nomenclaturas oficiales', () => {
  assert.equal(normalizeConnector('CCS 2'), 'CCS2');
  assert.equal(normalizeConnector('ccs2'), 'CCS2');
  assert.equal(normalizeConnector('Combo 2'), 'CCS2');
  assert.equal(normalizeConnector('Type 2 Combo'), 'CCS2');
  assert.equal(normalizeConnector('Chademo'), 'CHAdeMO');
  assert.equal(normalizeConnector('CHADEMO'), 'CHAdeMO');
  assert.equal(normalizeConnector('Tipo 2'), 'Type 2');
  assert.equal(normalizeConnector('Mennekes'), 'Type 2');
  assert.equal(normalizeConnector('invalido_xyz'), null);
});

test('RF08: valida coordenadas dentro de Chile continental y descarta fuera de rango', () => {
  // Coordenadas válidas en Chile
  const valid = validateRawStation({
    nombre: 'Voltex Curicó',
    operador: 'Copec Voltex',
    latitud: -34.98,
    longitud: -71.24,
    conectores: ['CCS2'],
    potencia: 100,
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.data.latitud, -34.98);

  // Fuera de Chile (ej: Buenos Aires, Argentina -34.60, -58.38)
  const invalidLon = validateRawStation({
    nombre: 'Estación Argentina',
    operador: 'Otro',
    latitud: -34.60,
    longitud: -58.38,
    conectores: ['CCS2'],
    potencia: 50,
  });
  assert.equal(invalidLon.valid, false);
  assert.ok(invalidLon.errors.some((e) => e.includes('Longitud fuera de los límites')));

  // Potencia inválida <= 0
  const invalidPower = validateRawStation({
    nombre: 'Estación Cero',
    operador: 'Test',
    latitud: -33.45,
    longitud: -70.66,
    conectores: ['CCS2'],
    potencia: 0,
  });
  assert.equal(invalidPower.valid, false);
});

test('RF08: conserva tarifas desconocidas como null en vez de asumir costo cero', () => {
  const sinTarifa = validateRawStation({
    nombre: 'Estación Pública Gratuita o Sin Dato',
    operador: 'Municipalidad',
    latitud: -33.45,
    longitud: -70.66,
    conectores: ['CCS2'],
    potencia: 22,
  });
  assert.equal(sinTarifa.valid, true);
  assert.equal(sinTarifa.data.tarifa_CLPporKWh, null);
});

test('RF09 & PR-015: deduplica registros de la misma estación y fusiona conectores distintos', () => {
  const rawList = [
    {
      nombre: 'Copec Voltex Talca - Punto A',
      operador: 'Copec Voltex',
      ciudad: 'Talca',
      latitud: -35.4264,
      longitud: -71.6554,
      conectores: ['CCS2'],
      potencia: 150,
      tarifa: 270,
    },
    {
      // Mismo operador y misma ubicación (~0 metros), segundo punto con conector CHAdeMO
      nombre: 'Copec Voltex Talca - Punto B',
      operador: 'Copec Voltex',
      ciudad: 'Talca',
      latitud: -35.4264,
      longitud: -71.6554,
      conectores: ['CHAdeMO'],
      potencia: 100,
      tarifa: 270,
    },
    {
      // Registro inválido para probar descarte
      nombre: 'Estación Rota',
      operador: 'Falla',
      latitud: 10.0,
      longitud: -70.0,
      conectores: ['CCS2'],
      potencia: 50,
    },
  ];

  const result = processSecStations(rawList);
  assert.equal(result.metadata.totalProcesados, 3);
  assert.equal(result.metadata.validos, 1); // Fusionadas en 1 única estación
  assert.equal(result.metadata.descartados, 1);
  assert.equal(result.metadata.duplicadosFusionados, 1);

  const merged = result.stations[0];
  assert.equal(merged.operador, 'Copec Voltex');
  assert.equal(merged.potenciaMaxima_kW, 150);
  assert.deepEqual(merged.conectoresDisponibles.sort(), ['CCS2', 'CHAdeMO'].sort());
  assert.equal(merged.fuente, 'SEC / EcoCarga');
});

test('RF10 & PR-014: ingesta atómica conserva datos previos si la importación falla', () => {
  const fakeStore = {
    data: [
      { id: 'sta_previa', nombre: 'Estación Existente', fuente: 'SEC / EcoCarga' },
    ],
    all() { return [...this.data]; },
    replace(col, items) { this.data = [...items]; },
  };

  const service = createSecConnectorService({ store: fakeStore });

  // Importación con lista totalmente inválida
  assert.throws(() => {
    service.ingestSecStations([
      { nombre: '', latitud: 0, longitud: 0 },
    ]);
  }, (err) => err.code === 'SEC_IMPORT_FAILED');

  // Comprobar que los datos previos siguen intactos
  assert.equal(fakeStore.data.length, 1);
  assert.equal(fakeStore.data[0].id, 'sta_previa');
});

test('RF10: los metadatos de la última ingesta sobreviven al reinicio del servicio', () => {
  const store = createTestStore();
  const service = createSecConnectorService({ store });
  service.ingestSecStations([
    { nombre: 'Estación Persistente', operador: 'Test', ciudad: 'Talca', latitud: -35.42, longitud: -71.65, conectores: ['CCS2'], potencia: 100, tarifa: 250 },
  ]);

  const restarted = createSecConnectorService({ store });
  const metadata = restarted.getMetadata();
  assert.equal(metadata.validos, 1);
  assert.equal(metadata.totalProcesados, 1);
  assert.equal(metadata.descartados, 0);
});

test('Endpoints HTTP: consulta pública de fuente y sincronización admin de SEC', async () => {
  const { app, store } = createTestApp();
  await withServer(app, async (baseUrl) => {
    // 1. Consulta pública de metadatos de fuente (RF10)
    const publicRes = await request(baseUrl, '/api/estaciones/fuente');
    assert.equal(publicRes.status, 200);
    assert.equal(publicRes.body.exito, true);
    assert.ok(publicRes.body.metadata.fuente.includes('SEC'));
    assert.ok(publicRes.body.metadata.fechaActualizacion);

    // 2. Intento de sync sin credenciales admin -> 401
    const noAuth = await request(baseUrl, '/api/admin/estaciones/sync-sec', {
      method: 'POST',
      body: { estaciones: [] },
    });
    assert.equal(noAuth.status, 401);

    // 3. Crear usuario común -> 403
    const regular = await registerUser(baseUrl);
    const forbidden = await request(baseUrl, '/api/admin/estaciones/sync-sec', {
      method: 'POST',
      token: regular.body.token,
      body: { estaciones: [] },
    });
    assert.equal(forbidden.status, 403);

    // 4. Crear usuario admin directamente con createAdminToken y sincronizar datos SEC válidos
    const adminToken = createAdminToken(store);

    const syncRes = await request(baseUrl, '/api/admin/estaciones/sync-sec', {
      method: 'POST',
      token: adminToken,
      body: {
        estaciones: [
          {
            nombre: 'Nueva Estación SEC Linares',
            operador: 'Copec Voltex',
            ciudad: 'Linares',
            latitud: -35.84,
            longitud: -71.59,
            conectores: ['CCS2'],
            potencia: 100,
            tarifa: 260,
          },
        ],
      },
    });

    assert.equal(syncRes.status, 200);
    assert.equal(syncRes.body.exito, true);
    assert.equal(syncRes.body.metadata.validos, 1);
  });
});
