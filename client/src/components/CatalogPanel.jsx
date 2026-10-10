// CatalogPanel.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import StationsMap from './StationsMap';
import * as api from '../utils/api';
import { Search, Car, Zap, Star, Filter, ShieldCheck } from 'lucide-react';

const CONECTORES = ['', 'CCS2', 'CHAdeMO'];

export default function CatalogPanel({ onRequireAuth }) {
  const { usuario } = useAuth();
  const [tipo, setTipo] = useState('vehiculos');
  const [filtros, setFiltros] = useState({ texto: '', conector: '', potenciaMin: '' });
  const [vehiculos, setVehiculos] = useState([]);
  const [estaciones, setEstaciones] = useState([]);
  const [favoritos, setFavoritos] = useState([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [estacionSeleccionada, setEstacionSeleccionada] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setCargando(true);
      setError('');
      try {
        const query = tipo === 'vehiculos'
          ? { marca: filtros.texto, conector: filtros.conector, potenciaMin: filtros.potenciaMin }
          : { ciudad: filtros.texto, operador: filtros.texto, conector: filtros.conector, potenciaMin: filtros.potenciaMin };
        if (tipo === 'vehiculos') {
          const data = await api.fetchVehiculos(query);
          if (active) setVehiculos(data);
        } else {
          const data = await api.fetchEstaciones(query);
          if (active) setEstaciones(data);
        }
        if (usuario) {
          const favoritosData = await api.fetchFavorites();
          if (active) setFavoritos(favoritosData);
        } else {
          setFavoritos([]);
        }
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setCargando(false);
      }
    }
    const timer = setTimeout(load, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [tipo, filtros, usuario]);

  function esFavorito(referenciaId, tipoFavorito) {
    return favoritos.some((favorite) => favorite.referenciaId === referenciaId && favorite.tipo === tipoFavorito);
  }

  async function toggleFavorito(tipoFavorito, referenciaId) {
    if (!usuario) {
      onRequireAuth();
      return;
    }
    const existente = favoritos.find((favorite) => favorite.referenciaId === referenciaId && favorite.tipo === tipoFavorito);
    try {
      if (existente) {
        await api.removeFavorite(existente.id);
        setFavoritos((prev) => prev.filter((favorite) => favorite.id !== existente.id));
      } else {
        const nuevo = await api.addFavorite({ tipo: tipoFavorito, referenciaId });
        setFavoritos((prev) => [...prev, { ...nuevo, tipo: tipoFavorito, referenciaId }]);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="panel" id="catalog-panel">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
          <h2 className="card__title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={22} color="#00d4ff" /> Catálogo Técnico
          </h2>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            SEC CHILE · RED RUTA 5
          </span>
        </div>

        <div className="tab-row" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tipo === 'vehiculos'}
            className={`tab ${tipo === 'vehiculos' ? 'tab--active' : ''}`}
            onClick={() => setTipo('vehiculos')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Car size={15} /> Vehículos ({vehiculos.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tipo === 'estaciones'}
            className={`tab ${tipo === 'estaciones' ? 'tab--active' : ''}`}
            onClick={() => setTipo('estaciones')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Zap size={15} /> Electrolineras ({estaciones.length})
          </button>
        </div>

        <div className="filter-bar">
          <input
            className="form-input"
            placeholder={tipo === 'vehiculos' ? 'Buscar por marca o modelo…' : 'Buscar por ciudad u operador…'}
            value={filtros.texto}
            onChange={(event) => setFiltros({ ...filtros, texto: event.target.value })}
            aria-label="Texto de búsqueda"
          />
          <select className="form-select" value={filtros.conector} onChange={(event) => setFiltros({ ...filtros, conector: event.target.value })} aria-label="Conector">
            <option value="">Todos los conectores</option>
            {CONECTORES.filter(Boolean).map((conector) => (
              <option key={conector} value={conector}>{conector}</option>
            ))}
          </select>
          <select className="form-select" value={filtros.potenciaMin} onChange={(event) => setFiltros({ ...filtros, potenciaMin: event.target.value })} aria-label="Potencia mínima">
            <option value="">Potencia mínima</option>
            <option value="50">50+ kW (Rápida)</option>
            <option value="100">100+ kW (Ultra-rápida)</option>
            <option value="150">150+ kW (High Power)</option>
          </select>
        </div>

        {error && <div className="error-banner error-banner--compact" role="alert">{error}</div>}
        {cargando && <p className="form-helper">Consultando base de datos oficial…</p>}

        {tipo === 'vehiculos' && (
          <ul className="list">
            {vehiculos.map((vehicle) => {
              const fav = esFavorito(vehicle.id, 'vehiculo');
              return (
                <li key={vehicle.id} className="list__item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: '#fff' }}>
                        {vehicle.marca} {vehicle.modelo}
                      </strong>
                      {(vehicle.tieneModelo3D || vehicle.id?.includes('tesla')) ? (
                        <span style={{
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          color: '#10b981',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          padding: '2px 6px',
                          borderRadius: 4
                        }}>
                          ★ 3D REAL (GLB)
                        </span>
                      ) : (
                        <span style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#94a3b8',
                          fontSize: '0.68rem',
                          fontFamily: 'var(--font-mono)',
                          padding: '2px 6px',
                          borderRadius: 4
                        }}>
                          FICHA 2D
                        </span>
                      )}
                    </div>
                    <div className="list__meta" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', marginTop: 4 }}>
                      <span style={{ color: '#00d4ff' }}>{vehicle.bateriaUtilizable_kWh} kWh</span> · {vehicle.consumoReferencia_kWhPor100km} kWh/100km · Potencia máx: <strong>{vehicle.potenciaCargaMaxima_kW} kW</strong> · Conectores: {vehicle.conectoresCompatibles.join(', ')}
                    </div>
                  <button
                    type="button"
                    className={`btn btn--small ${fav ? 'btn--ghost' : 'btn--primary'}`}
                    onClick={() => toggleFavorito('vehiculo', vehicle.id)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                  >
                    <Star size={13} fill={fav ? '#f59e0b' : 'none'} color={fav ? '#f59e0b' : 'currentColor'} />
                    {fav ? 'Favorito' : 'Guardar'}
                  </button>
                </li>
              );
            })}
            {!cargando && vehiculos.length === 0 && <li className="list__empty">Sin resultados con esos filtros.</li>}
          </ul>
        )}

        {tipo === 'estaciones' && (
          <div className="stations-explorer">
            <section className="stations-explorer__map">
              <StationsMap
                estaciones={estaciones}
                seleccionada={estacionSeleccionada}
                onSelect={setEstacionSeleccionada}
              />
            </section>
            <ul className="list">
              {estaciones.map((station) => {
                const fav = esFavorito(station.id, 'estacion');
                return (
                  // <li key={station.id} className="list__item">
                  <li key={station.id} 
                    className={`list__item station-list-item ${
                      String(estacionSeleccionada?.id) === String(station.id) ? 'station-list-item--selected' : ''
                    }`}
                    onClick={() => setEstacionSeleccionada(station)}
                  >
                    <div>
                      <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: '#fff' }}>
                        {station.nombre}
                      </strong>
                      <div className="list__meta" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', marginTop: 4 }}>
                        {station.ciudad}{station.region ? ` · ${station.region}` : ''} · <span style={{ color: '#00d4ff' }}>{station.operador}</span> · <strong>{station.potenciaMaxima_kW} kW</strong> · {station.conectoresDisponibles.join(', ')} · ${station.tarifa_CLPporKWh}/kWh
                        {station.verificada && (
                          <span className="badge badge--verified" style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <ShieldCheck size={11} /> SEC
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`btn btn--small ${fav ? 'btn--ghost' : 'btn--primary'}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleFavorito('estacion', station.id);
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    >
                      <Star size={13} fill={fav ? '#f59e0b' : 'none'} color={fav ? '#f59e0b' : 'currentColor'} />
                      {fav ? 'Favorito' : 'Guardar'}
                    </button>
                  </li>
                );
              })}
              {!cargando && estaciones.length === 0 && <li className="list__empty">Sin resultados con esos filtros.</li>}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
