const localStations = require('../data/stations.json');
const openChargeMap = require('./openChargeMapService');
const { mergeStations, haversineKm } = require('./routePlanningService');

const OCM_SOURCE = 'Open Charge Map';
const DUPLICATE_DISTANCE_KM = 0.1;

async function loadSeedStations({
  source = process.env.STATIONS_SEED_SOURCE || 'both',
  local = localStations,
  ocm = openChargeMap,
  logger = null,
} = {}) {
  if (source === 'local') return local;

  try {
    const remote = await ocm.fetchStationsChile();

    if (remote.length === 0) {
      logger?.warn('ocm_seed_vacio', { mensaje: 'Open Charge Map no devolvió estaciones; se usan las locales.' });
      return local;
    }

    logger?.info('ocm_seed_cargado', { cantidad: remote.length, source });
    return source === 'ocm' ? remote : mergeStations(local, remote);
  } catch (error) {
    logger?.warn('ocm_seed_fallido', { message: error.message });
    return local; // el servidor arranca igual
  }
}

function mergeOcmIntoCatalog(current, remote) {
  const now = new Date().toISOString();
  const result = current.map((station) => ({ ...station }));
  const indexById = new Map(result.map((station, index) => [station.id, index]));
  const nonOcm = result.filter((station) => station.fuente !== OCM_SOURCE);
  let added = 0;
  let updated = 0;

  for (const station of remote) {
    const index = indexById.get(station.id);

    if (index !== undefined) {
      const existing = result[index];
      if (existing.editadaManualmente || existing.verificada === true) continue;
      result[index] = { ...station, creadoEn: existing.creadoEn || now, actualizadoEn: now };
      updated += 1;
      continue;
    }

    const duplicatesManual = nonOcm.some(
      (manual) => haversineKm(manual, station) <= DUPLICATE_DISTANCE_KM
    );
    if (duplicatesManual) continue;

    result.push({ ...station, creadoEn: now, actualizadoEn: now });
    added += 1;
  }

  return { stations: result, added, updated };
}

async function refreshStationsFromOcm({ store, ocm = openChargeMap, logger = null }) {
  try {
    const remote = await ocm.fetchStationsChile();
    if (remote.length === 0) {
      logger?.warn('ocm_refresh_vacio', { mensaje: 'Open Charge Map no devolvió estaciones.' });
      return null;
    }
    const { stations, added, updated } = mergeOcmIntoCatalog(store.all('stations'), remote);
    store.replace('stations', stations);
    logger?.info('ocm_refresh_completo', { agregadas: added, actualizadas: updated, total: stations.length });
    return { added, updated };
  } catch (error) {
    logger?.warn('ocm_refresh_fallido', { message: error.message });
    return null;
  }
}

module.exports = { loadSeedStations, mergeOcmIntoCatalog, refreshStationsFromOcm };