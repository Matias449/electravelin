const crypto = require('crypto');
const { validateVehicleInput, toNumber, slugify } = require('./catalogService');

/**
 * Historial de viajes, favoritos y vehículos personalizados por usuario.
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

  function listUserVehicles(userId) {
    return store
      .filter('vehicles', (vehicle) => vehicle.userId === userId && vehicle.esPersonalizado === true && vehicle.activo !== false)
      .sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
  }

  function getUserVehicle(userId, vehicleId) {
    const vehicle = store.findById('vehicles', vehicleId);
    return vehicle && vehicle.userId === userId && vehicle.esPersonalizado === true ? vehicle : null;
  }

  function createUserVehicle(userId, body) {
    const errors = validateVehicleInput(body);
    if (errors.length) return { error: { status: 400, mensaje: 'Errores de validación', detalles: errors } };

    const marcaTrim = String(body.marca).trim();
    const modeloTrim = String(body.modelo).trim();
    const shortId = crypto.randomUUID().slice(0, 8);
    const id = `user_${slugify(marcaTrim)}_${slugify(modeloTrim)}_${shortId}`;

    const vehicle = store.insert('vehicles', {
      id,
      modelo: modeloTrim,
      marca: marcaTrim,
      bateriaUtilizable_kWh: toNumber(body.bateriaUtilizable_kWh),
      consumoReferencia_kWhPor100km: toNumber(body.consumoReferencia_kWhPor100km),
      potenciaCargaMaxima_kW: toNumber(body.potenciaCargaMaxima_kW),
      conectoresCompatibles: body.conectoresCompatibles,
      imagenUrl: body.imagenUrl ? String(body.imagenUrl).trim() : null,
      activo: true,
      esPersonalizado: true,
      userId,
    });
    return { vehicle };
  }

  function updateUserVehicle(userId, vehicleId, body) {
    const existing = getUserVehicle(userId, vehicleId);
    if (!existing) {
      return { error: { status: 404, mensaje: `Vehículo '${vehicleId}' no encontrado o no pertenece a tu cuenta.`, detalles: [] } };
    }
    const errors = validateVehicleInput(body, { partial: true });
    if (errors.length) return { error: { status: 400, mensaje: 'Errores de validación', detalles: errors } };

    const patch = {};
    if (body.modelo !== undefined) patch.modelo = String(body.modelo).trim();
    if (body.marca !== undefined) patch.marca = String(body.marca).trim();
    if (body.imagenUrl !== undefined) patch.imagenUrl = body.imagenUrl ? String(body.imagenUrl).trim() : null;
    if (body.bateriaUtilizable_kWh !== undefined) patch.bateriaUtilizable_kWh = toNumber(body.bateriaUtilizable_kWh);
    if (body.consumoReferencia_kWhPor100km !== undefined) patch.consumoReferencia_kWhPor100km = toNumber(body.consumoReferencia_kWhPor100km);
    if (body.potenciaCargaMaxima_kW !== undefined) patch.potenciaCargaMaxima_kW = toNumber(body.potenciaCargaMaxima_kW);
    if (body.conectoresCompatibles !== undefined) patch.conectoresCompatibles = body.conectoresCompatibles;

    const updated = store.update('vehicles', vehicleId, patch);
    return { vehicle: updated };
  }

  function deleteUserVehicle(userId, vehicleId) {
    const existing = getUserVehicle(userId, vehicleId);
    if (!existing) return false;
    store.remove('vehicles', vehicleId);

    const user = store.findById('users', userId);
    if (user && user.vehiculoFavoritoId === vehicleId) {
      store.update('users', userId, { vehiculoFavoritoId: null });
    }
    const favorites = store.filter('favorites', (f) => f.userId === userId && f.referenciaId === vehicleId);
    for (const fav of favorites) {
      store.remove('favorites', fav.id);
    }
    return true;
  }

  return {
    listTrips,
    getTrip,
    saveTrip,
    deleteTrip,
    listFavorites,
    addFavorite,
    removeFavorite,
    listUserVehicles,
    getUserVehicle,
    createUserVehicle,
    updateUserVehicle,
    deleteUserVehicle,
  };
}

module.exports = { createAccountService };
