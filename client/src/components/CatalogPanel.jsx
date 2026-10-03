import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as api from '../utils/api';

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
        <h2 className="card__title"><span aria-hidden="true">🔎</span> Catálogo</h2>

        <div className="tab-row" role="tablist">
          <button type="button" role="tab" aria-selected={tipo === 'vehiculos'} className={`tab ${tipo === 'vehiculos' ? 'tab--active' : ''}`} onClick={() => setTipo('vehiculos')}>
            Vehículos
          </button>
          <button type="button" role="tab" aria-selected={tipo === 'estaciones'} className={`tab ${tipo === 'estaciones' ? 'tab--active' : ''}`} onClick={() => setTipo('estaciones')}>
            Estaciones
          </button>
        </div>

        <div className="filter-bar">
          <input
            className="form-input"
            placeholder={tipo === 'vehiculos' ? 'Buscar por marca…' : 'Buscar por ciudad u operador…'}
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
            <option value="50">50+ kW</option>
            <option value="100">100+ kW</option>
            <option value="150">150+ kW</option>
          </select>
        </div>

        {error && <div className="error-banner error-banner--compact" role="alert">{error}</div>}
        {cargando && <p className="form-helper">Cargando catálogo…</p>}

        {tipo === 'vehiculos' ? (
          <ul className="list">
            {vehiculos.map((vehicle) => (
              <li key={vehicle.id} className="list__item">
                <div>
                  <strong>{vehicle.marca} {vehicle.modelo}</strong>
                  <div className="list__meta">
                    {vehicle.bateriaUtilizable_kWh} kWh · {vehicle.consumoReferencia_kWhPor100km} kWh/100km · {vehicle.potenciaCargaMaxima_kW} kW · {vehicle.conectoresCompatibles.join(', ')}
                  </div>
                </div>
                <button
                  type="button"
                  className={`btn btn--small ${esFavorito(vehicle.id, 'vehiculo') ? 'btn--ghost' : 'btn--primary'}`}
                  onClick={() => toggleFavorito('vehiculo', vehicle.id)}
                >
                  {esFavorito(vehicle.id, 'vehiculo') ? '★ Favorito' : '☆ Guardar'}
                </button>
              </li>
            ))}
            {!cargando && vehiculos.length === 0 && <li className="list__empty">Sin resultados con esos filtros.</li>}
          </ul>
        ) : (
          <ul className="list">
            {estaciones.map((station) => (
              <li key={station.id} className="list__item">
                <div>
                  <strong>{station.nombre}</strong>
                  <div className="list__meta">
                    {station.ciudad}{station.region ? ` · ${station.region}` : ''} · {station.operador} · {station.potenciaMaxima_kW} kW · {station.conectoresDisponibles.join(', ')} · ${station.tarifa_CLPporKWh}/kWh
                    {station.verificada && <span className="badge badge--verified">verificada</span>}
                  </div>
                </div>
                <button
                  type="button"
                  className={`btn btn--small ${esFavorito(station.id, 'estacion') ? 'btn--ghost' : 'btn--primary'}`}
                  onClick={() => toggleFavorito('estacion', station.id)}
                >
                  {esFavorito(station.id, 'estacion') ? '★ Favorito' : '☆ Guardar'}
                </button>
              </li>
            ))}
            {!cargando && estaciones.length === 0 && <li className="list__empty">Sin resultados con esos filtros.</li>}
          </ul>
        )}
      </div>
    </section>
  );
}
