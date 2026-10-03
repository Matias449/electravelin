const CONECTORES_VALIDOS = ['CCS2', 'CHAdeMO', 'Type 2'];

function normaliseText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function matchesAny(value, candidates) {
  const normalised = normaliseText(value);
  return candidates.some((candidate) => normalised.includes(normaliseText(candidate)));
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function slugify(value) {
  return normaliseText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function validateVehicleInput(body, { partial = false } = {}) {
  const errors = [];
  const required = ['modelo', 'marca', 'bateriaUtilizable_kWh', 'consumoReferencia_kWhPor100km', 'potenciaCargaMaxima_kW', 'conectoresCompatibles'];
  if (!partial) {
    for (const field of required) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        errors.push(`El campo "${field}" es requerido.`);
      }
    }
  }
  for (const field of ['bateriaUtilizable_kWh', 'consumoReferencia_kWhPor100km', 'potenciaCargaMaxima_kW']) {
    if (body[field] !== undefined) {
      const value = toNumber(body[field]);
      if (value === null || value <= 0) errors.push(`El campo "${field}" debe ser un número mayor a 0.`);
    }
  }
  if (body.conectoresCompatibles !== undefined) {
    if (!Array.isArray(body.conectoresCompatibles) || body.conectoresCompatibles.length === 0) {
      errors.push('El campo "conectoresCompatibles" debe ser una lista no vacía.');
    } else if (!body.conectoresCompatibles.every((conector) => CONECTORES_VALIDOS.includes(conector))) {
      errors.push(`Conectores válidos: ${CONECTORES_VALIDOS.join(', ')}.`);
    }
  }
  for (const field of ['modelo', 'marca']) {
    if (body[field] !== undefined && (typeof body[field] !== 'string' || body[field].trim() === '')) {
      errors.push(`El campo "${field}" no puede estar vacío.`);
    }
  }
  if (body.activo !== undefined && typeof body.activo !== 'boolean') {
    errors.push('El campo "activo" debe ser booleano.');
  }
  return errors;
}

function validateStationInput(body, { partial = false } = {}) {
  const errors = [];
  const required = ['nombre', 'ciudad', 'operador', 'latitud', 'longitud', 'conectoresDisponibles', 'potenciaMaxima_kW', 'tarifa_CLPporKWh'];
  if (!partial) {
    for (const field of required) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        errors.push(`El campo "${field}" es requerido.`);
      }
    }
  }
  for (const field of ['latitud', 'longitud', 'potenciaMaxima_kW', 'tarifa_CLPporKWh']) {
    if (body[field] !== undefined) {
      const value = toNumber(body[field]);
      if (value === null) errors.push(`El campo "${field}" debe ser numérico.`);
      if (field === 'latitud' && (value < -56 || value > -17)) errors.push('La latitud debe estar dentro de Chile continental.');
      if (field === 'longitud' && (value < -76 || value > -66)) errors.push('La longitud debe estar dentro de Chile continental.');
    }
  }
  if (body.conectoresDisponibles !== undefined) {
    if (!Array.isArray(body.conectoresDisponibles) || body.conectoresDisponibles.length === 0) {
      errors.push('El campo "conectoresDisponibles" debe ser una lista no vacía.');
    } else if (!body.conectoresDisponibles.every((conector) => CONECTORES_VALIDOS.includes(conector))) {
      errors.push(`Conectores válidos: ${CONECTORES_VALIDOS.join(', ')}.`);
    }
  }
  for (const field of ['nombre', 'ciudad', 'operador']) {
    if (body[field] !== undefined && (typeof body[field] !== 'string' || body[field].trim() === '')) {
      errors.push(`El campo "${field}" no puede estar vacío.`);
    }
  }
  if (body.disponible !== undefined && typeof body.disponible !== 'boolean') {
    errors.push('El campo "disponible" debe ser booleano.');
  }
  if (body.verificada !== undefined && typeof body.verificada !== 'boolean') {
    errors.push('El campo "verificada" debe ser booleano.');
  }
  return errors;
}

/**
 * Catálogo de vehículos y estaciones con filtros públicos y CRUD administrativo.
 * Las bajas son lógicas (activo=false / disponible=false) para no romper el historial.
 */
function createCatalogService({ store } = {}) {
  if (!store) throw new Error('createCatalogService requiere un store.');

  function listVehicles(filters = {}) {
    const { marca, conector, bateriaMin, potenciaMin, incluirInactivos } = filters;
    return store
      .all('vehicles')
      .filter((vehicle) => incluirInactivos === true || vehicle.activo !== false)
      .filter((vehicle) => !marca || normaliseText(vehicle.marca).includes(normaliseText(marca)))
      .filter((vehicle) => !conector || vehicle.conectoresCompatibles?.includes(conector))
      .filter((vehicle) => !bateriaMin || Number(vehicle.bateriaUtilizable_kWh) >= Number(bateriaMin))
      .filter((vehicle) => !potenciaMin || Number(vehicle.potenciaCargaMaxima_kW) >= Number(potenciaMin))
      .sort((a, b) => String(a.marca ?? '').localeCompare(String(b.marca ?? ''), 'es-CL') || String(a.modelo ?? '').localeCompare(String(b.modelo ?? ''), 'es-CL'));
  }

  function listStations(filters = {}) {
    const { ciudad, operador, conector, potenciaMin, region, incluirNoDisponibles } = filters;
    return store
      .all('stations')
      .filter((station) => incluirNoDisponibles === true || station.disponible !== false)
      .filter((station) => !ciudad || normaliseText(station.ciudad).includes(normaliseText(ciudad)))
      .filter((station) => !region || normaliseText(station.region).includes(normaliseText(region)))
      .filter((station) => !operador || normaliseText(station.operador).includes(normaliseText(operador)))
      .filter((station) => !conector || station.conectoresDisponibles?.includes(conector))
      .filter((station) => !potenciaMin || Number(station.potenciaMaxima_kW) >= Number(potenciaMin))
      .sort((a, b) => String(a.ciudad ?? '').localeCompare(String(b.ciudad ?? ''), 'es-CL') || String(a.nombre ?? '').localeCompare(String(b.nombre ?? ''), 'es-CL'));
  }

  function createVehicle(body) {
    const errors = validateVehicleInput(body);
    if (errors.length) return { error: { status: 400, mensaje: 'Errores de validación', detalles: errors } };

    const id = body.id ? slugify(body.id) : `${slugify(body.marca)}_${slugify(body.modelo)}`;
    if (store.findById('vehicles', id)) {
      return { error: { status: 409, mensaje: `Ya existe un vehículo con id '${id}'.`, detalles: [] } };
    }
    const vehicle = store.insert('vehicles', {
      id,
      modelo: String(body.modelo).trim(),
      marca: String(body.marca).trim(),
      bateriaUtilizable_kWh: toNumber(body.bateriaUtilizable_kWh),
      consumoReferencia_kWhPor100km: toNumber(body.consumoReferencia_kWhPor100km),
      potenciaCargaMaxima_kW: toNumber(body.potenciaCargaMaxima_kW),
      conectoresCompatibles: body.conectoresCompatibles,
      imagenUrl: body.imagenUrl || null,
      activo: body.activo !== false,
    });
    return { vehicle };
  }

  function updateVehicle(id, body) {
    if (!store.findById('vehicles', id)) return { error: { status: 404, mensaje: `Vehículo '${id}' no encontrado.`, detalles: [] } };
    const errors = validateVehicleInput(body, { partial: true });
    if (errors.length) return { error: { status: 400, mensaje: 'Errores de validación', detalles: errors } };

    const patch = {};
    for (const field of ['modelo', 'marca', 'imagenUrl']) {
      if (body[field] !== undefined) patch[field] = body[field] === null ? null : String(body[field]).trim();
    }
    for (const field of ['bateriaUtilizable_kWh', 'consumoReferencia_kWhPor100km', 'potenciaCargaMaxima_kW']) {
      if (body[field] !== undefined) patch[field] = toNumber(body[field]);
    }
    if (body.conectoresCompatibles !== undefined) patch.conectoresCompatibles = body.conectoresCompatibles;
    if (body.activo !== undefined) patch.activo = body.activo;
    return { vehicle: store.update('vehicles', id, patch) };
  }

  function createStation(body) {
    const errors = validateStationInput(body);
    if (errors.length) return { error: { status: 400, mensaje: 'Errores de validación', detalles: errors } };

    const id = body.id ? slugify(body.id) : `sta_${slugify(body.ciudad)}_${slugify(body.operador)}`;
    if (store.findById('stations', id)) {
      return { error: { status: 409, mensaje: `Ya existe una estación con id '${id}'.`, detalles: [] } };
    }
    const station = store.insert('stations', {
      id,
      nombre: String(body.nombre).trim(),
      ciudadId: body.ciudadId ? slugify(body.ciudadId) : slugify(body.ciudad),
      ciudad: String(body.ciudad).trim(),
      region: body.region ? String(body.region).trim() : null,
      operador: String(body.operador).trim(),
      latitud: toNumber(body.latitud),
      longitud: toNumber(body.longitud),
      conectoresDisponibles: body.conectoresDisponibles,
      potenciaMaxima_kW: toNumber(body.potenciaMaxima_kW),
      tarifa_CLPporKWh: toNumber(body.tarifa_CLPporKWh),
      tipoTarifa: body.tipoTarifa || 'CLP/kWh',
      disponible: body.disponible !== false,
      verificada: body.verificada === true,
    });
    return { station };
  }

  function updateStation(id, body) {
    if (!store.findById('stations', id)) return { error: { status: 404, mensaje: `Estación '${id}' no encontrada.`, detalles: [] } };
    const errors = validateStationInput(body, { partial: true });
    if (errors.length) return { error: { status: 400, mensaje: 'Errores de validación', detalles: errors } };

    const patch = {};
    for (const field of ['nombre', 'ciudad', 'region', 'operador', 'tipoTarifa']) {
      if (body[field] !== undefined) patch[field] = body[field] === null ? null : String(body[field]).trim();
    }
    if (body.ciudadId !== undefined) patch.ciudadId = slugify(body.ciudadId);
    for (const field of ['latitud', 'longitud', 'potenciaMaxima_kW', 'tarifa_CLPporKWh']) {
      if (body[field] !== undefined) patch[field] = toNumber(body[field]);
    }
    if (body.conectoresDisponibles !== undefined) patch.conectoresDisponibles = body.conectoresDisponibles;
    if (body.disponible !== undefined) patch.disponible = body.disponible;
    if (body.verificada !== undefined) patch.verificada = body.verificada;
    return { station: store.update('stations', id, patch) };
  }

  function deactivateVehicle(id) {
    if (!store.findById('vehicles', id)) return { error: { status: 404, mensaje: `Vehículo '${id}' no encontrado.`, detalles: [] } };
    return { vehicle: store.update('vehicles', id, { activo: false }) };
  }

  function deactivateStation(id) {
    if (!store.findById('stations', id)) return { error: { status: 404, mensaje: `Estación '${id}' no encontrada.`, detalles: [] } };
    return { station: store.update('stations', id, { disponible: false }) };
  }

  return {
    CONECTORES_VALIDOS,
    listVehicles,
    listStations,
    createVehicle,
    updateVehicle,
    deactivateVehicle,
    createStation,
    updateStation,
    deactivateStation,
  };
}

module.exports = { createCatalogService, CONECTORES_VALIDOS };
