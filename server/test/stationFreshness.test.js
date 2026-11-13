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
      assert.equal(res.alerta, ALERTA_OBSOLESCENCIA);
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
      assert.ok(typeof station.fuente === 'string' && station.fuente.length > 0, `Estación ${station.id} debe tener fuente`);
      assert.match(station.fechaRevision, /^\d{4}-\d{2}-\d{2}$/, `Estación ${station.id} debe tener fechaRevision en ISO YYYY-MM-DD`);
      assert.match(station.fechaActualizacion, /^\d{4}-\d{2}-\d{2}$/, `Estación ${station.id} debe tener fechaActualizacion en ISO YYYY-MM-DD`);
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
        assert.ok(typeof parada.fuente === 'string' && parada.fuente.length > 0);
        assert.match(parada.fechaRevision, /^\d{4}-\d{2}-\d{2}$/);
        assert.match(parada.fechaActualizacion, /^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });
});
