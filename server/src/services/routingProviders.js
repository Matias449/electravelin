class RoutingProviderError extends Error {
  constructor(message, provider, cause) {
    super(message);
    this.name = 'RoutingProviderError';
    this.provider = provider;
    this.cause = cause;
  }
}

function normaliseBaseUrl(url) {
  return (url || '').replace(/\/$/, '');
}

function createRoutingProviders({
  fetchImpl = global.fetch,
  orsApiKey = process.env.ORS_API_KEY,
  orsBaseUrl = process.env.ORS_BASE_URL || 'https://api.openrouteservice.org',
  osrmBaseUrl = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org',
  routingProvider = process.env.ROUTING_PROVIDER || (orsApiKey ? 'openrouteservice' : 'osrm'),
  nominatimBaseUrl = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org',
  nominatimUserAgent = process.env.NOMINATIM_USER_AGENT || 'Electravelin/2.0',
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Este entorno necesita una implementación de fetch para usar los proveedores de ruteo.');
  }

  async function geocode(query) {
    const url = new URL(`${normaliseBaseUrl(nominatimBaseUrl)}/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'cl');

    let response;
    try {
      response = await fetchImpl(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': nominatimUserAgent,
        },
      });
    } catch (error) {
      throw new RoutingProviderError('No fue posible contactar a Nominatim.', 'nominatim', error);
    }

    if (!response.ok) {
      throw new RoutingProviderError(`Nominatim respondió con estado ${response.status}.`, 'nominatim');
    }

    const places = await response.json();
    const place = Array.isArray(places) ? places[0] : null;
    if (!place || !Number.isFinite(Number(place.lat)) || !Number.isFinite(Number(place.lon))) {
      throw new RoutingProviderError(`Nominatim no encontró "${query}" en Chile.`, 'nominatim');
    }

    return {
      nombre: place.display_name?.split(',')[0] || query,
      latitud: Number(place.lat),
      longitud: Number(place.lon),
      displayName: place.display_name || query,
    };
  }

  async function getDirectionsWithOpenRouteService(origin, destination) {
    if (!orsApiKey) {
      // Si falta la API key, recurrir transparentemente a OSRM sin bloquear al usuario
      return getDirectionsWithOsrm(origin, destination);
    }

    let response;
    try {
      response = await fetchImpl(
        `${normaliseBaseUrl(orsBaseUrl)}/v2/directions/driving-car/geojson`,
        {
          method: 'POST',
          headers: {
            Authorization: orsApiKey,
            'Content-Type': 'application/json',
            Accept: 'application/geo+json, application/json',
          },
          body: JSON.stringify({
            coordinates: [
              [origin.longitud, origin.latitud],
              [destination.longitud, destination.latitud],
            ],
            instructions: false,
          }),
        }
      );
    } catch (error) {
      // Fallback a OSRM ante error de red en ORS
      return getDirectionsWithOsrm(origin, destination);
    }

    if (!response.ok) {
      // Si la API key está vencida o rechazada, fallback a OSRM
      return getDirectionsWithOsrm(origin, destination);
    }

    const result = await response.json();
    const feature = result.features?.[0];
    const summary = feature?.properties?.summary;
    if (feature?.geometry?.type !== 'LineString' || !Array.isArray(feature.geometry.coordinates) || !summary) {
      return getDirectionsWithOsrm(origin, destination);
    }

    return {
      geometry: feature.geometry,
      distancia_m: Number(summary.distance),
      duracion_s: Number(summary.duration),
    };
  }

  async function getDirectionsWithOsrm(origin, destination) {
    const coordinates = `${origin.longitud},${origin.latitud};${destination.longitud},${destination.latitud}`;
    const url = `${normaliseBaseUrl(osrmBaseUrl)}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`;
    let response;
    try {
      response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    } catch (error) {
      throw new RoutingProviderError('No fue posible contactar al servicio de ruteo OSRM.', 'osrm', error);
    }
    if (!response.ok) {
      throw new RoutingProviderError(`OSRM respondió con estado ${response.status}.`, 'osrm');
    }
    const result = await response.json();
    const route = result.code === 'Ok' ? result.routes?.[0] : null;
    if (!route || route.geometry?.type !== 'LineString' || !Array.isArray(route.geometry.coordinates)) {
      throw new RoutingProviderError(`OSRM no encontró una ruta (${result.code || 'respuesta inválida'}).`, 'osrm');
    }
    return {
      geometry: route.geometry,
      distancia_m: Number(route.distance),
      duracion_s: Number(route.duration),
    };
  }

  async function getDirections(origin, destination) {
    if (routingProvider === 'openrouteservice' && orsApiKey) {
      return getDirectionsWithOpenRouteService(origin, destination);
    }
    return getDirectionsWithOsrm(origin, destination);
  }

  return { geocode, getDirections };
}

module.exports = { createRoutingProviders, RoutingProviderError };
