const API_BASE = '/api';
const TOKEN_KEY = 'electravelin.token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(message, { status, code, detalles } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.detalles = detalles || [];
  }
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Revisa tu conexión.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && auth) {
      setToken(null);
      window.dispatchEvent(new Event('electravelin:session-expired'));
    }
    throw new ApiError(data.error || 'Error al procesar la solicitud', {
      status: res.status,
      code: data.code,
      detalles: data.detalles,
    });
  }
  return data;
}

function toQuery(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, value);
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

// ─── Catálogo público ───────────────────────────────────────────────────────
export async function fetchVehiculos(filters = {}) {
  const data = await request(`/vehiculos${toQuery(filters)}`);
  return data.vehiculos;
}

export async function fetchEstaciones(filters = {}) {
  const data = await request(`/estaciones${toQuery(filters)}`);
  return data.estaciones;
}

export async function fetchCiudades() {
  const data = await request('/ciudades');
  return data.ciudades;
}

export async function calcularRuta(params) {
  return request('/routes/plan', { method: 'POST', body: params });
}

// ─── Cuenta ────────────────────────────────────────────────────────────────
export async function register(payload) {
  return request('/auth/register', { method: 'POST', body: payload });
}

export async function login(payload) {
  return request('/auth/login', { method: 'POST', body: payload });
}

export async function fetchMe() {
  return request('/auth/me', { auth: true });
}

export async function updateProfile(payload) {
  return request('/perfil', { method: 'PUT', body: payload, auth: true });
}

export async function fetchTrips() {
  const data = await request('/viajes', { auth: true });
  return data.viajes;
}

export async function saveTrip(payload) {
  const data = await request('/viajes', { method: 'POST', body: payload, auth: true });
  return data.viaje;
}

export async function deleteTrip(id) {
  return request(`/viajes/${id}`, { method: 'DELETE', auth: true });
}

export async function fetchFavorites() {
  const data = await request('/favoritos', { auth: true });
  return data.favoritos;
}

export async function addFavorite(payload) {
  const data = await request('/favoritos', { method: 'POST', body: payload, auth: true });
  return data.favorito;
}

export async function removeFavorite(id) {
  return request(`/favoritos/${id}`, { method: 'DELETE', auth: true });
}

// ─── Administración ────────────────────────────────────────────────────────
export async function fetchAdminVehiculos() {
  const data = await request('/admin/vehiculos', { auth: true });
  return data.vehiculos;
}

export async function createAdminVehiculo(payload) {
  const data = await request('/admin/vehiculos', { method: 'POST', body: payload, auth: true });
  return data.vehiculo;
}

export async function updateAdminVehiculo(id, payload) {
  const data = await request(`/admin/vehiculos/${id}`, { method: 'PUT', body: payload, auth: true });
  return data.vehiculo;
}

export async function deactivateAdminVehiculo(id) {
  const data = await request(`/admin/vehiculos/${id}`, { method: 'DELETE', auth: true });
  return data.vehiculo;
}

export async function fetchAdminEstaciones() {
  const data = await request('/admin/estaciones', { auth: true });
  return data.estaciones;
}

export async function createAdminEstacion(payload) {
  const data = await request('/admin/estaciones', { method: 'POST', body: payload, auth: true });
  return data.estacion;
}

export async function updateAdminEstacion(id, payload) {
  const data = await request(`/admin/estaciones/${id}`, { method: 'PUT', body: payload, auth: true });
  return data.estacion;
}

export async function deactivateAdminEstacion(id) {
  const data = await request(`/admin/estaciones/${id}`, { method: 'DELETE', auth: true });
  return data.estacion;
}

export async function fetchAuditoria(entidad) {
  const data = await request(`/admin/auditoria${toQuery({ entidad })}`, { auth: true });
  return data.auditoria;
}

export async function fetchEstacionesFuente() {
  const data = await request('/estaciones/fuente');
  return data.metadata;
}

export async function syncAdminSecEstaciones(estaciones) {
  return request('/admin/estaciones/sync-sec', { method: 'POST', body: { estaciones }, auth: true });
}

