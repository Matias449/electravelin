/**
 * =============================================================================
 * batteryService.js — Motor de Cálculo Determinista de Batería (Electravelin)
 * =============================================================================
 *
 * Implementa las reglas de negocio RN01–RN06 para la simulación del consumo
 * energético de un VE a lo largo de una ruta interurbana en Chile.
 *
 * Constantes clave:
 *   - RESERVA_SOC_MIN (RN02): 15% — El SoC nunca debe caer bajo este umbral.
 *   - OBJETIVO_CARGA_MAX (RN04): 80% — Se recarga hasta 80% por defecto,
 *     a menos que el tramo siguiente exija más.
 *
 * Fórmulas deterministas:
 *   (RN01) Energía Consumida (kWh) = distancia_km × (consumoRef / 100)
 *   (RN01) SoC Llegada (%) = SoC Salida (%) − (Energía Consumida / Capacidad) × 100
 *   (RN05) Energía a Cargar (kWh) = Capacidad × ((SoC_salida − SoC_llegada) / 100)
 *   (RN05) Tiempo de Carga (min) = (Energía a Cargar / Potencia Efectiva) × 60
 *   (RN06) Costo Carga (CLP) = Energía a Cargar × Tarifa (CLP/kWh)
 * =============================================================================
 */

const RESERVA_SOC_MIN = 15;   // RN02: SoC mínimo de seguridad (%)
const OBJETIVO_CARGA_MAX = 80; // RN04: Objetivo de carga preferido (%)

/**
 * Calcula la energía consumida en un tramo dado.
 * (RN01) Energía Consumida (kWh) = distancia_km × (consumoReferencia / 100)
 *
 * @param {number} distancia_km - Distancia del tramo en kilómetros.
 * @param {number} consumoRef_kWhPor100km - Consumo de referencia del VE (kWh/100km).
 * @returns {number} Energía consumida en kWh.
 */
function calcularEnergiaConsumida(distancia_km, consumoRef_kWhPor100km) {
  return distancia_km * (consumoRef_kWhPor100km / 100);
}

/**
 * Calcula el SoC de llegada a un punto tras recorrer un tramo.
 * (RN01) SoC Llegada (%) = SoC Salida (%) − (Energía Consumida / Capacidad Batería) × 100
 *
 * @param {number} socSalida - Estado de carga al inicio del tramo (%).
 * @param {number} energiaConsumida_kWh - Energía consumida en el tramo (kWh).
 * @param {number} capacidadBateria_kWh - Capacidad útil de la batería del VE (kWh).
 * @returns {number} Estado de carga de llegada (%).
 */
function calcularSoCLlegada(socSalida, energiaConsumida_kWh, capacidadBateria_kWh) {
  const socConsumido = (energiaConsumida_kWh / capacidadBateria_kWh) * 100;
  return socSalida - socConsumido;
}

/**
 * Calcula los parámetros de una parada de recarga.
 * (RN05) Energía a cargar = Capacidad × ((SoC_objetivo − SoC_actual) / 100)
 * (RN05) Tiempo de carga (min) = (Energía a cargar / Potencia Efectiva) × 60
 *         donde Potencia Efectiva = min(potencia cargador, potencia VE)
 * (RN06) Costo (CLP) = Energía a cargar × Tarifa (CLP/kWh)
 *
 * @param {number} socActual - SoC actual del VE al llegar a la estación (%).
 * @param {number} socObjetivo - SoC deseado al salir de la estación (%).
 * @param {number} capacidadBateria_kWh - Capacidad útil de la batería (kWh).
 * @param {number} potenciaCargador_kW - Potencia máxima de la estación (kW).
 * @param {number} potenciaVE_kW - Potencia máxima de carga que soporta el VE (kW).
 * @param {number} tarifa_CLPporKWh - Tarifa de la estación (CLP/kWh).
 * @returns {{ energiaCargada_kWh: number, tiempoCarga_min: number, costo_CLP: number }}
 */
function calcularRecarga(
  socActual,
  socObjetivo,
  capacidadBateria_kWh,
  potenciaCargador_kW,
  potenciaVE_kW,
  tarifa_CLPporKWh
) {
  // (RN05) Energía a cargar
  const energiaCargada_kWh =
    capacidadBateria_kWh * ((socObjetivo - socActual) / 100);

  // Potencia efectiva: la menor entre cargador y vehículo
  const potenciaEfectiva_kW = Math.min(potenciaCargador_kW, potenciaVE_kW);

  // (RN05) Tiempo de carga en minutos
  const tiempoCarga_min = (energiaCargada_kWh / potenciaEfectiva_kW) * 60;

  // (RN06) Costo de la recarga: si la tarifa no está disponible o no es finita, se conserva como null (RF08, RN06)
  const costo_CLP = tarifa_CLPporKWh != null && Number.isFinite(tarifa_CLPporKWh)
    ? Math.round(energiaCargada_kWh * tarifa_CLPporKWh)
    : null;

  return {
    energiaCargada_kWh: Math.round(energiaCargada_kWh * 100) / 100,
    tiempoCarga_min: Math.round(tiempoCarga_min),
    costo_CLP,
  };
}

/**
 * Verifica si un conector del VE es compatible con los conectores de la estación.
 *
 * @param {string[]} conectoresVE - Lista de conectores que soporta el VE.
 * @param {string[]} conectoresEstacion - Lista de conectores disponibles en la estación.
 * @returns {string|null} El primer conector compatible encontrado, o null.
 */
function encontrarConectorCompatible(conectoresVE, conectoresEstacion) {
  for (const conector of conectoresVE) {
    if (conectoresEstacion.includes(conector)) {
      return conector;
    }
  }
  return null;
}

/**
 * Motor principal de ruteo: simula el viaje tramo a tramo e inserta paradas
 * de recarga cuando el SoC proyectado caería bajo la reserva mínima (RN02).
 *
 * Algoritmo:
 * 1. Se recorre la secuencia de tramos entre origen y destino.
 * 2. Para cada tramo, se calcula la energía consumida (RN01) y el SoC de llegada.
 * 3. Si el SoC de llegada < RESERVA_SOC_MIN (15%):
 *    a. Se busca la estación en la ciudad de origen del tramo.
 *    b. Se verifica compatibilidad de conectores.
 *    c. Se calcula el SoC objetivo: max(80%, lo mínimo para completar el tramo con reserva).
 *    d. Se calculan energía, tiempo y costo de recarga (RN05, RN06).
 *    e. Se inserta la parada de recarga.
 * 4. Si incluso al 100% no se puede completar un tramo, se retorna error (RF15).
 *
 * @param {Object} vehiculo - Objeto del catálogo de vehículos.
 * @param {Object[]} tramos - Secuencia de tramos a recorrer.
 * @param {Object[]} estaciones - Lista completa de estaciones.
 * @param {number} socInicial - Porcentaje de batería al inicio del viaje (0-100).
 * @returns {{ exito: boolean, paradas: Object[], resumen: Object, error?: string }}
 */
function calcularRutaOptima(vehiculo, tramos, estaciones, socInicial) {
  let socActual = socInicial;
  const paradas = [];
  let tiempoConduccionTotal_min = 0;
  let tiempoCargaTotal_min = 0;
  let costoTotal_CLP = 0;
  let distanciaTotal_km = 0;

  for (let i = 0; i < tramos.length; i++) {
    const tramo = tramos[i];

    // (RN01) Calcular energía consumida en este tramo
    const energiaConsumida = calcularEnergiaConsumida(
      tramo.distancia_km,
      vehiculo.consumoReferencia_kWhPor100km
    );

    // (RN01) Calcular SoC de llegada proyectado
    const socLlegadaProyectado = calcularSoCLlegada(
      socActual,
      energiaConsumida,
      vehiculo.bateriaUtilizable_kWh
    );

    // (RN02) Verificar si el SoC caería bajo la reserva mínima
    if (socLlegadaProyectado < RESERVA_SOC_MIN) {
      // Se necesita cargar ANTES de este tramo.
      // Buscar la estación en la ciudad de ORIGEN del tramo actual.
      const estacion = estaciones.find(
        (e) => e.ciudadId === tramo.origenId && e.disponible
      );

      if (!estacion) {
        return {
          exito: false,
          paradas,
          resumen: null,
          error: `No se encontró estación de carga disponible en ${tramo.origenId}. La ruta no es factible.`,
        };
      }

      // Verificar compatibilidad de conectores
      const conectorCompatible = encontrarConectorCompatible(
        vehiculo.conectoresCompatibles,
        estacion.conectoresDisponibles
      );

      if (!conectorCompatible) {
        return {
          exito: false,
          paradas,
          resumen: null,
          error: `No hay conector compatible entre ${vehiculo.modelo} (${vehiculo.conectoresCompatibles.join(', ')}) y la estación ${estacion.nombre} (${estacion.conectoresDisponibles.join(', ')}). La ruta no es factible.`,
        };
      }

      // (RN04) Calcular SoC objetivo de carga:
      // El mínimo necesario para completar el tramo con reserva de 15%
      const socNecesarioMinimo =
        (energiaConsumida / vehiculo.bateriaUtilizable_kWh) * 100 +
        RESERVA_SOC_MIN;

      // Intentar cargar al 80%, pero si necesitamos más, subir hasta 100%
      let socObjetivo = Math.max(OBJETIVO_CARGA_MAX, socNecesarioMinimo);

      if (socObjetivo > 100) {
        // (RF15) Incluso al 100% no alcanza para el tramo
        return {
          exito: false,
          paradas,
          resumen: null,
          error: `El tramo "${tramo.descripcion}" (${tramo.distancia_km} km) excede la autonomía máxima del ${vehiculo.modelo} incluso con batería al 100%. La ruta no es factible.`,
        };
      }

      // Solo cargar si el SoC objetivo es mayor que el actual
      if (socObjetivo > socActual) {
        // (RN05, RN06) Calcular recarga
        const recarga = calcularRecarga(
          socActual,
          socObjetivo,
          vehiculo.bateriaUtilizable_kWh,
          estacion.potenciaMaxima_kW,
          vehiculo.potenciaCargaMaxima_kW,
          estacion.tarifa_CLPporKWh
        );

        paradas.push({
          orden: paradas.length + 1,
          estacionId: estacion.id,
          estacionNombre: estacion.nombre,
          ciudad: estacion.ciudad,
          operador: estacion.operador,
          conectorUsado: conectorCompatible,
          potenciaEfectiva_kW: Math.min(
            estacion.potenciaMaxima_kW,
            vehiculo.potenciaCargaMaxima_kW
          ),
          socLlegada: Math.round(socActual * 100) / 100,
          socSalida: Math.round(socObjetivo * 100) / 100,
          energiaCargada_kWh: recarga.energiaCargada_kWh,
          tiempoCarga_min: recarga.tiempoCarga_min,
          costo_CLP: recarga.costo_CLP,
          latitud: estacion.latitud,
          longitud: estacion.longitud,
          fuente: estacion.fuente || 'SEC / EcoCarga',
          fechaActualizacion: estacion.fechaActualizacion || '2026-10-02',
        });

        tiempoCargaTotal_min += recarga.tiempoCarga_min;
        if (recarga.costo_CLP != null) {
          costoTotal_CLP += recarga.costo_CLP;
        }

        // Actualizar SoC después de cargar
        socActual = socObjetivo;
      }
    }

    // Avanzar el tramo: actualizar SoC y acumuladores
    const energiaReal = calcularEnergiaConsumida(
      tramo.distancia_km,
      vehiculo.consumoReferencia_kWhPor100km
    );
    socActual = calcularSoCLlegada(
      socActual,
      energiaReal,
      vehiculo.bateriaUtilizable_kWh
    );
    tiempoConduccionTotal_min += tramo.tiempoBase_min;
    distanciaTotal_km += tramo.distancia_km;
  }

  // Construir resumen global
  const resumen = {
    distanciaTotal_km,
    tiempoConduccionTotal_min,
    tiempoCargaTotal_min,
    tiempoTotalViaje_min: tiempoConduccionTotal_min + tiempoCargaTotal_min,
    costoTotal_CLP: costoTotal_CLP,
    socFinal: Math.round(socActual * 100) / 100,
    cantidadParadas: paradas.length,
    vehiculoUsado: vehiculo.modelo,
  };

  return {
    exito: true,
    paradas,
    resumen,
    error: null,
  };
}

module.exports = {
  RESERVA_SOC_MIN,
  OBJETIVO_CARGA_MAX,
  calcularEnergiaConsumida,
  calcularSoCLlegada,
  calcularRecarga,
  encontrarConectorCompatible,
  calcularRutaOptima,
};
