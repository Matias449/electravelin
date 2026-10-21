import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as api from '../utils/api';
import CustomVehicleModal from './CustomVehicleModal';
import { User, History, Star, Lock, Trash2, CheckCircle2, Car, Plus, Edit2, Zap, BatteryCharging, Gauge, Compass } from 'lucide-react';

function formatearFecha(iso) {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ProfilePanel({ onRequireAuth, onNavigate }) {
  const { usuario, updateProfile } = useAuth();
  const [vehiculos, setVehiculos] = useState([]);
  const [misVehiculos, setMisVehiculos] = useState([]);
  const [nombre, setNombre] = useState(usuario?.nombre || '');
  const [vehiculoFavoritoId, setVehiculoFavoritoId] = useState(usuario?.vehiculoFavoritoId || '');
  const [viajes, setViajes] = useState([]);
  const [favoritos, setFavoritos] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  // Modal para agregar o editar vehículo
  const [modalVehiculoOpen, setModalVehiculoOpen] = useState(false);
  const [vehiculoAEditar, setVehiculoAEditar] = useState(null);

  async function cargarDatos() {
    if (!usuario) {
      setCargando(false);
      setViajes([]);
      setFavoritos([]);
      setMisVehiculos([]);
      setError('');
      return;
    }
    setCargando(true);
    setError('');
    try {
      const [vehiculosData, misVehiculosData, viajesData, favoritosData] = await Promise.all([
        api.fetchVehiculos(),
        api.fetchMisVehiculos(),
        api.fetchTrips(),
        api.fetchFavorites(),
      ]);
      setVehiculos(vehiculosData);
      setMisVehiculos(misVehiculosData);
      setViajes(viajesData);
      setFavoritos(favoritosData);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, [usuario?.id]);

  useEffect(() => {
    function handleVehiclesUpdated() {
      cargarDatos();
    }
    window.addEventListener('electravelin:vehicles-updated', handleVehiclesUpdated);
    return () => window.removeEventListener('electravelin:vehicles-updated', handleVehiclesUpdated);
  }, [usuario?.id]);

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
      setMensaje('Perfil actualizado con éxito.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSetHabitual(autoId) {
    setMensaje('');
    setError('');
    try {
      await updateProfile({ vehiculoFavoritoId: autoId });
      setVehiculoFavoritoId(autoId);
      setMensaje('Vehículo habitual actualizado con éxito.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteUserVehicle(id, modelo) {
    if (!window.confirm(`¿Estás seguro de eliminar "${modelo}" de tus vehículos registrados?`)) return;
    try {
      await api.deleteMiVehiculo(id);
      setMisVehiculos((prev) => prev.filter((v) => v.id !== id));
      setVehiculos((prev) => prev.filter((v) => v.id !== id));
      if (vehiculoFavoritoId === id) {
        setVehiculoFavoritoId('');
      }
      setMensaje('Vehículo eliminado con éxito.');
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
        <span aria-hidden="true" className="empty-state__icon">
          <Lock size={32} color="#00d4ff" />
        </span>
        <h2>Inicia sesión para ver tu perfil</h2>
        <p>Registra tu vehículo, guarda tus viajes, marca favoritos y personaliza tu experiencia de ruta.</p>
        <button type="button" className="btn btn--primary" onClick={onRequireAuth}>
          Iniciar sesión
        </button>
      </div>
    );
  }

  const vehiculosOficiales = vehiculos.filter((v) => !v.esPersonalizado);

  return (
    <section className="panel" id="profile-panel">
      {/* 1. Información General y Preferencia */}
      <div className="card">
        <h2 className="card__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <User size={22} color="#00d4ff" /> Mi Perfil de Conductor
        </h2>
        <form onSubmit={handleProfile} className="form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="perfil-nombre">Nombre</label>
            <input
              id="perfil-nombre"
              className="form-input"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="perfil-vehiculo">Vehículo habitual</label>
            <select
              id="perfil-vehiculo"
              className="form-select"
              value={vehiculoFavoritoId}
              onChange={(event) => setVehiculoFavoritoId(event.target.value)}
            >
              <option value="">— Sin preferencia —</option>
              {misVehiculos.length > 0 && (
                <optgroup label="Mis Vehículos Registrados">
                  {misVehiculos.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      ★ {vehicle.marca} {vehicle.modelo} ({vehicle.bateriaUtilizable_kWh} kWh)
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Catálogo Oficial">
                {vehiculosOficiales.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.marca} {vehicle.modelo}
                  </option>
                ))}
              </optgroup>
            </select>
            <span className="form-helper" style={{ fontSize: '0.72rem' }}>
              Este vehículo se preseleccionará automáticamente al planificar tus rutas.
            </span>
          </div>
          <div className="form-group form-group--full">
            <button type="submit" className="btn btn--primary">Guardar cambios de perfil</button>
          </div>
        </form>
        {mensaje && (
          <p className="form-success" role="status" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
            <CheckCircle2 size={15} /> {mensaje}
          </p>
        )}
        {error && <p className="form-error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
        <p className="form-helper" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', marginTop: 12 }}>
          Sesión: {usuario.email} · Rol: {usuario.rol}
        </p>
      </div>

      {/* 2. Sección: Mis Vehículos Registrados (Mi Garaje) */}
      <div className="card" id="mis-vehiculos-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 'var(--space-md)' }}>
          <div>
            <h2 className="card__title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Car size={22} color="var(--accent-cyan)" /> Mis Vehículos Registrados ({misVehiculos.length})
            </h2>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
              Autos agregados por ti con especificaciones técnicas a medida para planificar viajes.
            </span>
          </div>
          <button
            type="button"
            className="btn btn--primary btn--small"
            onClick={() => {
              setVehiculoAEditar(null);
              setModalVehiculoOpen(true);
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={15} /> Registrar mi vehículo
          </button>
        </div>

        {cargando && <p className="form-helper">Cargando vehículos...</p>}

        {!cargando && misVehiculos.length === 0 && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px dashed var(--border-accent)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-lg)',
            textAlign: 'center',
          }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'var(--accent-cyan-dim)',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto var(--space-sm)'
            }}>
              <Car size={22} color="var(--accent-cyan)" />
            </div>
            <h3 style={{ fontSize: '1rem', color: '#fff', marginBottom: 6 }}>
              ¿Tu auto eléctrico no está en el catálogo?
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto var(--space-md)' }}>
              Sube los atributos de tu modelo (batería, potencia de carga y conectores) para tenerlo siempre a mano y calcular tus rutas exactas.
            </p>
            <button
              type="button"
              className="btn btn--primary btn--small"
              onClick={() => {
                setVehiculoAEditar(null);
                setModalVehiculoOpen(true);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={15} /> Registrar mi vehículo ahora
            </button>
          </div>
        )}

        {misVehiculos.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-md)' }}>
            {misVehiculos.map((v) => {
              const esHabitual = usuario?.vehiculoFavoritoId === v.id;
              const autonomiaEst = (v.bateriaUtilizable_kWh > 0 && v.consumoReferencia_kWhPor100km > 0)
                ? Math.round((v.bateriaUtilizable_kWh / v.consumoReferencia_kWhPor100km) * 100)
                : null;

              return (
                <div
                  key={v.id}
                  style={{
                    background: esHabitual ? 'rgba(0, 212, 255, 0.04)' : 'rgba(255, 255, 255, 0.02)',
                    border: esHabitual ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 12,
                    boxShadow: esHabitual ? '0 0 15px rgba(0, 212, 255, 0.1)' : 'none',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                          {v.marca}
                        </span>
                        <h3 style={{ fontSize: '1.05rem', color: '#fff', margin: '2px 0 0', fontFamily: 'var(--font-heading)' }}>
                          {v.modelo}
                        </h3>
                      </div>
                      {esHabitual && (
                        <span style={{
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          color: '#10b981',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          whiteSpace: 'nowrap'
                        }}>
                          ★ HABITUAL
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '10px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <BatteryCharging size={14} color="var(--accent-cyan)" />
                        <span>Batería: <strong>{v.bateriaUtilizable_kWh} kWh</strong></span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Zap size={14} color="#f59e0b" />
                        <span>Carga máx: <strong>{v.potenciaCargaMaxima_kW} kW</strong></span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Gauge size={14} color="#10b981" />
                        <span>Consumo: <strong>{v.consumoReferencia_kWhPor100km}</strong></span>
                      </div>
                      {autonomiaEst && (
                        <div>
                          <span>Autonomía: <strong>~{autonomiaEst} km</strong></span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      {v.conectoresCompatibles?.map((c) => (
                        <span
                          key={c}
                          style={{
                            fontSize: '0.66rem',
                            fontFamily: 'var(--font-mono)',
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: 'rgba(255, 255, 255, 0.06)',
                            color: 'var(--text-primary)',
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                          }}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {!esHabitual && (
                        <button
                          type="button"
                          className="btn btn--ghost btn--small"
                          style={{ fontSize: '0.72rem', padding: '3px 8px', height: 'auto' }}
                          onClick={() => handleSetHabitual(v.id)}
                          title="Fijar como vehículo preferido"
                        >
                          Hacer habitual
                        </button>
                      )}
                      {onNavigate && (
                        <button
                          type="button"
                          className="btn btn--primary btn--small"
                          style={{ fontSize: '0.72rem', padding: '3px 8px', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onClick={() => {
                            updateProfile({ vehiculoFavoritoId: v.id });
                            onNavigate('ruta', 'planificar');
                          }}
                          title="Calcular ruta con este auto"
                        >
                          <Compass size={12} /> Viajar
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn--ghost btn--small"
                        style={{ fontSize: '0.72rem', padding: '3px 8px', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        onClick={() => {
                          setVehiculoAEditar(v);
                          setModalVehiculoOpen(true);
                        }}
                        title="Editar parámetros técnicos"
                      >
                        <Edit2 size={12} /> Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger btn--small"
                        style={{ fontSize: '0.72rem', padding: '3px 8px', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        onClick={() => handleDeleteUserVehicle(v.id, `${v.marca} ${v.modelo}`)}
                        title="Eliminar de mi garaje"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Historial de Viajes Guardados */}
      <div className="card">
        <h2 className="card__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <History size={20} color="#00d4ff" /> Historial de Viajes Guardados
        </h2>
        {cargando && <p className="form-helper">Cargando historial…</p>}
        {!cargando && viajes.length === 0 && <p className="form-helper">Aún no guardas viajes. Planifica uno y presiona “Guardar viaje”.</p>}
        <ul className="list">
          {viajes.map((trip) => (
            <li key={trip.id} className="list__item">
              <div>
                <strong style={{ fontFamily: 'var(--font-heading)', color: '#fff' }}>
                  {trip.origen} → {trip.destino}
                </strong>
                <div className="list__meta" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem' }}>
                  {formatearFecha(trip.creadoEn)} · {trip.resumen?.distanciaTotal_km} km · ${Number(trip.resumen?.costoTotal_CLP || 0).toLocaleString('es-CL')} CLP · {trip.resumen?.cantidadParadas ?? 0} paradas
                </div>
              </div>
              <button
                type="button"
                className="btn btn--danger btn--small"
                onClick={() => handleDeleteTrip(trip.id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <Trash2 size={12} /> Eliminar
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* 4. Favoritos Guardados */}
      <div className="card">
        <h2 className="card__title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Star size={20} color="#f59e0b" fill="#f59e0b" /> Favoritos Guardados
        </h2>
        {!cargando && favoritos.length === 0 && <p className="form-helper">Marca vehículos y estaciones desde la pestaña Catálogo.</p>}
        <ul className="list">
          {favoritos.map((favorite) => (
            <li key={favorite.id} className="list__item">
              <div>
                <strong style={{ fontFamily: 'var(--font-heading)', color: '#fff' }}>
                  {favorite.referencia?.nombre || favorite.referencia?.modelo || favorite.referenciaId}
                </strong>
                <div className="list__meta" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem' }}>
                  {favorite.tipo === 'vehiculo' ? 'Vehículo' : 'Estación'}{favorite.referencia?.ciudad ? ` · ${favorite.referencia.ciudad}` : ''}
                </div>
              </div>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => handleRemoveFavorite(favorite.id)}>
                Quitar
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Modal para agregar/editar vehículo */}
      {modalVehiculoOpen && (
        <CustomVehicleModal
          vehiculo={vehiculoAEditar}
          onClose={() => {
            setModalVehiculoOpen(false);
            setVehiculoAEditar(null);
          }}
          onSuccess={() => {
            cargarDatos();
          }}
        />
      )}
    </section>
  );
}
