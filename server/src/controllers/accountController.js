const { AuthError } = require('../services/authService');

/**
 * Controladores de cuenta: registro, login, perfil, historial y favoritos.
 */
function createAccountController({ authService, accountService, catalogService, auditService }) {
  function handleAuthError(res, error) {
    if (error instanceof AuthError) {
      return res.status(error.status).json({ exito: false, code: error.code, error: error.message });
    }
    throw error;
  }

  return {
    register(req, res) {
      try {
        const { nombre, email, password } = req.body || {};
        const result = authService.register({ nombre, email, password, rol: 'usuario' });
        auditService?.record({
          actorId: result.usuario.id,
          actorEmail: result.usuario.email,
          accion: 'registro',
          entidad: 'usuario',
          entidadId: result.usuario.id,
          requestId: req.requestId,
        });
        return res.status(201).json({ exito: true, ...result });
      } catch (error) {
        return handleAuthError(res, error);
      }
    },

    login(req, res) {
      try {
        const { email, password } = req.body || {};
        const result = authService.login({ email, password });
        auditService?.record({
          actorId: result.usuario.id,
          actorEmail: result.usuario.email,
          accion: 'login',
          entidad: 'usuario',
          entidadId: result.usuario.id,
          requestId: req.requestId,
        });
        return res.json({ exito: true, ...result });
      } catch (error) {
        return handleAuthError(res, error);
      }
    },

    me(req, res) {
      return res.json({ exito: true, usuario: req.user });
    },

    updateProfile(req, res) {
      try {
        const { nombre, vehiculoFavoritoId } = req.body || {};
        if (vehiculoFavoritoId !== undefined && vehiculoFavoritoId !== null) {
          const vehicle = catalogService.listVehicles({ incluirInactivos: true }).find((item) => item.id === vehiculoFavoritoId);
          if (!vehicle) {
            return res.status(400).json({ exito: false, code: 'VALIDATION_ERROR', error: `El vehículo '${vehiculoFavoritoId}' no existe en el catálogo.` });
          }
        }
        const usuario = authService.updateProfile(req.user.id, { nombre, vehiculoFavoritoId });
        return res.json({ exito: true, usuario });
      } catch (error) {
        return handleAuthError(res, error);
      }
    },

    listTrips(req, res) {
      return res.json({ exito: true, viajes: accountService.listTrips(req.user.id) });
    },

    getTrip(req, res) {
      const trip = accountService.getTrip(req.user.id, req.params.id);
      if (!trip) return res.status(404).json({ exito: false, code: 'NOT_FOUND', error: 'Viaje no encontrado.' });
      return res.json({ exito: true, viaje: trip });
    },

    saveTrip(req, res) {
      const result = accountService.saveTrip(req.user.id, req.body || {});
      if (result.error) {
        return res.status(result.error.status).json({ exito: false, code: 'VALIDATION_ERROR', error: result.error.mensaje, detalles: result.error.detalles });
      }
      return res.status(201).json({ exito: true, viaje: result.trip });
    },

    deleteTrip(req, res) {
      if (!accountService.deleteTrip(req.user.id, req.params.id)) {
        return res.status(404).json({ exito: false, code: 'NOT_FOUND', error: 'Viaje no encontrado.' });
      }
      return res.json({ exito: true });
    },

    listFavorites(req, res) {
      const favoritos = accountService.listFavorites(req.user.id).map((favorite) => {
        const collection = favorite.tipo === 'vehiculo' ? 'vehicles' : 'stations';
        const reference = catalogService[collection === 'vehicles' ? 'listVehicles' : 'listStations']({ incluirInactivos: true, incluirNoDisponibles: true })
          .find((item) => item.id === favorite.referenciaId);
        return { ...favorite, referencia: reference || null };
      });
      return res.json({ exito: true, favoritos });
    },

    addFavorite(req, res) {
      const result = accountService.addFavorite(req.user.id, req.body || {});
      if (result.error) {
        return res.status(result.error.status).json({ exito: false, code: 'VALIDATION_ERROR', error: result.error.mensaje, detalles: result.error.detalles });
      }
      return res.status(201).json({ exito: true, favorito: result.favorite });
    },

    removeFavorite(req, res) {
      if (!accountService.removeFavorite(req.user.id, req.params.id)) {
        return res.status(404).json({ exito: false, code: 'NOT_FOUND', error: 'Favorito no encontrado.' });
      }
      return res.json({ exito: true });
    },
  };
}

module.exports = { createAccountController };
