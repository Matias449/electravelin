// stationSeed.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSeedStations } = require('../src/services/stationSeed');

const local = [{ id: 'local-1', latitud: 0, longitud: 0 }];
const remoteStation = { id: 'ocm_1', latitud: 10, longitud: 10 };

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