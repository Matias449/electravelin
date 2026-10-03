import React, { useState, useEffect } from 'react';
import { fetchVehiculos, fetchCiudades, calcularRuta } from '../utils/api';
import { useAuth } from '../context/AuthContext';

/**
 * PlanningForm — Formulario principal de planificación de viaje (RF01-RF05, RF20).
 *
 * Inputs:
 *  - Origen (selector de ciudad)
 *  - Destino (selector de ciudad)
 *  - Vehículo eléctrico (selector del catálogo)
 *  - Batería inicial (slider 0-100%)
 *
 * Validación:
 *  - No permite inputs vacíos ni fuera de rango.
 *  - Estado "Cargando..." en el botón para evitar doble envío (RF20).
 *
 * @param {{ onResult: (data: Object) => void }} props
 */
export default function PlanningForm({ onResult }) {
  const { usuario } = useAuth();
  // ─── State: catálogos ──────────────────────────────────────────────────
  const [vehiculos, setVehiculos] = useState([]);
  const [ciudades, setCiudades] = useState([]);
  const [loadingCatalogos, setLoadingCatalogos] = useState(true);
  const [errorCatalogos, setErrorCatalogos] = useState('');

  // ─── State: formulario ─────────────────────────────────────────────────
  const [origenId, setOrigenId] = useState('');
  const [destinoId, setDestinoId] = useState('');
  const [vehiculoId, setVehiculoId] = useState('');
  const [socInicial, setSocInicial] = useState(80);

  // ─── State: UX ────────────────────────────────────────────────────────
  const [cargando, setCargando] = useState(false);
  const [errores, setErrores] = useState({});

  // ─── Cargar catálogos al montar ────────────────────────────────────────
  useEffect(() => {
    let active = true;
    async function cargarDatos() {
      try {
        const [vehiculosData, ciudadesData] = await Promise.all([
          fetchVehiculos(),
          fetchCiudades(),
        ]);
        if (!active) return;
        setVehiculos(vehiculosData);
        setCiudades(ciudadesData);
      } catch (err) {
        if (active) setErrorCatalogos(err.message || 'No se pudo cargar el catálogo.');
      } finally {
        if (active) setLoadingCatalogos(false);
      }
    }
    cargarDatos();
    return () => { active = false; };
  }, []);

  // Preselecciona el vehículo habitual del perfil, si existe.
  useEffect(() => {
    if (usuario?.vehiculoFavoritoId && vehiculos.some((vehicle) => vehicle.id === usuario.vehiculoFavoritoId)) {
      setVehiculoId(usuario.vehiculoFavoritoId);
    }
  }, [usuario, vehiculos]);

  // ─── Validación ───────────────────────────────────────────────────────
  function validar() {
    const nuevosErrores = {};

    if (!origenId) nuevosErrores.origen = 'Selecciona una ciudad de origen';
    if (!destinoId) nuevosErrores.destino = 'Selecciona una ciudad de destino';
    if (origenId && destinoId && origenId === destinoId) {
      nuevosErrores.destino = 'El destino debe ser diferente al origen';
    }
    if (!vehiculoId) nuevosErrores.vehiculo = 'Selecciona un vehículo';

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  // ─── Envío del formulario ─────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();

    if (!validar()) return;

    setCargando(true);
    setErrores({});

    try {
      const consulta = { origenId, destinoId, vehiculoId, socInicial };
      const resultado = await calcularRuta(consulta);
      onResult(resultado, consulta);
    } catch (err) {
      onResult({
        exito: false,
        error: err.message || 'Error de conexión con el servidor.',
      });
    } finally {
      setCargando(false);
    }
  }

  // ─── Obtener info del vehículo seleccionado ───────────────────────────
  const vehiculoSeleccionado = vehiculos.find((v) => v.id === vehiculoId);

  return (
    <div className="card">
      <h2 className="card__title">
        <span className="card__title-icon">🗺️</span>
        Planifica tu Viaje
      </h2>

      <form onSubmit={handleSubmit} id="planning-form">
        {errorCatalogos && <div className="error-banner error-banner--compact" role="alert">{errorCatalogos}</div>}
        <div className="form-grid">
          {/* Origen */}
          <div className="form-group">
            <label className="form-label" htmlFor="input-origen">
              Ciudad de Origen
            </label>
            <select
              id="input-origen"
              className={`form-select ${errores.origen ? 'form-input--error' : ''}`}
              value={origenId}
              onChange={(e) => setOrigenId(e.target.value)}
              disabled={loadingCatalogos}
            >
              <option value="">— Selecciona origen —</option>
              {ciudades.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            {errores.origen && <span className="form-error">{errores.origen}</span>}
          </div>

          {/* Destino */}
          <div className="form-group">
            <label className="form-label" htmlFor="input-destino">
              Ciudad de Destino
            </label>
            <select
              id="input-destino"
              className={`form-select ${errores.destino ? 'form-input--error' : ''}`}
              value={destinoId}
              onChange={(e) => setDestinoId(e.target.value)}
              disabled={loadingCatalogos}
            >
              <option value="">— Selecciona destino —</option>
              {ciudades.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            {errores.destino && (
              <span className="form-error">{errores.destino}</span>
            )}
          </div>

          {/* Vehículo */}
          <div className="form-group form-group--full">
            <label className="form-label" htmlFor="input-vehiculo">
              Vehículo Eléctrico
            </label>
            <select
              id="input-vehiculo"
              className={`form-select ${errores.vehiculo ? 'form-input--error' : ''}`}
              value={vehiculoId}
              onChange={(e) => setVehiculoId(e.target.value)}
              disabled={loadingCatalogos}
            >
              <option value="">— Selecciona tu vehículo —</option>
              {vehiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.modelo} — {v.bateriaUtilizable_kWh} kWh | {v.consumoReferencia_kWhPor100km} kWh/100km
                </option>
              ))}
            </select>
            {errores.vehiculo && (
              <span className="form-error">{errores.vehiculo}</span>
            )}
            {vehiculoSeleccionado && (
              <span className="form-helper">
                Conectores: {vehiculoSeleccionado.conectoresCompatibles.join(', ')} · 
                Carga máx: {vehiculoSeleccionado.potenciaCargaMaxima_kW} kW
              </span>
            )}
          </div>

          {/* Batería inicial */}
          <div className="form-group form-group--full">
            <div className="battery-slider-container">
              <div className="battery-slider-header">
                <label className="form-label" htmlFor="input-bateria">
                  Batería Inicial
                </label>
                <span className="battery-value">{socInicial}%</span>
              </div>
              <input
                id="input-bateria"
                type="range"
                className="battery-slider"
                min="0"
                max="100"
                step="1"
                value={socInicial}
                onChange={(e) => setSocInicial(Number(e.target.value))}
                style={{
                  background: `linear-gradient(to right, #00d4ff ${socInicial}%, rgba(15, 22, 40, 0.9) ${socInicial}%)`,
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="form-helper">0%</span>
                <span className="form-helper">100%</span>
              </div>
            </div>
          </div>

          {/* Botón de envío (RF20: estado cargando) */}
          <div className="form-group form-group--full">
            <button
              id="btn-calcular"
              type="submit"
              className="btn btn--primary btn--full"
              disabled={cargando || loadingCatalogos}
            >
              {cargando ? (
                <>
                  <span className="spinner" aria-hidden="true"></span>
                  Calculando ruta...
                </>
              ) : (
                <>⚡ Calcular Ruta</>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
