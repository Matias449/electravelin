/**
 * =============================================================================
 * routeController.js — Controlador del endpoint POST /api/calcular-ruta
 * =============================================================================
 *
 * Orquesta el flujo completo de cálculo:
 * 1. Validación de inputs (RF01-RF05).
 * 2. Búsqueda del vehículo en el catálogo (RF06).
 * 3. Resolución de la ruta mock entre origen y destino.
 * 4. Invocación del motor de batería (batteryService).
 * 5. Retorno de respuesta con paradas y resumen, o error (RF15).
 * =============================================================================
 */

const vehicles = require('../data/vehicles.json');
const stations = require('../data/stations.json');
const mockRoutes = require('../data/mockRoutes.json');
const {
  calcularRutaOptima,
} = require('../services/batteryService');

/**
 * Resuelve la secuencia de tramos entre dos ciudades a lo largo de la Ruta 5.
 * Como la red mock es lineal (Santiago → Puerto Montt), se busca el índice
 * de la ciudad origen y destino en el arreglo ordenado de ciudades y se
 * retornan los tramos intermedios. Soporta viajes en ambas direcciones.
 *
 * @param {string} origenId - ID de la ciudad de origen.
 * @param {string} destinoId - ID de la ciudad de destino.
 * @returns {{ exito: boolean, tramos?: Object[], error?: string }}
 */
function resolverTramos(origenId, destinoId) {
  const ciudades = mockRoutes.ciudades;
  const tramos = mockRoutes.tramos;

  const idxOrigen = ciudades.findIndex((c) => c.id === origenId);
  const idxDestino = ciudades.findIndex((c) => c.id === destinoId);

  if (idxOrigen === -1) {
    return { exito: false, error: `Ciudad de origen '${origenId}' no encontrada en la red de rutas.` };
  }
  if (idxDestino === -1) {
    return { exito: false, error: `Ciudad de destino '${destinoId}' no encontrada en la red de rutas.` };
  }
  if (idxOrigen === idxDestino) {
    return { exito: false, error: 'El origen y el destino son la misma ciudad.' };
  }

  // Determinar dirección del viaje
  const direccionSur = idxOrigen < idxDestino; // true = sur, false = norte

  const tramosSeleccionados = [];

  if (direccionSur) {
    // Viaje hacia el sur: recorrer tramos en orden
    for (let i = idxOrigen; i < idxDestino; i++) {
      const tramo = tramos.find(
        (t) => t.origenId === ciudades[i].id && t.destinoId === ciudades[i + 1].id
      );
      if (tramo) tramosSeleccionados.push(tramo);
    }
  } else {
    // Viaje hacia el norte: recorrer tramos en orden inverso
    for (let i = idxOrigen; i > idxDestino; i--) {
      const tramo = tramos.find(
        (t) => t.origenId === ciudades[i - 1].id && t.destinoId === ciudades[i].id
      );
      if (tramo) {
        // Invertir el tramo para reflejar la dirección norte
        tramosSeleccionados.push({
          ...tramo,
          origenId: tramo.destinoId,
          destinoId: tramo.origenId,
          descripcion: tramo.descripcion.replace('Sur', 'Norte'),
        });
      }
    }
  }

  if (tramosSeleccionados.length === 0) {
    return { exito: false, error: 'No se pudieron resolver tramos entre las ciudades indicadas.' };
  }

  return { exito: true, tramos: tramosSeleccionados };
}

/**
 * Handler principal: POST /api/calcular-ruta
 *
 * Body esperado (JSON):
 * {
 *   "origenId": "santiago",
 *   "destinoId": "puerto_montt",
 *   "vehiculoId": "tesla_model3_lr",
 *   "socInicial": 90
 * }
 */
async function calcularRuta(req, res) {
  try {
    const { origenId, destinoId, vehiculoId, socInicial } = req.body;

    // ─── Validación de inputs (RF01-RF05) ────────────────────────────────
    const erroresValidacion = [];

    if (!origenId || typeof origenId !== 'string') {
      erroresValidacion.push('El campo "origenId" es requerido y debe ser texto.');
    }
    if (!destinoId || typeof destinoId !== 'string') {
      erroresValidacion.push('El campo "destinoId" es requerido y debe ser texto.');
    }
    if (!vehiculoId || typeof vehiculoId !== 'string') {
      erroresValidacion.push('El campo "vehiculoId" es requerido y debe ser texto.');
    }
    if (socInicial === undefined || socInicial === null) {
      erroresValidacion.push('El campo "socInicial" es requerido.');
    } else if (typeof socInicial !== 'number' || socInicial < 0 || socInicial > 100) {
      erroresValidacion.push('El campo "socInicial" debe ser un número entre 0 y 100.');
    }

    if (erroresValidacion.length > 0) {
      return res.status(400).json({
        exito: false,
        error: 'Errores de validación',
        detalles: erroresValidacion,
      });
    }

    // ─── Buscar vehículo en catálogo (RF06) ──────────────────────────────
    const vehiculo = vehicles.find((v) => v.id === vehiculoId);
    if (!vehiculo) {
      return res.status(404).json({
        exito: false,
        error: `Vehículo con ID '${vehiculoId}' no encontrado en el catálogo.`,
      });
    }

    // ─── Resolver tramos de ruta (simulación cartográfica) ───────────────
    const resultadoTramos = resolverTramos(origenId, destinoId);
    if (!resultadoTramos.exito) {
      return res.status(400).json({
        exito: false,
        error: resultadoTramos.error,
      });
    }

    // ─── Invocar motor de batería (RN01-RN06) ───────────────────────────
    const resultado = calcularRutaOptima(
      vehiculo,
      resultadoTramos.tramos,
      stations,
      socInicial
    );

    if (!resultado.exito) {
      // (RF15) Ruta no factible: retornar error sin romper la UI
      return res.status(200).json({
        exito: false,
        error: resultado.error,
        paradas: resultado.paradas,
        resumen: null,
      });
    }

    // ─── Respuesta exitosa ───────────────────────────────────────────────
    // Incluir metadatos de la ruta para el frontend
    const ciudadesRuta = mockRoutes.ciudades.filter((c) => {
      const ids = [origenId, destinoId, ...resultadoTramos.tramos.map(t => t.origenId), ...resultadoTramos.tramos.map(t => t.destinoId)];
      return ids.includes(c.id);
    });

    return res.status(200).json({
      exito: true,
      vehiculo: {
        id: vehiculo.id,
        modelo: vehiculo.modelo,
        marca: vehiculo.marca,
        bateriaUtilizable_kWh: vehiculo.bateriaUtilizable_kWh,
      },
      origen: mockRoutes.ciudades.find((c) => c.id === origenId),
      destino: mockRoutes.ciudades.find((c) => c.id === destinoId),
      tramos: resultadoTramos.tramos,
      paradas: resultado.paradas,
      resumen: resultado.resumen,
      ciudadesRuta,
      error: null,
    });
  } catch (err) {
    console.error('[ERROR] calcularRuta:', err);
    return res.status(500).json({
      exito: false,
      error: 'Error interno del servidor. Por favor intente nuevamente.',
    });
  }
}

/**
 * Handler: GET /api/vehiculos
 * Retorna el catálogo completo de VE disponibles.
 */
function obtenerVehiculos(req, res) {
  return res.status(200).json({
    exito: true,
    vehiculos: vehicles,
  });
}

/**
 * Handler: GET /api/ciudades
 * Retorna la lista de ciudades disponibles para seleccionar como origen/destino.
 */
function obtenerCiudades(req, res) {
  return res.status(200).json({
    exito: true,
    ciudades: mockRoutes.ciudades,
  });
}

/**
 * Handler: GET /api/estaciones
 * Retorna la lista completa de estaciones de carga.
 */
function obtenerEstaciones(req, res) {
  return res.status(200).json({
    exito: true,
    estaciones: stations,
  });
}

module.exports = {
  calcularRuta,
  obtenerVehiculos,
  obtenerCiudades,
  obtenerEstaciones,
};
