const mockRoutes = require('../data/mockRoutes.json');

/**
 * Ciudades disponibles para el selector de origen/destino. Se mantienen desde
 * el grafo mock de la Ruta 5; no dependen del catálogo editable.
 */
function createCityController() {
  return {
    listCities(req, res) {
      return res.json({ exito: true, ciudades: mockRoutes.ciudades });
    },
  };
}

module.exports = { createCityController };
