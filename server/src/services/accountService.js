/**
 * Historial de viajes y favoritos por usuario.
 * Los viajes guardan el resultado del planificador en el momento de la consulta.
 */
function createAccountService({ store } = {}) {
  if (!store) throw new Error('createAccountService requiere un store.');

  function listTrips(userId) {
    return store
      .filter('trips', (trip) => trip.userId === userId)
      .sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
  }

  function getTrip(userId, tripId) {
    const trip = store.findById('trips', tripId);
    return trip && trip.userId === userId ? trip : null;
  }

  function saveTrip(userId, payload) {
    const { origen, destino, vehiculoId, socInicial, resumen, paradas, geometry, advertencias } = payload || {};
    const errors = [];
    if (!origen || typeof origen !== 'string') errors.push('El campo "origen" es requerido.');
    if (!destino || typeof destino !== 'string') errors.push('El campo "destino" es requerido.');
    if (!vehiculoId || typeof vehiculoId !== 'string') errors.push('El campo "vehiculoId" es requerido.');
    if (!Number.isFinite(socInicial) || socInicial < 0 || socInicial > 100) errors.push('El campo "socInicial" debe ser un número entre 0 y 100.');
    if (!resumen || typeof resumen !== 'object') errors.push('El campo "resumen" es requerido.');
    if (errors.length) return { error: { status: 400, mensaje: 'Errores de validación', detalles: errors } };

    const trip = store.insert('trips', {
      userId,
      origen: origen.trim(),
      destino: destino.trim(),
      vehiculoId,
      socInicial,
      resumen,
      paradas: Array.isArray(paradas) ? paradas : [],
      geometry: geometry || null,
      advertencias: Array.isArray(advertencias) ? advertencias : [],
    });
    return { trip };
  }

  function deleteTrip(userId, tripId) {
    const trip = getTrip(userId, tripId);
    if (!trip) return false;
    return store.remove('trips', tripId);
  }

  function listFavorites(userId) {
    return store
      .filter('favorites', (favorite) => favorite.userId === userId)
      .sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
  }

  function addFavorite(userId, { tipo, referenciaId }) {
    if (!['vehiculo', 'estacion'].includes(tipo) || !referenciaId) {
      return { error: { status: 400, mensaje: 'Debes indicar tipo ("vehiculo" o "estacion") y referenciaId.', detalles: [] } };
    }
    const collection = tipo === 'vehiculo' ? 'vehicles' : 'stations';
    if (!store.findById(collection, referenciaId)) {
      return { error: { status: 404, mensaje: `No existe ${tipo} con id '${referenciaId}'.`, detalles: [] } };
    }
    const existing = store.find('favorites', (favorite) => favorite.userId === userId && favorite.tipo === tipo && favorite.referenciaId === referenciaId);
    if (existing) return { favorite: existing };
    return { favorite: store.insert('favorites', { userId, tipo, referenciaId }) };
  }

  function removeFavorite(userId, favoriteId) {
    const favorite = store.findById('favorites', favoriteId);
    if (!favorite || favorite.userId !== userId) return false;
    return store.remove('favorites', favoriteId);
  }

  return { listTrips, getTrip, saveTrip, deleteTrip, listFavorites, addFavorite, removeFavorite };
}

module.exports = { createAccountService };
