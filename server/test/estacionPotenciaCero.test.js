const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCandidateStations } = require('../src/services/routePlanningService');
const { createTestApp, createAdminToken, withServer, request } = require('../test-utils/helpers');

// RF08 y PR-008: una estación con potencia cero o sin ubicación nunca se recomienda.
const vehiculo = { conectoresCompatibles: ['CCS2'] };
const coords = [[-70.6, -33.4], [-70.6, -34.4]];
const base = { disponible: true, conectoresDisponibles: ['CCS2'], longitud: -70.6, tarifa_CLPporKWh: 250 };

test('RF08: el planificador descarta estaciones con potencia 0 o sin coordenadas', () => {
  const estaciones = [
    { ...base, id: 'buena', latitud: -33.9, potenciaMaxima_kW: 50 },
    { ...base, id: 'cero', latitud: -33.8, potenciaMaxima_kW: 0 },
    { ...base, id: 'negativa', latitud: -33.7, potenciaMaxima_kW: -10 },
    { ...base, id: 'sinUbicacion', latitud: null, longitud: null, potenciaMaxima_kW: 50 },
  ];
  const ids = buildCandidateStations({ stations: estaciones, vehicle: vehiculo, coordinates: coords, totalDistanceKm: 111 }).map((s) => s.id);
  assert.deepEqual(ids, ['buena']);
});

test('RF08: el panel de administración rechaza una estación con potencia 0', async () => {
  const { app, store } = createTestApp();
  const token = createAdminToken(store);
  await withServer(app, async (baseUrl) => {
    const res = await request(baseUrl, '/api/admin/estaciones', {
      method: 'POST', token,
      body: { nombre: 'Prueba', ciudad: 'Talca', operador: 'Op', latitud: -35.4, longitud: -71.6, conectoresDisponibles: ['CCS2'], potenciaMaxima_kW: 0, tarifa_CLPporKWh: 250 },
    });
    assert.equal(res.status, 400);
  });
});
