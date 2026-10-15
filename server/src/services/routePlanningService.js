const { calcularRecarga, encontrarConectorCompatible, RESERVA_SOC_MIN, OBJETIVO_CARGA_MAX } = require('./batteryService');
const { createRoutingProviders, RoutingProviderError } = require('./routingProviders');
const defaultVehicles = require('../data/vehicles.json');
const defaultStations = require('../data/stations.json');
const defaultCities = require('../data/mockRoutes.json').ciudades;

const ROUTE_CORRIDOR_KM = 35;
const ORIGIN_STATION_RADIUS_KM = 8;
const ROUND = (value, decimals = 2) => Math.round(value * (10 ** decimals)) / (10 ** decimals);

function haversineKm(a, b) {
  const toRad = Math.PI / 180;
  const dLat = (b.latitud - a.latitud) * toRad;
  const dLon = (b.longitud - a.longitud) * toRad;
  const lat1 = a.latitud * toRad;
  const lat2 = b.latitud * toRad;
  const part = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(part), Math.sqrt(1 - part));
}

function projectStationOnRoute(station, coordinates) {
  let accumulatedKm = 0;
  let best = { distanceKm: Infinity, progressKm: 0 };
  const point = { latitud: station.latitud, longitud: station.longitud };

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const start = { longitud: coordinates[index][0], latitud: coordinates[index][1] };
    const end = { longitud: coordinates[index + 1][0], latitud: coordinates[index + 1][1] };
    const segmentKm = haversineKm(start, end);
    const latitudeScale = 111.32;
    const longitudeScale = latitudeScale * Math.cos(((start.latitud + end.latitud) / 2) * Math.PI / 180);
    const vx = (end.longitud - start.longitud) * longitudeScale;
    const vy = (end.latitud - start.latitud) * latitudeScale;
    const wx = (point.longitud - start.longitud) * longitudeScale;
    const wy = (point.latitud - start.latitud) * latitudeScale;
    const denominator = vx ** 2 + vy ** 2;
    const factor = denominator === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / denominator));
    const projected = {
      latitud: start.latitud + factor * (end.latitud - start.latitud),
      longitud: start.longitud + factor * (end.longitud - start.longitud),
    };
    const distanceKm = haversineKm(point, projected);

    if (distanceKm < best.distanceKm) {
      best = { distanceKm, progressKm: accumulatedKm + segmentKm * factor };
    }
    accumulatedKm += segmentKm;
  }
  return best;
}

function buildCandidateStations({ stations, vehicle, coordinates, totalDistanceKm }) {
  return stations
    .filter((station) => station.disponible)
    .map((station) => ({
      ...station,
      compatibleConnector: encontrarConectorCompatible(vehicle.conectoresCompatibles, station.conectoresDisponibles),
      route: projectStationOnRoute(station, coordinates),
    }))
    .filter((station) => station.compatibleConnector && station.route.distanceKm <= ROUTE_CORRIDOR_KM)
    .filter((station) => station.route.progressKm > 1 && station.route.progressKm < totalDistanceKm - 1)
    .sort((a, b) => a.route.progressKm - b.route.progressKm);
}

function buildOriginStations({ stations, vehicle, origin }) {
  return stations
    .filter((station) => station.disponible)
    .map((station) => ({
      ...station,
      compatibleConnector: encontrarConectorCompatible(vehicle.conectoresCompatibles, station.conectoresDisponibles),
      distanceFromOriginKm: haversineKm(origin, station),
    }))
    .filter((station) => station.compatibleConnector && station.distanceFromOriginKm <= ORIGIN_STATION_RADIUS_KM)
    .sort((a, b) => a.distanceFromOriginKm - b.distanceFromOriginKm);
}

function formatStation(station, extra = {}) {
  return {
    estacionId: station.id,
    estacionNombre: station.nombre,
    ciudad: station.ciudad,
    operador: station.operador,
    conectorUsado: station.compatibleConnector,
    potenciaEfectiva_kW: extra.potenciaEfectiva_kW,
    socLlegada: ROUND(extra.socLlegada),
    socSalida: ROUND(extra.socSalida),
    energiaCargada_kWh: extra.recarga?.energiaCargada_kWh,
    tiempoCarga_min: extra.recarga?.tiempoCarga_min,
    costo_CLP: extra.recarga?.costo_CLP ?? null,
    latitud: station.latitud,
    longitud: station.longitud,
    distanciaAlTrazado_km: ROUND(extra.distanciaAlTrazadoKm ?? station.route?.distanceKm ?? station.distanceFromOriginKm ?? 0),
    esCargaInicial: Boolean(extra.esCargaInicial),
    fuente: station.fuente || 'SEC EcoCarga',
    fechaActualizacion: station.fechaActualizacion || station.ultimaActualizacion || station.fechaRevision || '02/10/2026',
  };
}

function calculateChargingPlan({ vehicle, stations, originStations = [], totalDistanceKm, drivingMinutes, socInicial }) {
  const energyPerKm = vehicle.consumoReferencia_kWhPor100km / 100;
  const socForDistance = (distanceKm) => (distanceKm * energyPerKm / vehicle.bateriaUtilizable_kWh) * 100;
  const maxDistanceWithReserve = ((100 - RESERVA_SOC_MIN) / 100) * vehicle.bateriaUtilizable_kWh / energyPerKm;
  const warnings = [];
  const stops = [];
  let progressKm = 0;
  let soc = socInicial;
  let chargingMinutes = 0;
  let totalCost = 0;
  let hasTariffMissing = false;

  while (true) {
    const remainingKm = totalDistanceKm - progressKm;
    if (soc - socForDistance(remainingKm) >= RESERVA_SOC_MIN) {
      soc -= socForDistance(remainingKm);
      break;
    }

    const reachableProgress = progressKm + Math.max(0, ((soc - RESERVA_SOC_MIN) / 100) * vehicle.bateriaUtilizable_kWh / energyPerKm);
    const reachableStations = stations.filter((station) => station.route.progressKm > progressKm + 0.1 && station.route.progressKm <= reachableProgress + 0.01);
    const stop = reachableStations.at(-1);

    if (!stop) {
      // Una batería baja no debe ocultar la red de carga disponible en el origen.
      // Si hay un cargador compatible en la ciudad de salida, se propone cargar antes
      // de iniciar el viaje y luego se retoma el plan normal.
      const originStation = progressKm === 0 ? originStations[0] : null;
      if (originStation) {
        const furthestAtFull = maxDistanceWithReserve;
        const nextTarget = totalDistanceKm <= furthestAtFull
          ? { progressKm: totalDistanceKm }
          : stations.filter((station) => station.route.progressKm > 0.1 && station.route.progressKm <= furthestAtFull + 0.01).at(-1);

        if (nextTarget) {
          const targetKm = nextTarget.progressKm ?? nextTarget.route?.progressKm;
          const requiredSoc = RESERVA_SOC_MIN + socForDistance(targetKm);
          const socSalida = Math.max(OBJETIVO_CARGA_MAX, requiredSoc);
          if (socSalida <= 100.001) {
            const recarga = calcularRecarga(
              soc,
              Math.min(100, socSalida),
              vehicle.bateriaUtilizable_kWh,
              originStation.potenciaMaxima_kW,
              vehicle.potenciaCargaMaxima_kW,
              originStation.tarifa_CLPporKWh
            );
            stops.push({
              orden: stops.length + 1,
              ...formatStation(originStation, {
                potenciaEfectiva_kW: Math.min(originStation.potenciaMaxima_kW, vehicle.potenciaCargaMaxima_kW),
                socLlegada: soc,
                socSalida: Math.min(100, socSalida),
                recarga,
                distanciaAlTrazadoKm: originStation.distanceFromOriginKm,
                esCargaInicial: true,
              }),
            });
            chargingMinutes += recarga.tiempoCarga_min;
            if (recarga.costo_CLP != null) {
              totalCost += recarga.costo_CLP;
            } else {
              hasTariffMissing = true;
            }
            soc = Math.min(100, socSalida);
            warnings.push(`Batería inicial insuficiente: se agregó una carga de salida en ${originStation.nombre}.`);
            if (socSalida > 80) {
              warnings.push(`En la carga de salida de ${originStation.nombre} se proyecta recargar hasta ${Math.round(socSalida)}%: sobre el 80% la velocidad de carga disminuye por protección de la batería (RN04).`);
            }
            continue;
          }
        }
      }
      return {
        exito: false,
        paradas: stops,
        advertencias: warnings,
        error: 'No hay una estación compatible alcanzable sin bajar de la reserva mínima de batería.',
        code: 'ROUTE_NOT_FEASIBLE',
      };
    }

    const distanceToStop = stop.route.progressKm - progressKm;
    const socLlegada = soc - socForDistance(distanceToStop);
    const afterStop = stations.filter((station) => station.route.progressKm > stop.route.progressKm + 0.1);
    const furthestAtFull = stop.route.progressKm + maxDistanceWithReserve;
    const nextTarget = totalDistanceKm <= furthestAtFull
      ? { progressKm: totalDistanceKm }
      : afterStop.filter((station) => station.route.progressKm <= furthestAtFull + 0.01).at(-1);

    if (!nextTarget) {
      return {
        exito: false,
        paradas: stops,
        advertencias: warnings,
        error: `La cobertura compatible termina después de ${stop.nombre}; no se puede mantener la reserva mínima hasta destino.`,
        code: 'INSUFFICIENT_COVERAGE',
      };
    }

    const targetKm = nextTarget.progressKm ?? nextTarget.route?.progressKm;
    const requiredSoc = RESERVA_SOC_MIN + socForDistance(targetKm - stop.route.progressKm);
    const socSalida = Math.max(OBJETIVO_CARGA_MAX, requiredSoc);
    if (socSalida > 100.001) {
      return {
        exito: false,
        paradas: stops,
        advertencias: warnings,
        error: `El siguiente tramo desde ${stop.nombre} excede la autonomía del vehículo incluso al 100%.`,
        code: 'ROUTE_NOT_FEASIBLE',
      };
    }

    const recarga = calcularRecarga(
      socLlegada,
      Math.min(100, socSalida),
      vehicle.bateriaUtilizable_kWh,
      stop.potenciaMaxima_kW,
      vehicle.potenciaCargaMaxima_kW,
      stop.tarifa_CLPporKWh
    );
    stops.push({
      orden: stops.length + 1,
      ...formatStation(stop, {
        potenciaEfectiva_kW: Math.min(stop.potenciaMaxima_kW, vehicle.potenciaCargaMaxima_kW),
        socLlegada,
        socSalida: Math.min(100, socSalida),
        recarga,
      }),
    });
    chargingMinutes += recarga.tiempoCarga_min;
    if (recarga.costo_CLP != null) {
      totalCost += recarga.costo_CLP;
    } else {
      hasTariffMissing = true;
    }
    if (socSalida > 80) {
      warnings.push(`En ${stop.nombre} se proyecta recargar hasta ${Math.round(socSalida)}%: sobre el 80% la velocidad de carga disminuye por protección de la batería (RN04).`);
    }
    progressKm = stop.route.progressKm;
    soc = Math.min(100, socSalida);
  }

  if (hasTariffMissing) {
    warnings.push('Una o más paradas no cuentan con tarifa informada; el costo presentado es una estimación parcial.');
  }

  return {
    exito: true,
    paradas: stops,
    advertencias: warnings,
    resumen: {
      distanciaTotal_km: ROUND(totalDistanceKm, 1),
      tiempoConduccionTotal_min: Math.round(drivingMinutes),
      tiempoCargaTotal_min: chargingMinutes,
      tiempoTotalViaje_min: Math.round(drivingMinutes) + chargingMinutes,
      costoTotal_CLP: totalCost,
      costoIncompleto: hasTariffMissing,
      socFinal: ROUND(soc),
      cantidadParadas: stops.length,
      vehiculoUsado: vehicle.modelo,
      reservaMinimaSoC: RESERVA_SOC_MIN,
    },
  };
}

function resolveKnownCity(value, cities) {
  if (!value || typeof value !== 'string') return null;
  const city = cities.find((item) => item.id === value || item.nombre.toLocaleLowerCase('es-CL') === value.toLocaleLowerCase('es-CL'));
  return city ? { nombre: city.nombre, latitud: city.latitud, longitud: city.longitud } : null;
}

function createRoutePlanningService({ providers = createRoutingProviders(), vehicles = defaultVehicles, stations = defaultStations, cities = defaultCities } = {}) {
  async function plan({ origin, destination, origenId, destinoId, vehiculoId, socInicial }) {
    const inputErrors = [];
    const originValue = origin || origenId;
    const destinationValue = destination || destinoId;
    if (!originValue || typeof originValue !== 'string') inputErrors.push('El campo "origin" es requerido y debe ser texto.');
    if (!destinationValue || typeof destinationValue !== 'string') inputErrors.push('El campo "destination" es requerido y debe ser texto.');
    if (!vehiculoId || typeof vehiculoId !== 'string') inputErrors.push('El campo "vehiculoId" es requerido y debe ser texto.');
    if (!Number.isFinite(socInicial) || socInicial < 0 || socInicial > 100) inputErrors.push('El campo "socInicial" debe ser un número entre 0 y 100.');
    if (inputErrors.length) return { exito: false, code: 'VALIDATION_ERROR', error: inputErrors.join(' ') };

    const vehicle = vehicles.find((item) => item.id === vehiculoId);
    if (!vehicle) return { exito: false, code: 'VEHICLE_NOT_FOUND', error: `Vehículo con ID '${vehiculoId}' no encontrado.` };

    const resolvedOrigin = resolveKnownCity(originValue, cities) || await providers.geocode(`${originValue}, Chile`);
    const resolvedDestination = resolveKnownCity(destinationValue, cities) || await providers.geocode(`${destinationValue}, Chile`);
    if (resolvedOrigin.latitud === resolvedDestination.latitud && resolvedOrigin.longitud === resolvedDestination.longitud) {
      return { exito: false, code: 'VALIDATION_ERROR', error: 'El origen y el destino deben ser distintos.' };
    }

    const directions = await providers.getDirections(resolvedOrigin, resolvedDestination);
    const totalDistanceKm = directions.distancia_m / 1000;
    const candidateStations = buildCandidateStations({
      stations,
      vehicle,
      coordinates: directions.geometry.coordinates,
      totalDistanceKm,
    });
    const originStations = buildOriginStations({ stations, vehicle, origin: resolvedOrigin });
    const calculation = calculateChargingPlan({
      vehicle,
      stations: candidateStations,
      originStations,
      totalDistanceKm,
      drivingMinutes: directions.duracion_s / 60,
      socInicial,
    });
    const coverageWarning = candidateStations.length === 0 && totalDistanceKm > 0
      ? ['No se encontraron estaciones compatibles dentro de 35 km del trazado.']
      : [];

    return {
      ...calculation,
      vehiculo: {
        id: vehicle.id,
        modelo: vehicle.modelo,
        marca: vehicle.marca,
        bateriaUtilizable_kWh: vehicle.bateriaUtilizable_kWh,
      },
      origen: resolvedOrigin,
      destino: resolvedDestination,
      geometry: directions.geometry,
      advertencias: [...(calculation.advertencias || []), ...coverageWarning],
      estacionesOrigenCompatibles: originStations.map((station) => ({
        id: station.id,
        nombre: station.nombre,
        ciudad: station.ciudad,
        operador: station.operador,
        conector: station.compatibleConnector,
        potenciaMaxima_kW: station.potenciaMaxima_kW,
        distanciaKm: ROUND(station.distanceFromOriginKm),
      })),
    };
  }

  return { plan };
}

module.exports = {
  ROUTE_CORRIDOR_KM,
  RoutingProviderError,
  haversineKm,
  projectStationOnRoute,
  buildCandidateStations,
  buildOriginStations,
  calculateChargingPlan,
  createRoutePlanningService,
};
