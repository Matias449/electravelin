const API_BASE = '/api';

/**
 * Obtiene el catálogo de vehículos eléctricos.
 * @returns {Promise<Object[]>} Lista de vehículos.
 */
export async function fetchVehiculos() {
  const res = await fetch(`${API_BASE}/vehiculos`);
  if (!res.ok) throw new Error('Error al obtener vehículos');
  const data = await res.json();
  return data.vehiculos;
}

/**
 * Obtiene la lista de ciudades disponibles.
 * @returns {Promise<Object[]>} Lista de ciudades.
 */
export async function fetchCiudades() {
  const res = await fetch(`${API_BASE}/ciudades`);
  if (!res.ok) throw new Error('Error al obtener ciudades');
  const data = await res.json();
  return data.ciudades;
}

/**
 * Envía una solicitud de cálculo de ruta al backend.
 * @param {{ origenId: string, destinoId: string, vehiculoId: string, socInicial: number }} params
 * @returns {Promise<Object>} Resultado del cálculo con paradas y resumen.
 */
export async function calcularRuta(params) {
  const res = await fetch(`${API_BASE}/calcular-ruta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await res.json();

  // El backend retorna 200 incluso para rutas no factibles (con exito: false)
  // Solo lanzar error para errores HTTP reales
  if (!res.ok && res.status !== 200) {
    throw new Error(data.error || 'Error al calcular la ruta');
  }

  return data;
}
