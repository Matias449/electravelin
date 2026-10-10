const express = require('express');
const {
  crearCalcularRuta,
  crearPlanRoute,
} = require('../controllers/routeController');

function createRouteRoutes({ routePlanner, catalogController, cityController, logger } = {}) {
  const router = express.Router();

  // Endpoint v1, mantenido durante la migración de los clientes existentes.
  router.post('/calcular-ruta', crearCalcularRuta(logger));

  // Endpoint v2: Nominatim + OpenRouteService desde el backend.
  router.post('/routes/plan', crearPlanRoute(routePlanner, logger));

  // Catálogo público con filtros (marca, conector, ciudad, operador, potencia).
  router.get('/vehiculos', catalogController.listVehicles);
  router.get('/estaciones', catalogController.listStations);
  router.get('/estaciones/sec', catalogController.listLiveSecStations);
  router.get('/estaciones/fuente', catalogController.getSecMetadata);
  router.get('/ciudades', cityController.listCities);

  return router;
}

module.exports = createRouteRoutes;
