// routePlanningService.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
// const { createRoutePlanningService } = require('../src/services/routePlanningService');
const { createRoutePlanningService: createService } = require('../src/services/routePlanningService');
const createRoutePlanningService = (options) => createService({ stationsSource: 'local', cache: new Map(), ...options });

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

test('con batería baja propone una carga inicial en una electrolinera compatible del origen', async () => {
  const originStation = {
    ...station({ longitude: 0 }),
    id: 'origin-station',
    nombre: 'Carga de salida',
  };
  const service = createRoutePlanningService({
    providers: providerFixture(),
    vehicles: [vehicle],
    stations: [originStation, station({ longitude: 0.5 })],
  });
  const result = await service.plan({ origin: 'Origen', destination: 'Destino', vehiculoId: 'test-ev', socInicial: 20 });

  assert.equal(result.exito, true);
  assert.equal(result.paradas[0].estacionId, 'origin-station');
  assert.equal(result.paradas[0].esCargaInicial, true);
  assert.ok(result.advertencias.some((warning) => /carga de salida/i.test(warning)));
  assert.equal(result.estacionesOrigenCompatibles[0].id, 'origin-station');
});

test('con batería baja en viaje largo que excede la autonomía completa agrega carga en origen y parada intermedia', async () => {
  const originStation = { ...station({ longitude: 0 }), id: 'origin-station', nombre: 'Carga de salida' };
  const intermediateStation = { ...station({ longitude: 1.0 }), id: 'intermediate-station', nombre: 'Parada intermedia' };
  const service = createRoutePlanningService({
    providers: providerFixture(300000),
    vehicles: [vehicle],
    stations: [originStation, intermediateStation],
  });
  const result = await service.plan({ origin: 'Origen', destination: 'Destino', vehiculoId: 'test-ev', socInicial: 15 });

  assert.equal(result.exito, true);
  assert.equal(result.paradas.length, 2);
  assert.equal(result.paradas[0].estacionId, 'origin-station');
  assert.equal(result.paradas[0].esCargaInicial, true);
  assert.equal(result.paradas[1].estacionId, 'intermediate-station');
  assert.ok(result.resumen.socFinal >= 15);
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

test('RF17, RF10 & RN06: conserva metadatos de fuente, fecha y maneja tarifa desconocida como costo parcial', async () => {
  const customStation = {
    ...station({ longitude: 0.5 }),
    fuente: 'SEC EcoCarga Oficial',
    fechaActualizacion: '2026-10-05',
    tarifa_CLPporKWh: null,
  };
  const service = createRoutePlanningService({
    providers: providerFixture(),
    vehicles: [vehicle],
    stations: [customStation],
  });
  const result = await service.plan({ origin: 'Origen', destination: 'Destino', vehiculoId: 'test-ev', socInicial: 40 });

  assert.equal(result.exito, true);
  assert.equal(result.paradas[0].fuente, 'SEC EcoCarga Oficial');
  assert.equal(result.paradas[0].fechaActualizacion, '2026-10-05');
  assert.equal(result.paradas[0].costo_CLP, null);
  assert.equal(result.resumen.costoIncompleto, true);
  assert.ok(result.advertencias.some((w) => /tarifa informada/i.test(w)));
});

const planInput = { origin: 'Origen', destination: 'Destino', vehiculoId: 'test-ev', socInicial: 40 };

test('stationsSource "ocm" usa solo estaciones de Open Charge Map', async () => {
  let receivedCoordinates = null;
  const service = createRoutePlanningService({
    providers: providerFixture(),
    vehicles: [vehicle],
    stations: [], // el JSON local no aporta nada
    stationsSource: 'ocm',
    ocm: {
      fetchStationsAlongRoute: async (coordinates) => {
        receivedCoordinates = coordinates;
        return [{ ...station(), id: 'ocm_1', fuente: 'Open Charge Map', tarifa_CLPporKWh: null }];
      },
    },
  });
  const result = await service.plan(planInput);

  assert.equal(result.exito, true);
  assert.deepEqual(receivedCoordinates, [[0, 0], [2, 0]]);
  assert.equal(result.paradas[0].estacionId, 'ocm_1');
  assert.equal(result.paradas[0].fuente, 'Open Charge Map');
  assert.equal(result.resumen.costoIncompleto, true);
});

test('stationsSource "both" prefiere la estación local cuando hay duplicado cercano', async () => {
  const service = createRoutePlanningService({
    providers: providerFixture(),
    vehicles: [vehicle],
    stations: [station()],
    stationsSource: 'both',
    ocm: {
      fetchStationsAlongRoute: async () => [
        { ...station(), id: 'ocm_1', tarifa_CLPporKWh: null }, 
      ],
    },
  });
  const result = await service.plan(planInput);

  assert.equal(result.exito, true);
  assert.equal(result.paradas[0].estacionId, 'station-1');
  assert.notEqual(result.paradas[0].costo_CLP, null);
});

test('si Open Charge Map falla, usa las estaciones locales y agrega una advertencia', async () => {
  const service = createRoutePlanningService({
    providers: providerFixture(),
    vehicles: [vehicle],
    stations: [station()],
    stationsSource: 'both',
    ocm: { fetchStationsAlongRoute: async () => { throw new Error('API caída'); } },
  });
  const result = await service.plan(planInput);

  assert.equal(result.exito, true);
  assert.equal(result.paradas[0].estacionId, 'station-1');
  assert.ok(result.advertencias.some((w) => /Open Charge Map/i.test(w)));
});

test('cachea la consulta a Open Charge Map para la misma ruta', async () => {
  let calls = 0;
  const service = createRoutePlanningService({
    providers: providerFixture(),
    vehicles: [vehicle],
    stations: [],
    stationsSource: 'ocm',
    ocm: { fetchStationsAlongRoute: async () => { calls += 1; return [station()]; } },
  });
  await service.plan(planInput);
  await service.plan(planInput);

  assert.equal(calls, 1);
});