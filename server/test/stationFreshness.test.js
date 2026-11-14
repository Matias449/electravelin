const test = require('node:test');
const assert = require('node:assert/strict');
const {
  checkDataFreshness,
  toIsoDate,
  formatDateLegible,
  ALERTA_OBSOLESCENCIA,
} = require('../src/utils/dateUtils');
const { createTestApp, withServer, request } = require('../test-utils/helpers');

test('CR-01: Estación con revisión hace <= 30 días no genera alerta de obsolescencia', () => {
  const fechaActual = new Date('2026-11-12T12:00:00.000Z');

  // Exactamente hoy (0 días)
  const hoy = checkDataFreshness('2026-11-12', fechaActual);
  assert.equal(hoy.diasTranscurridos, 0);
  assert.equal(hoy.desactualizada, false);
  assert.equal(hoy.alerta, null);
  assert.equal(hoy.fechaLegible, '12/11/2026');

  // 15 días de antigüedad
  const quinceDias = checkDataFreshness('2026-10-28', fechaActual);
  assert.equal(quinceDias.diasTranscurridos, 15);
  assert.equal(quinceDias.desactualizada, false);
  assert.equal(quinceDias.alerta, null);
  assert.equal(quinceDias.fechaLegible, '28/10/2026');

  // Exactamente 30 días de antigüedad
  const treintaDias = checkDataFreshness('2026-10-13', fechaActual);
  assert.equal(treintaDias.diasTranscurridos, 30);
  assert.equal(treintaDias.desactualizada, false);
  assert.equal(treintaDias.alerta, null);
  assert.equal(treintaDias.fechaLegible, '13/10/2026');
});

test('CR-01: Estación con revisión hace > 30 días activa alerta destacada de obsolescencia', () => {
  const fechaActual = new Date('2026-11-12T12:00:00.000Z');

  // 31 días de antigüedad (estrictamente > 30 días)
  const treintaYUnDias = checkDataFreshness('2026-10-12', fechaActual);
  assert.equal(treintaYUnDias.diasTranscurridos, 31);
  assert.equal(treintaYUnDias.desactualizada, true);
  assert.equal(treintaYUnDias.alerta, ALERTA_OBSOLESCENCIA);
  assert.equal(treintaYUnDias.fechaLegible, '12/10/2026');

  // 45 días de antigüedad
  const cuarentaYCincoDias = checkDataFreshness('2026-09-28', fechaActual);
  assert.equal(cuarentaYCincoDias.diasTranscurridos, 45);
  assert.equal(cuarentaYCincoDias.desactualizada, true);
  assert.equal(cuarentaYCincoDias.alerta, ALERTA_OBSOLESCENCIA);
});

test('CR-01: Estación sin fecha válida o nula se maneja de forma segura sin excepciones', () => {
  const fechaActual = new Date('2026-11-12T12:00:00.000Z');

  const casos = [null, undefined, '', 'fecha-invalida', NaN, {}];
  for (const entrada of casos) {
    assert.doesNotThrow(() => {
      const res = checkDataFreshness(entrada, fechaActual);
      assert.equal(res.desactualizada, true);
      assert.match(res.alerta, /Fecha de revisión no disponible/);
      assert.equal(res.diasTranscurridos, null);
      assert.equal(res.fechaLegible, 'Sin fecha registrada');
    });
  }
});

test('CR-01: Formato de fecha legible chileno DD/MM/AAAA e ISO 8601 YYYY-MM-DD', () => {
  assert.equal(toIsoDate('2026-10-15'), '2026-10-15');
  assert.equal(toIsoDate('15/10/2026'), '2026-10-15');
  assert.equal(toIsoDate('2026-10-15T08:30:00.000Z'), '2026-10-15');
  assert.equal(formatDateLegible('2026-10-15'), '15/10/2026');
  assert.equal(formatDateLegible('15/10/2026'), '15/10/2026');
  assert.equal(formatDateLegible(null), 'Sin fecha registrada');
});

test('CR-01: Endpoint /api/estaciones expone fuente y fechaRevision normalizadas', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const res = await request(baseUrl, '/api/estaciones');
    assert.equal(res.status, 200);
    assert.ok(res.body.estaciones.length > 0);
    for (const station of res.body.estaciones) {
      assert.equal(station.fuente, null);
      assert.equal(station.fechaRevision, null);
      assert.equal(station.fechaActualizacion, null);
    }
  });
});

test('CR-01: Planificación de ruta expone fuente y fechaRevision normalizadas en cada parada', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const res = await request(baseUrl, '/api/routes/plan', {
      method: 'POST',
      body: {
        origin: 'Santiago',
        destination: 'Rancagua',
        vehiculoId: 'nissan_leaf_eplus',
        socInicial: 20, // fuerza parada o carga
      },
    });
    assert.equal(res.status, 200);
    if (res.body.paradas?.length > 0) {
      for (const parada of res.body.paradas) {
        assert.equal(parada.fuente, null);
        assert.equal(parada.fechaRevision, null);
        assert.equal(parada.fechaActualizacion, null);
      }
    }
  });
});


test('CR-01: rechaza fechas imposibles y distingue fechas futuras', () => {
  for (const date of ['31/02/2026', '2026-02-31', '2026-02-31T12:00:00Z']) assert.equal(toIsoDate(date), null);
  assert.equal(toIsoDate('2024-02-29'), '2024-02-29');
  assert.match(checkDataFreshness('2026-12-01', new Date('2026-11-14T12:00:00Z')).alerta, /futura/);
});

test('CR-01: SEC conserva actualización sin inventar revisión', async () => {
  const { createSecPublicCatalogService } = require('../src/services/secPublicCatalogService');
  const entries = [
    { location_id: '1', name: 'Carga Central', commune: 'Ñuñoa', OPC: { name: 'Copec Voltex' }, last_updated: '2026-11-10T12:00:00Z' },
    { location_id: '2', name: 'Carga Norte', commune: 'Providencia', OPC: { name: 'Otro' } },
  ];
  const service = createSecPublicCatalogService({ fetchFn: async () => ({ ok: true, json: async () => entries }) });
  const stations = await service.list({ busqueda: 'Ñuñoa' });
  assert.equal(stations.length, 1);
  assert.equal(stations[0].fuente, 'SEC / Plataforma de Interoperabilidad EcoCarga');
  assert.equal(stations[0].fechaRevision, null);
  assert.equal(stations[0].fechaActualizacion, '2026-11-10');
  assert.match(checkDataFreshness(stations[0].fechaRevision).alerta, /no disponible/);
  assert.equal((await service.list({ busqueda: 'inexistente' })).length, 0);
});

test('CR-01: OCM distingue revisión de actualización y no usa fecha de creación', () => {
  const { normalizeStation } = require('../src/services/openChargeMapService');
  const base = { ID: 42, AddressInfo: {}, DateLastStatusUpdate: '2026-11-10T12:00:00Z', DateCreated: '2020-01-01T00:00:00Z' };
  const station = normalizeStation(base);
  assert.equal(station.fechaRevision, null);
  assert.equal(station.fechaActualizacion, '2026-11-10');
  assert.equal(normalizeStation({ ...base, DateLastVerified: '2026-10-03T00:00:00Z' }).fechaRevision, '2026-10-03');
});

test('CR-01: catálogo local conserva metadatos desconocidos', async () => {
  const { app } = createTestApp();
  await withServer(app, async (base) => {
    const res = await request(base, '/api/estaciones?busqueda=Portugal%20175');
    assert.equal(res.status, 200);
    assert.ok(res.body.estaciones.length > 0);
    for (const station of res.body.estaciones) {
      assert.match(station.direccion, /Portugal 175/);
      assert.equal(station.fuente, null);
      assert.equal(station.fechaRevision, null);
    }
  });
});

test('CR-01: el frontend distingue fecha inválida, futura y ausente', async () => {
  const { checkDataFreshness: ui } = await import('../../client/src/utils/stationFreshness.js');
  const now = new Date('2026-11-14T12:00:00Z');
  assert.match(ui('31/02/2026', now).alerta, /no disponible/);
  assert.match(ui(null, now).alerta, /no disponible/);
  assert.match(ui('2026-12-01', now).alerta, /futura/);
  assert.equal(ui('2026-11-10', now).alerta, null);
  assert.match(ui('2026-10-01', now).alerta, /más de 30 días/);
});


test('CR-01 y filtro: múltiples palabras, tildes y metadatos conviven', async () => {
  const { createSecPublicCatalogService } = require('../src/services/secPublicCatalogService');
  const entries = [
    { location_id: '1', name: 'Carga Central', commune: 'Ñuñoa', OPC: { name: 'Copec Voltex' }, last_updated: '2026-11-10T12:00:00Z' },
    { location_id: '2', name: 'Carga Norte', commune: 'Providencia', OPC: { name: 'Otro' } },
  ];
  const sec = createSecPublicCatalogService({ fetchFn: async () => ({ ok: true, json: async () => entries }) });
  for (const busqueda of ['voltex nunoa', 'NUÑOA COPEC']) {
    const result = await sec.list({ busqueda });
    assert.equal(result.length, 1);
    assert.equal(result[0].fechaRevision, null);
    assert.equal(result[0].fechaActualizacion, '2026-11-10');
    assert.match(checkDataFreshness(result[0].fechaRevision).alerta, /no disponible/);
  }
  assert.equal((await sec.list({ busqueda: 'voltex providencia' })).length, 0);
  const { app } = createTestApp();
  await withServer(app, async (base) => {
    const res = await request(base, '/api/estaciones?busqueda=175%20portugal');
    assert.equal(res.status, 200);
    assert.ok(res.body.estaciones.length > 0);
    assert.ok(res.body.estaciones.every((s) => s.direccion.includes('Portugal 175') && s.fechaRevision === null));
  });
});
