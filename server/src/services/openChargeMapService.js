// openChargeMapService.js
// const BASE_URL = process.env.OPEN_CHARGE_MAP_BASE_URL || 'https://api.openchargemap.io/v3/poi';
// const API_KEY = process.env.OPEN_CHARGE_MAP_API_KEY;

const REQUEST_TIMEOUT_MS = 15000;
const ROUTE_SAMPLE_KM = 40;
const SEARCH_RADIUS_KM = 35;
const ROUTE_BATCH_SIZE = 5;
const UNKNOWN_OPERATOR = '(Unknown Operator)';

function getConfig() {
  return {
    baseUrl: process.env.OPEN_CHARGE_MAP_BASE_URL || 'https://api.openchargemap.io/v3/poi',
    apiKey: process.env.OPEN_CHARGE_MAP_API_KEY,
  };
}

function mapConnector(title = '') {
  const value = String(title).toLowerCase();

  if (value.includes('ccs') && value.includes('type 1')) return 'CCS1';
  if (value.includes('ccs') || value.includes('combo')) return 'CCS2';
  if (value.includes('chademo')) return 'CHAdeMO';
  if (value.includes('type 2') || value.includes('mennekes')) return 'Type 2';
  if (value.includes('type 1') || value.includes('j1772')) return 'Type 1';
  if (value.includes('tesla') || value.includes('nacs')) return 'Tesla';

  return null;
}

function normalizeStation(poi) {
  const info = poi.AddressInfo || {};
  const connections = poi.Connections || [];

  const connectors = [
    ...new Set(
      connections
        .map((connection) => mapConnector(connection.ConnectionType?.Title))
        .filter(Boolean)
    ),
  ];

  const powerValues = connections
    .map((connection) => Number(connection.PowerKW))
    .filter((power) => Number.isFinite(power) && power > 0);

  const power = powerValues.length ? Math.max(...powerValues) : null;

  const operatorTitle = poi.OperatorInfo?.Title;
  const operador =
    !operatorTitle || operatorTitle === UNKNOWN_OPERATOR
      ? 'Operador desconocido'
      : operatorTitle;

  // No inventamos la tarifa ni la potencia si la API no las informa.
  return {
    id: `ocm_${poi.ID}`,
    nombre: info.Title || poi.Title || 'Estación de carga',
    ciudadId: null,
    ciudad: info.Town || info.City || 'Desconocida',
    region: info.StateOrProvince || '',
    operador,
    latitud: info.Latitude,
    longitud: info.Longitude,
    conectoresDisponibles: connectors,
    potenciaMaxima_kW: power,
    tarifa_CLPporKWh: null,
    tipoTarifa: null,
    disponible: poi.StatusType?.IsOperational !== false,
    verificada: false,
    fuente: 'Open Charge Map',
    fechaActualizacion: poi.DateLastStatusUpdate || null,
    costoInformado: poi.UsageCost || null, // está en la raíz del POI
  };
}

function hasValidCoordinates(station) {
  return Number.isFinite(station.latitud) && Number.isFinite(station.longitud);
}

function isComplete(station) {
  return (
    hasValidCoordinates(station) &&
    station.conectoresDisponibles.length > 0 &&
    station.potenciaMaxima_kW !== null
  );
}

async function requestStations(extraParams, { onlyComplete = true } = {}) {
  const { baseUrl, apiKey } = getConfig();

  if (!apiKey) {
    throw new Error('Falta configurar OPEN_CHARGE_MAP_API_KEY en el .env');
  }

  const params = new URLSearchParams({
    key: apiKey,
    output: 'json',
    countrycode: 'CL',
    // compact=false: necesitamos ConnectionType.Title, OperatorInfo y StatusType
    // completos; con compact=true la API solo entrega IDs.
    compact: 'false',
    verbose: 'false',
    ...extraParams,
  });

  const response = await fetch(`${baseUrl}?${params}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Open Charge Map respondió HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error('Respuesta inválida de Open Charge Map');
  }

  return data
    .map(normalizeStation)
    .filter(onlyComplete ? isComplete : hasValidCoordinates);
}

async function fetchStationsNear(latitude, longitude, options) {
  return requestStations(
    {
      latitude: String(latitude),
      longitude: String(longitude),
      distance: String(SEARCH_RADIUS_KM),
      distanceunit: 'KM',
      maxresults: '100',
    },
    options
  );
}

function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const lat1 = a[1] * rad;
  const lat2 = b[1] * rad;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// coordinates: arreglo de [longitud, latitud]
function sampleRoutePoints(coordinates, stepKm = ROUTE_SAMPLE_KM) {
  const points = [coordinates[0]];
  let accumulated = 0;
  let nextSearchKm = stepKm;

  for (let i = 1; i < coordinates.length; i++) {
    accumulated += distanceKm(coordinates[i - 1], coordinates[i]);

    if (accumulated >= nextSearchKm) {
      points.push(coordinates[i]);
      nextSearchKm = accumulated + stepKm;
    }
  }

  // Aseguramos incluir el destino.
  const last = coordinates[coordinates.length - 1];
  if (coordinates.length > 1 && points[points.length - 1] !== last) {
    points.push(last);
  }

  return points;
}

async function fetchStationsAlongRoute(coordinates, options) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) return [];

  const points = sampleRoutePoints(coordinates);
  const unique = new Map();
  let failures = 0;
  let lastError = null;

  // Lotes pequeños para no saturar la API ni superar sus límites.
  for (let i = 0; i < points.length; i += ROUTE_BATCH_SIZE) {
    const batch = points.slice(i, i + ROUTE_BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(([longitude, latitude]) =>
        fetchStationsNear(latitude, longitude, options)
      )
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        for (const station of result.value) unique.set(station.id, station);
      } else {
        failures++;
        lastError = result.reason;
      }
    }
  }

  // Solo fallamos si no se pudo consultar ningún punto.
  if (failures === points.length) {
    throw lastError || new Error('No se pudo consultar Open Charge Map');
  }

  return [...unique.values()];
}

async function fetchStationsChile(options) {
  return requestStations({ maxresults: '1000' }, options);
}

module.exports = {
  fetchStationsNear,
  fetchStationsAlongRoute,
  fetchStationsChile,
  normalizeStation,
  mapConnector,
};