const DEFAULT_URL = 'https://cargadorespublicos.cl/api/data';
const CACHE_MS = 2 * 60 * 1000;

function normalizeConnector(value) {
  const name = String(value || '').trim().toLowerCase();
  if (name.includes('ccs') || name.includes('combo')) return 'CCS2';
  if (name.includes('chademo')) return 'CHAdeMO';
  if (name.includes('tipo 2') || name.includes('type 2') || name.includes('mennekes')) return 'Type 2';
  return null;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function availability(connectors) {
  const statuses = connectors.map((connector) => String(connector.estado || '').toUpperCase());
  const count = (status) => statuses.filter((value) => value === status).length;
  const available = count('DISPONIBLE');
  const occupied = count('OCUPADO');
  const offline = count('FUERA DE LINEA');
  const unavailable = count('NO DISPONIBLE');
  return {
    estado: available ? 'DISPONIBLE' : occupied ? 'OCUPADO' : unavailable ? 'NO DISPONIBLE' : offline ? 'FUERA DE LINEA' : 'SIN ESTADO',
    disponibles: available,
    ocupados: occupied,
    noDisponibles: unavailable,
    fueraDeLinea: offline,
  };
}

function normalizeLocation(location) {
  const evses = Array.isArray(location.evses) ? location.evses : [];
  const chargers = evses.map((evse) => {
    const connectors = (Array.isArray(evse.connectors) ? evse.connectors : []).map((connector) => ({
      id: connector.connector_id,
      estandar: normalizeConnector(connector.standard) || connector.standard || 'No informado',
      tipoCorriente: connector.power_type || null,
      potenciaMaxima_kW: number(connector.max_electric_power),
      estado: connector.status || evse.status || 'SIN ESTADO',
      actualizadoEn: evse.last_updated || location.last_updated || null,
    }));
    return {
      id: evse.evse_id || String(evse.evse_uid),
      marca: evse.brand || 'Marca no informada',
      modelo: evse.model || 'Modelo no informado',
      referenciaFisica: evse.physical_reference || evse.directions || null,
      permiteCargaSimultanea: Boolean(evse.permite_carga_simultanea),
      potenciaMaxima_kW: number(evse.max_electric_power),
      estado: evse.status || 'SIN ESTADO',
      actualizadoEn: evse.last_updated || location.last_updated || null,
      conectores: connectors,
    };
  });
  const connectors = chargers.flatMap((charger) => charger.conectores);
  const standards = [...new Set(connectors.map((connector) => connector.estandar).filter(Boolean))];
  const maxPower = Math.max(0, ...connectors.map((connector) => connector.potenciaMaxima_kW || 0), ...chargers.map((charger) => charger.potenciaMaxima_kW || 0));
  return {
    id: `sec-${location.location_id}`,
    secLocationId: location.location_id,
    nombre: location.name || 'Punto de carga SEC',
    direccion: [location.address, location.commune, location.region].filter(Boolean).join(', ') || 'Dirección no informada por SEC',
    comuna: location.commune || null,
    ciudad: location.commune || 'Chile',
    region: location.region || null,
    operador: location.OPC?.name || location.owner?.name || 'Operador no informado',
    latitud: number(location.coordinates?.latitude),
    longitud: number(location.coordinates?.longitude),
    conectoresDisponibles: standards,
    potenciaMaxima_kW: maxPower || null,
    acceso: location.institucion_privada ? 'Privado' : 'Público',
    horario: location.opening_times?.twentyfourseven ? '24/7' : 'Consultar operador',
    folioIRVE: location.folio_IRVE || null,
    datosIRVEConfirmados: Boolean(location.datos_IRVE_confirmados),
    actualizadoEn: location.last_updated || null,
    fuente: 'SEC / Plataforma de Interoperabilidad EcoCarga',
    urlFuente: 'https://cargadorespublicos.cl/',
    cargadores: chargers,
    disponibilidad: availability(connectors),
  };
}

function createSecPublicCatalogService({ fetchFn = global.fetch, url = DEFAULT_URL, now = () => Date.now() } = {}) {
  let cache = null;
  let cachedAt = 0;

  async function sourceData() {
    if (cache && now() - cachedAt < CACHE_MS) return cache;
    const response = await fetchFn(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`SEC_ECOCARGA_HTTP_${response.status}`);
    const parsed = await response.json();
    if (!Array.isArray(parsed)) throw new Error('SEC_ECOCARGA_INVALID_RESPONSE');
    cache = parsed;
    cachedAt = now();
    return cache;
  }

  async function list({ vehicle, busqueda, region, conector, potenciaMin, incluirPrivadas = false } = {}) {
    const locations = (await sourceData())
      .filter((location) => incluirPrivadas || !location.institucion_privada)
      .map(normalizeLocation)
      .filter((station) => !busqueda || [station.nombre, station.direccion, station.comuna, station.region, station.operador].some((field) => String(field || '').toLowerCase().includes(String(busqueda).toLowerCase())))
      .filter((station) => !region || String(station.region || '').toLowerCase().includes(String(region).toLowerCase()))
      .filter((station) => !conector || station.conectoresDisponibles.includes(conector))
      .filter((station) => !potenciaMin || Number(station.potenciaMaxima_kW) >= Number(potenciaMin));

    return locations.map((station) => {
      if (!vehicle) return station;
      const compatibles = station.conectoresDisponibles.filter((connector) => vehicle.conectoresCompatibles?.includes(connector));
      return { ...station, compatibilidad: { vehiculoId: vehicle.id, compatible: compatibles.length > 0, conectoresCompatibles: compatibles } };
    });
  }

  return { list, normalizeLocation, normalizeConnector };
}

module.exports = { createSecPublicCatalogService, normalizeLocation, normalizeConnector };
