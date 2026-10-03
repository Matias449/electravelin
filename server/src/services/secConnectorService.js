/**
 * =============================================================================
 * secConnectorService.js — Conector y Normalizador de Datos SEC (EcoCarga)
 * =============================================================================
 *
 * Implementa los requerimientos:
 *   - RF07: Incorporación de electrolineras desde la fuente oficial SEC / EcoCarga.
 *   - RF08: Validación de datos (rango geográfico Chile, potencia > 0, exclusión
 *     de registros incompletos, tarifas desconocidas como null en vez de 0).
 *   - RF09: Normalización de conectores y unidades; deduplicación de estaciones
 *     conservando conectores distintos de una misma ubicación.
 *   - RF10: Registro de procedencia y fecha de actualización; persistencia
 *     atómica que conserva el último conjunto válido si la carga falla.
 *   - PR-014, PR-015, PR-016: Casos del Plan de Pruebas.
 * =============================================================================
 */

const CHILE_BOUNDS = {
  minLat: -56.0,
  maxLat: -17.5,
  minLon: -76.0,
  maxLon: -66.0,
};

const CONNECTOR_SYNONYMS = {
  'ccs2': 'CCS2',
  'ccs 2': 'CCS2',
  'combo 2': 'CCS2',
  'combo2': 'CCS2',
  'type 2 combo': 'CCS2',
  'combo css': 'CCS2',
  'chademo': 'CHAdeMO',
  'type 2': 'Type 2',
  'tipo 2': 'Type 2',
  'mennekes': 'Type 2',
  'type 1': 'Type 1',
  'tipo 1': 'Type 1',
  'j1772': 'Type 1',
  'gbt': 'GBT',
  'gb/t': 'GBT',
};

const ALLOWED_CONNECTORS = ['CCS2', 'CHAdeMO', 'Type 2'];

function normalizeConnector(name) {
  if (!name || typeof name !== 'string') return null;
  const key = name.trim().toLowerCase();
  const mapped = CONNECTOR_SYNONYMS[key];
  if (mapped && ALLOWED_CONNECTORS.includes(mapped)) return mapped;
  if (ALLOWED_CONNECTORS.includes(name.trim())) return name.trim();
  return null;
}

function parseCoordinate(value, min, max) {
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(num)) return null;
  if (num < min || num > max) return null;
  return Math.round(num * 10000) / 10000;
}

function parsePowerKw(value) {
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 10) / 10;
}

function parseTariff(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num);
}

function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Valida un registro crudo de estación SEC.
 * (RF08)
 */
function validateRawStation(raw) {
  const errors = [];
  if (!raw.nombre || typeof raw.nombre !== 'string' || !raw.nombre.trim()) {
    errors.push('Nombre es obligatorio');
  }
  if (!raw.operador || typeof raw.operador !== 'string' || !raw.operador.trim()) {
    errors.push('Operador es obligatorio');
  }

  const lat = parseCoordinate(raw.latitud, CHILE_BOUNDS.minLat, CHILE_BOUNDS.maxLat);
  const lon = parseCoordinate(raw.longitud, CHILE_BOUNDS.minLon, CHILE_BOUNDS.maxLon);
  if (lat === null) errors.push('Latitud fuera de los límites de Chile continental [-56.0, -17.5]');
  if (lon === null) errors.push('Longitud fuera de los límites de Chile continental [-76.0, -66.0]');

  const rawConnectors = Array.isArray(raw.conectores) ? raw.conectores : (raw.conector ? [raw.conector] : []);
  const normalizedConnectors = rawConnectors
    .map(normalizeConnector)
    .filter(Boolean);

  const uniqueConnectors = [...new Set(normalizedConnectors)];
  if (uniqueConnectors.length === 0) {
    errors.push('No contiene conectores válidos soportados (CCS2, CHAdeMO, Type 2)');
  }

  const power = parsePowerKw(raw.potenciaMaxima_kW ?? raw.potencia_kw ?? raw.potencia);
  if (power === null) {
    errors.push('Potencia debe ser un número positivo');
  }

  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? {
      nombre: raw.nombre.trim(),
      ciudad: raw.ciudad ? String(raw.ciudad).trim() : 'Chile',
      ciudadId: slugify(raw.ciudad || 'chile'),
      region: raw.region ? String(raw.region).trim() : null,
      operador: raw.operador.trim(),
      latitud: lat,
      longitud: lon,
      conectoresDisponibles: uniqueConnectors,
      potenciaMaxima_kW: power,
      tarifa_CLPporKWh: parseTariff(raw.tarifa_CLPporKWh ?? raw.tarifa),
      tipoTarifa: raw.tipoTarifa || 'CLP/kWh',
      disponible: raw.disponible !== false,
      verificada: Boolean(raw.verificada ?? true),
      fuente: 'SEC / EcoCarga',
    } : null,
  };
}

/**
 * Normaliza y deduplica un listado de estaciones SEC.
 * (RF08, RF09, PR-014, PR-015)
 *
 * Si dos registros corresponden a la misma estación (mismas coordenadas y operador),
 * fusiona los tipos de conector sin duplicarlos y conserva la potencia máxima mayor.
 */
function processSecStations(rawList) {
  if (!Array.isArray(rawList)) {
    throw new Error('La lista de estaciones SEC debe ser un arreglo.');
  }

  const validStations = [];
  const discarded = [];
  const stationMap = new Map();
  let duplicateCount = 0;

  for (let i = 0; i < rawList.length; i++) {
    const raw = rawList[i];
    const validation = validateRawStation(raw);
    if (!validation.valid) {
      discarded.push({ index: i, errors: validation.errors, raw });
      continue;
    }

    const item = validation.data;
    // Clave de unicidad por operador y coordenadas redondeadas a 3 decimales (~110m)
    const key = `${slugify(item.operador)}_${item.latitud.toFixed(3)}_${item.longitud.toFixed(3)}`;

    if (stationMap.has(key)) {
      duplicateCount++;
      const existing = stationMap.get(key);
      // Fusionar conectores
      const mergedConnectors = [...new Set([...existing.conectoresDisponibles, ...item.conectoresDisponibles])];
      existing.conectoresDisponibles = mergedConnectors;
      existing.potenciaMaxima_kW = Math.max(existing.potenciaMaxima_kW, item.potenciaMaxima_kW);
      if (existing.tarifa_CLPporKWh === null && item.tarifa_CLPporKWh !== null) {
        existing.tarifa_CLPporKWh = item.tarifa_CLPporKWh;
      }
    } else {
      const id = raw.id ? slugify(raw.id) : `sec_${slugify(item.ciudad)}_${slugify(item.operador)}_${validStations.length + 1}`;
      item.id = id;
      stationMap.set(key, item);
      validStations.push(item);
    }
  }

  const nowIso = new Date().toISOString();
  return {
    metadata: {
      fuente: 'SEC / EcoCarga (Chile)',
      fechaActualizacion: nowIso,
      totalProcesados: rawList.length,
      validos: validStations.length,
      descartados: discarded.length,
      duplicadosFusionados: duplicateCount,
    },
    stations: validStations,
    discarded,
  };
}

/**
 * Crea el servicio del conector SEC.
 * Maneja persistencia atómica (RF10):
 * Si la nueva carga falla o produce 0 estaciones válidas, el conjunto anterior no se pierde.
 */
function createSecConnectorService({ store, logger } = {}) {
  const SEC_METADATA_ID = 'sec_metadata';
  const defaultMetadata = {
    fuente: 'SEC / EcoCarga (Chile)',
    fechaActualizacion: new Date().toISOString(),
    totalProcesados: 17,
    validos: 17,
    descartados: 0,
    duplicadosFusionados: 0,
  };

  let latestMetadata = (store && typeof store.findById === 'function' && store.findById('meta', SEC_METADATA_ID)) || defaultMetadata;

  function getMetadata() {
    return latestMetadata;
  }

  function persistMetadata(metadata) {
    if (!store || typeof store.insert !== 'function' || typeof store.update !== 'function') return;
    if (store.findById('meta', SEC_METADATA_ID)) store.update('meta', SEC_METADATA_ID, metadata);
    else store.insert('meta', { id: SEC_METADATA_ID, ...metadata });
  }

  /**
   * Carga e ingesta atómica de estaciones en el store.
   * (RF10, PR-014)
   */
  function ingestSecStations(rawList) {
    const result = processSecStations(rawList);
    if (result.stations.length === 0 && rawList.length > 0) {
      const err = new Error('La carga de datos SEC no produjo ninguna estación válida.');
      err.code = 'SEC_IMPORT_FAILED';
      err.discarded = result.discarded;
      throw err;
    }

    if (store) {
      // Reemplazo atómico de estaciones de fuente SEC conservando personalizadas
      const existing = store.all('stations') || [];
      const nonSec = existing.filter((s) => s.fuente !== 'SEC / EcoCarga');
      const updatedList = [...nonSec, ...result.stations];
      store.replace('stations', updatedList);
    }

    latestMetadata = result.metadata;
    persistMetadata(result.metadata);
    logger?.info('sec_stations_ingested', latestMetadata);
    return result;
  }

  return {
    getMetadata,
    ingestSecStations,
    processSecStations,
    validateRawStation,
    normalizeConnector,
    CHILE_BOUNDS,
  };
}

module.exports = {
  createSecConnectorService,
  processSecStations,
  validateRawStation,
  normalizeConnector,
  CHILE_BOUNDS,
  ALLOWED_CONNECTORS,
};
