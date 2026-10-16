process.env.OPEN_CHARGE_MAP_API_KEY = 'clave-de-prueba';

const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../src/services/openChargeMapService');

const poiEjemplo = {
  ID: 123,
  Title: 'Estación Demo',
  UsageCost: '$200/kWh', // en la raíz
  AddressInfo: {
    Title: 'Mall Demo',
    Town: 'Santiago',
    StateOrProvince: 'Región Metropolitana',
    Latitude: -33.45,
    Longitude: -70.66,
  },
  OperatorInfo: { Title: 'Copec Voltex' },
  StatusType: { IsOperational: true },
  Connections: [
    { ConnectionType: { Title: 'CCS (Type 2)' }, PowerKW: 60 },
    { ConnectionType: { Title: 'Type 2 (Socket Only)' }, PowerKW: 22 },
    { ConnectionType: { Title: 'Algo raro' }, PowerKW: 7 },
  ],
};

test('mapConnector distingue CCS1 y CCS2', () => {
  assert.strictEqual(service.mapConnector('CCS (Type 1)'), 'CCS1');
  assert.strictEqual(service.mapConnector('CCS (Type 2)'), 'CCS2');
});

test('operador desconocido se normaliza', () => {
  const s = service.normalizeStation({
    ID: 3,
    OperatorInfo: { Title: '(Unknown Operator)' },
  });
  assert.strictEqual(s.operador, 'Operador desconocido');
});

test('costoInformado se lee de la raíz', () => {
  const s = service.normalizeStation(poiEjemplo);
  assert.strictEqual(s.costoInformado, '$200/kWh');
});

test('la URL pide datos completos (compact=false)', async () => {
  let urlLlamada = '';
  globalThis.fetch = async (url) => {
    urlLlamada = String(url);
    return { ok: true, json: async () => [] };
  };
  await service.fetchStationsNear(-33.45, -70.66);
  assert.match(urlLlamada, /compact=false/);
});

test('normalizeStation mapea campos básicos', () => {
  const s = service.normalizeStation(poiEjemplo);
  assert.strictEqual(s.id, 'ocm_123');
  assert.strictEqual(s.ciudad, 'Santiago');
  assert.strictEqual(s.operador, 'Copec Voltex');
  assert.strictEqual(s.potenciaMaxima_kW, 60);
  assert.deepStrictEqual(s.conectoresDisponibles.sort(), ['CCS2', 'Type 2']);
  assert.strictEqual(s.tarifa_CLPporKWh, null);
  assert.strictEqual(s.disponible, true);
});

test('normalizeStation tolera datos faltantes', () => {
  const s = service.normalizeStation({ ID: 1 });
  assert.strictEqual(s.nombre, 'Estación de carga');
  assert.strictEqual(s.operador, 'Operador desconocido');
  assert.strictEqual(s.potenciaMaxima_kW, null);
  assert.deepStrictEqual(s.conectoresDisponibles, []);
});

test('disponible es false solo si la API lo dice', () => {
  const s = service.normalizeStation({ ID: 2, StatusType: { IsOperational: false } });
  assert.strictEqual(s.disponible, false);
});

test('fetchStationsNear filtra estaciones incompletas', async () => {
  globalThis.fetch = async (url) => {
    // Verifica que se armó bien la URL
    assert.match(String(url), /latitude=-33\.45/);
    assert.match(String(url), /countrycode=CL/);
    return {
      ok: true,
      json: async () => [
        poiEjemplo,
        { ID: 999, AddressInfo: { Latitude: -33, Longitude: -70 }, Connections: [] }, // sin conectores
      ],
    };
  };

  const result = await service.fetchStationsNear(-33.45, -70.66);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].id, 'ocm_123');
});

test('fetchStationsNear lanza error si HTTP falla', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 503 });
  await assert.rejects(() => service.fetchStationsNear(0, 0), /HTTP 503/);
});

test('fetchStationsAlongRoute devuelve parcial si algunos puntos fallan', async () => {
  let llamadas = 0;
  globalThis.fetch = async () => {
    llamadas++;
    if (llamadas === 1) return { ok: false, status: 500 };
    return { ok: true, json: async () => [poiEjemplo] };
  };
  const ruta = [[-70.66, -33.45], [-70.5, -33.0], [-70.3, -32.5]]; // [lon, lat]
  const result = await service.fetchStationsAlongRoute(ruta);
  assert.ok(result.length >= 1);
});