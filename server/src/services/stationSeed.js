const localStations = require('../data/stations.json');
const openChargeMap = require('./openChargeMapService');
const { mergeStations } = require('./routePlanningService');

// STATIONS_SEED_SOURCE: 'local' | 'ocm' | 'both'
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

module.exports = { loadSeedStations };