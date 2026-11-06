// stationSeed.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSeedStations, mergeOcmIntoCatalog } = require('../src/services/stationSeed');

const local = [{ id: 'local-1', latitud: 0, longitud: 0 }];
const remoteStation = { id: 'ocm_1', latitud: 10, longitud: 10 };

const ocmStation = (overrides = {}) => ({
  id: 'ocm_1', nombre: 'OCM', fuente: 'Open Charge Map',
  latitud: -33.45, longitud: -70.66, ...overrides,
});

test('both une locales y OCM', async () => {
  const result = await loadSeedStations({
    source: 'both', local,
    ocm: { fetchStationsChile: async () => [remoteStation] },
  });
  assert.deepEqual(result.map((s) => s.id), ['local-1', 'ocm_1']);
});

test('si OCM falla, usa las locales', async () => {
  const result = await loadSeedStations({
    source: 'ocm', local,
    ocm: { fetchStationsChile: async () => { throw new Error('caído'); } },
  });
  assert.deepEqual(result, local);
});

test('agrega estaciones nuevas de OCM', () => {
  const { stations, added } = mergeOcmIntoCatalog([], [ocmStation()]);
  assert.equal(added, 1);
  assert.equal(stations[0].id, 'ocm_1');
});

test('descarta estaciones OCM a menos de 100 m de una manual', () => {
  const manual = { id: 'manual-1', latitud: -33.45, longitud: -70.66 };
  const { stations, added } = mergeOcmIntoCatalog([manual], [ocmStation()]);
  assert.equal(added, 0);
  assert.equal(stations.length, 1);
});

test('actualiza estaciones OCM no editadas', () => {
  const current = [ocmStation({ nombre: 'Viejo', creadoEn: '2026-01-01' })];
  const { stations, updated } = mergeOcmIntoCatalog(current, [ocmStation({ nombre: 'Nuevo' })]);
  assert.equal(updated, 1);
  assert.equal(stations[0].nombre, 'Nuevo');
  assert.equal(stations[0].creadoEn, '2026-01-01');
});

test('no pisa estaciones editadas manualmente', () => {
  const current = [ocmStation({ nombre: 'Corregida', tarifa_CLPporKWh: 300, editadaManualmente: true })];
  const { stations, updated } = mergeOcmIntoCatalog(current, [ocmStation({ nombre: 'Nuevo' })]);
  assert.equal(updated, 0);
  assert.equal(stations[0].tarifa_CLPporKWh, 300);
});