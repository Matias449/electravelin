const test = require('node:test');
const assert = require('node:assert/strict');
const { createRoutePlanningService } = require('../src/services/routePlanningService');

const vehicle = {
  id: 'test-ev',
  modelo: 'EV de prueba',
  marca: 'Test',
  bateriaUtilizable_kWh: 50,
  consumoReferencia_kWhPor100km: 20,
  potenciaCargaMaxima_kW: 100,
  conectoresCompatibles: ['CCS2'],
};

function providerFixture(distanceMeters = 200000) {
  return {
    geocode: async (query) => query.startsWith('Origen')
      ? { nombre: 'Origen', latitud: 0, longitud: 0 }
      : { nombre: 'Destino', latitud: 0, longitud: 2 },
    getDirections: async () => ({
      geometry: { type: 'LineString', coordinates: [[0, 0], [2, 0]] },
      distancia_m: distanceMeters,
      duracion_s: 14400,
    }),
  };
}

function station({ connector = 'CCS2', longitude = 0.5 } = {}) {
  return {
    id: 'station-1', nombre: 'Estación de prueba', ciudad: 'Ruta 5', disponible: true,
    latitud: 0, longitud: longitude, conectoresDisponibles: [connector],
    potenciaMaxima_kW: 100, tarifa_CLPporKWh: 250,
  };
}

test('calcula una ruta realista y conserva la reserva mínima', async () => {
  const service = createRoutePlanningService({ providers: providerFixture(), vehicles: [vehicle], stations: [station()] });
  const result = await service.plan({ origin: 'Origen', destination: 'Destino', vehiculoId: 'test-ev', socInicial: 40 });

  assert.equal(result.exito, true);
  assert.equal(result.geometry.type, 'LineString');
  assert.equal(result.resumen.distanciaTotal_km, 200);
  assert.equal(result.paradas.length, 1);
  assert.ok(result.resumen.socFinal >= 15);
  assert.equal(result.paradas[0].conectorUsado, 'CCS2');
});

test('declara inviable una ruta cuando la estación cercana es incompatible', async () => {
  const service = createRoutePlanningService({ providers: providerFixture(), vehicles: [vehicle], stations: [station({ connector: 'CHAdeMO' })] });
  const result = await service.plan({ origin: 'Origen', destination: 'Destino', vehiculoId: 'test-ev', socInicial: 40 });

  assert.equal(result.exito, false);
  assert.equal(result.code, 'ROUTE_NOT_FEASIBLE');
  assert.match(result.error, /estación compatible alcanzable/i);
  assert.match(result.advertencias[0], /No se encontraron estaciones compatibles/i);
});

test('declara cobertura insuficiente cuando ningún cargador permite el siguiente tramo', async () => {
  const service = createRoutePlanningService({ providers: providerFixture(400000), vehicles: [vehicle], stations: [station({ longitude: 0.4 })] });
  const result = await service.plan({ origin: 'Origen', destination: 'Destino', vehiculoId: 'test-ev', socInicial: 80 });

  assert.equal(result.exito, false);
  assert.equal(result.code, 'INSUFFICIENT_COVERAGE');
  assert.match(result.error, /cobertura compatible/i);
});
