/**
 * Controladores del catálogo: consulta pública con filtros y CRUD administrativo.
 * Toda mutación administrativa queda registrada en auditoría.
 */
function createCatalogController({ catalogService, auditService, secConnectorService }) {
  function record(req, accion, entidad, entidadId, detalle = null) {
    auditService?.record({
      actorId: req.user?.id || null,
      actorEmail: req.user?.email || null,
      accion,
      entidad,
      entidadId,
      detalle,
      requestId: req.requestId,
    });
  }

  function respondMutation(res, status, result, key, resultKey, successMessage) {
    if (result.error) {
      return res.status(result.error.status).json({
        exito: false,
        code: 'VALIDATION_ERROR',
        error: result.error.mensaje,
        detalles: result.error.detalles,
      });
    }
    return res.status(status).json({ exito: true, [key]: result[resultKey], mensaje: successMessage });
  }

  return {
    listVehicles(req, res) {
      return res.json({ exito: true, vehiculos: catalogService.listVehicles(req.query) });
    },

    listStations(req, res) {
      return res.json({ exito: true, estaciones: catalogService.listStations(req.query) });
    },

    adminListVehicles(req, res) {
      return res.json({ exito: true, vehiculos: catalogService.listVehicles({ incluirInactivos: true }) });
    },

    adminListStations(req, res) {
      return res.json({ exito: true, estaciones: catalogService.listStations({ incluirNoDisponibles: true }) });
    },

    createVehicle(req, res) {
      const result = catalogService.createVehicle(req.body || {});
      if (!result.error) record(req, 'crear', 'vehiculo', result.vehicle.id, { modelo: result.vehicle.modelo });
      return respondMutation(res, 201, result, 'vehiculo', 'vehicle', 'Vehículo creado.');
    },

    updateVehicle(req, res) {
      const result = catalogService.updateVehicle(req.params.id, req.body || {});
      if (!result.error) record(req, 'actualizar', 'vehiculo', result.vehicle.id, { campos: Object.keys(req.body || {}) });
      return respondMutation(res, 200, result, 'vehiculo', 'vehicle', 'Vehículo actualizado.');
    },

    deactivateVehicle(req, res) {
      const result = catalogService.deactivateVehicle(req.params.id);
      if (!result.error) record(req, 'desactivar', 'vehiculo', result.vehicle.id);
      return respondMutation(res, 200, result, 'vehiculo', 'vehicle', 'Vehículo desactivado.');
    },

    createStation(req, res) {
      const result = catalogService.createStation(req.body || {});
      if (!result.error) record(req, 'crear', 'estacion', result.station.id, { nombre: result.station.nombre });
      return respondMutation(res, 201, result, 'estacion', 'station', 'Estación creada.');
    },

    updateStation(req, res) {
      const result = catalogService.updateStation(req.params.id, req.body || {});
      if (!result.error) record(req, 'actualizar', 'estacion', result.station.id, { campos: Object.keys(req.body || {}) });
      return respondMutation(res, 200, result, 'estacion', 'station', 'Estación actualizada.');
    },

    deactivateStation(req, res) {
      const result = catalogService.deactivateStation(req.params.id);
      if (!result.error) record(req, 'desactivar', 'estacion', result.station.id);
      return respondMutation(res, 200, result, 'estacion', 'station', 'Estación desactivada.');
    },

    listAudit(req, res) {
      return res.json({ exito: true, auditoria: auditService.list({ entidad: req.query.entidad, limit: req.query.limit }) });
    },

    getSecMetadata(req, res) {
      const metadata = secConnectorService?.getMetadata() || {
        fuente: 'SEC / EcoCarga (Chile)',
        fechaActualizacion: new Date().toISOString(),
        validos: catalogService.listStations({ incluirNoDisponibles: true }).length,
      };
      return res.json({ exito: true, metadata });
    },

    syncSecStations(req, res) {
      if (!secConnectorService) {
        return res.status(503).json({ exito: false, code: 'SERVICE_UNAVAILABLE', error: 'Conector SEC no configurado.' });
      }
      try {
        const rawStations = Array.isArray(req.body?.estaciones) ? req.body.estaciones : null;
        if (!rawStations) {
          return res.status(400).json({ exito: false, code: 'VALIDATION_ERROR', error: 'Se requiere una lista de estaciones en el campo "estaciones".' });
        }
        const result = secConnectorService.ingestSecStations(rawStations);
        record(req, 'sync_sec', 'estacion', null, result.metadata);
        return res.json({ exito: true, metadata: result.metadata });
      } catch (error) {
        return res.status(400).json({ exito: false, code: error.code || 'SEC_SYNC_FAILED', error: error.message, detalles: error.discarded || [] });
      }
    },
  };
}

module.exports = { createCatalogController };
