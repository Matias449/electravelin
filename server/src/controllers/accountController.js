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
    async register(req, res) {
      try {
        const { nombre, email, password } = req.body || {};
        const result = await authService.register({ nombre, email, password });
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

    async login(req, res) {
      try {
        const { email, password } = req.body || {};
        const result = await authService.login({ email, password });
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
          const vehicle = catalogService.listVehicles({ incluirInactivos: true, incluirPersonalizados: true }).find((item) => item.id === vehiculoFavoritoId);
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
        const reference = catalogService[collection === 'vehicles' ? 'listVehicles' : 'listStations']({ incluirInactivos: true, incluirNoDisponibles: true, incluirPersonalizados: true })
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

    listUserVehicles(req, res) {
      const vehiculos = accountService.listUserVehicles(req.user.id);
      return res.json({ exito: true, vehiculos });
    },

    createUserVehicle(req, res) {
      const result = accountService.createUserVehicle(req.user.id, req.body || {});
      if (result.error) {
        return res.status(result.error.status).json({
          exito: false,
          code: 'VALIDATION_ERROR',
          error: result.error.mensaje,
          detalles: result.error.detalles,
        });
      }
      if (req.body?.esHabitual) {
        try {
          authService.updateProfile(req.user.id, { vehiculoFavoritoId: result.vehicle.id });
        } catch {
          // Si falla actualizar perfil no bloquea la creación del auto
        }
      }
      auditService?.record({
        actorId: req.user.id,
        actorEmail: req.user.email,
        accion: 'crear_vehiculo_personalizado',
        entidad: 'vehiculo',
        entidadId: result.vehicle.id,
        detalle: { modelo: result.vehicle.modelo, marca: result.vehicle.marca },
        requestId: req.requestId,
      });
      return res.status(201).json({ exito: true, vehiculo: result.vehicle, mensaje: 'Vehículo guardado exitosamente.' });
    },

    updateUserVehicle(req, res) {
      const result = accountService.updateUserVehicle(req.user.id, req.params.id, req.body || {});
      if (result.error) {
        const code = result.error.status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR';
        return res.status(result.error.status).json({
          exito: false,
          code,
          error: result.error.mensaje,
          detalles: result.error.detalles,
        });
      }
      if (req.body?.esHabitual) {
        try {
          authService.updateProfile(req.user.id, { vehiculoFavoritoId: result.vehicle.id });
        } catch {}
      }
      auditService?.record({
        actorId: req.user.id,
        actorEmail: req.user.email,
        accion: 'actualizar_vehiculo_personalizado',
        entidad: 'vehiculo',
        entidadId: result.vehicle.id,
        detalle: { campos: Object.keys(req.body || {}) },
        requestId: req.requestId,
      });
      return res.json({ exito: true, vehiculo: result.vehicle, mensaje: 'Vehículo actualizado exitosamente.' });
    },

    deleteUserVehicle(req, res) {
      if (!accountService.deleteUserVehicle(req.user.id, req.params.id)) {
        return res.status(404).json({ exito: false, code: 'NOT_FOUND', error: 'Vehículo no encontrado o no pertenece a tu cuenta.' });
      }
      auditService?.record({
        actorId: req.user.id,
        actorEmail: req.user.email,
        accion: 'eliminar_vehiculo_personalizado',
        entidad: 'vehiculo',
        entidadId: req.params.id,
        requestId: req.requestId,
      });
      return res.json({ exito: true, mensaje: 'Vehículo eliminado con éxito.' });
    },
  };
}

module.exports = { createAccountController };
