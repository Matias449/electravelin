import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as api from '../utils/api';

function formatearFecha(iso) {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ProfilePanel({ onRequireAuth }) {
  const { usuario, updateProfile } = useAuth();
  const [vehiculos, setVehiculos] = useState([]);
  const [nombre, setNombre] = useState(usuario?.nombre || '');
  const [vehiculoFavoritoId, setVehiculoFavoritoId] = useState(usuario?.vehiculoFavoritoId || '');
  const [viajes, setViajes] = useState([]);
  const [favoritos, setFavoritos] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setCargando(true);
      try {
        const [vehiculosData, viajesData, favoritosData] = await Promise.all([
          api.fetchVehiculos(),
          api.fetchTrips(),
          api.fetchFavorites(),
        ]);
        if (!active) return;
        setVehiculos(vehiculosData);
        setViajes(viajesData);
        setFavoritos(favoritosData);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setCargando(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setNombre(usuario?.nombre || '');
    setVehiculoFavoritoId(usuario?.vehiculoFavoritoId || '');
  }, [usuario]);

  async function handleProfile(event) {
    event.preventDefault();
    setMensaje('');
    setError('');
    try {
      await updateProfile({ nombre, vehiculoFavoritoId: vehiculoFavoritoId || null });
      setMensaje('Perfil actualizado.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteTrip(id) {
    if (!window.confirm('¿Eliminar este viaje del historial?')) return;
    try {
      await api.deleteTrip(id);
      setViajes((prev) => prev.filter((trip) => trip.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemoveFavorite(id) {
    try {
      await api.removeFavorite(id);
      setFavoritos((prev) => prev.filter((favorite) => favorite.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  if (!usuario) {
    return (
      <div className="card empty-state">
        <span aria-hidden="true" className="empty-state__icon">🔐</span>
        <h2>Inicia sesión para ver tu perfil</h2>
        <p>Guarda tus viajes, marca favoritos y personaliza tu vehículo habitual.</p>
        <button type="button" className="btn btn--primary" onClick={onRequireAuth}>Iniciar sesión</button>
      </div>
    );
  }

  return (
    <section className="panel" id="profile-panel">
      <div className="card">
        <h2 className="card__title"><span aria-hidden="true">👤</span> Mi perfil</h2>
        <form onSubmit={handleProfile} className="form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="perfil-nombre">Nombre</label>
            <input id="perfil-nombre" className="form-input" value={nombre} onChange={(event) => setNombre(event.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="perfil-vehiculo">Vehículo habitual</label>
            <select id="perfil-vehiculo" className="form-select" value={vehiculoFavoritoId} onChange={(event) => setVehiculoFavoritoId(event.target.value)}>
              <option value="">— Sin preferencia —</option>
              {vehiculos.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>{vehicle.modelo}</option>
              ))}
            </select>
          </div>
          <div className="form-group form-group--full">
            <button type="submit" className="btn btn--primary">Guardar cambios</button>
          </div>
        </form>
        {mensaje && <p className="form-success" role="status">{mensaje}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <p className="form-helper">Sesión: {usuario.email} · Rol: {usuario.rol}</p>
      </div>

      <div className="card">
        <h2 className="card__title"><span aria-hidden="true">🕓</span> Historial de viajes</h2>
        {cargando && <p className="form-helper">Cargando…</p>}
        {!cargando && viajes.length === 0 && <p className="form-helper">Aún no guardas viajes. Planifica uno y presiona “Guardar viaje”.</p>}
        <ul className="list">
          {viajes.map((trip) => (
            <li key={trip.id} className="list__item">
              <div>
                <strong>{trip.origen} → {trip.destino}</strong>
                <div className="list__meta">
                  {formatearFecha(trip.creadoEn)} · {trip.resumen?.distanciaTotal_km} km · ${Number(trip.resumen?.costoTotal_CLP || 0).toLocaleString('es-CL')} CLP · {trip.resumen?.cantidadParadas ?? 0} paradas
                </div>
              </div>
              <button type="button" className="btn btn--danger btn--small" onClick={() => handleDeleteTrip(trip.id)}>
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2 className="card__title"><span aria-hidden="true">⭐</span> Favoritos</h2>
        {!cargando && favoritos.length === 0 && <p className="form-helper">Marca vehículos y estaciones desde la pestaña Catálogo.</p>}
        <ul className="list">
          {favoritos.map((favorite) => (
            <li key={favorite.id} className="list__item">
              <div>
                <strong>{favorite.referencia?.nombre || favorite.referencia?.modelo || favorite.referenciaId}</strong>
                <div className="list__meta">{favorite.tipo === 'vehiculo' ? 'Vehículo' : 'Estación'}{favorite.referencia?.ciudad ? ` · ${favorite.referencia.ciudad}` : ''}</div>
              </div>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => handleRemoveFavorite(favorite.id)}>
                Quitar
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
