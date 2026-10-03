const express = require('express');

function createAdminRoutes({ catalogController, authMiddleware }) {
  const router = express.Router();

  router.use(authMiddleware.requireAdmin);

  router.get('/vehiculos', catalogController.adminListVehicles);
  router.post('/vehiculos', catalogController.createVehicle);
  router.put('/vehiculos/:id', catalogController.updateVehicle);
  router.delete('/vehiculos/:id', catalogController.deactivateVehicle);

  router.get('/estaciones', catalogController.adminListStations);
  router.post('/estaciones', catalogController.createStation);
  router.put('/estaciones/:id', catalogController.updateStation);
  router.delete('/estaciones/:id', catalogController.deactivateStation);
  router.get('/estaciones/sec-metadata', catalogController.getSecMetadata);
  router.post('/estaciones/sync-sec', catalogController.syncSecStations);

  router.get('/auditoria', catalogController.listAudit);

  return router;
}

module.exports = { createAdminRoutes };
