import React, { useState, useEffect } from 'react';
import { fetchVehiculos, fetchCiudades, calcularRuta } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Vehicle3DViewer from './Vehicle3DViewer';
import ConnectorBlueprint from './ConnectorBlueprint';
import { Compass, MapPin, Navigation, Car, Zap, Battery, ShieldAlert, Cpu } from 'lucide-react';

/**
 * PlanningForm — Formulario principal de planificación de viaje (RF01-RF05, RF20)
 * Mejorado con Visor 3D Interactivo en Tiempo Real, Telemetría y Blueprints de Conectores.
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
  const [showBlueprint, setShowBlueprint] = useState(false);

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

        // Preselecciona el primer vehículo si no hay uno seleccionado
        if (vehiculosData.length > 0 && !vehiculoId) {
          setVehiculoId(vehiculosData[0].id);
        }
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
  const vehiculoSeleccionado = vehiculos.find((v) => v.id === vehiculoId) || vehiculos[0];

  // Normalizar datos para el visor 3D
  const activeVehicle3D = vehiculoSeleccionado ? {
    marca: vehiculoSeleccionado.marca || vehiculoSeleccionado.modelo?.split(' ')[0] || 'EV',
    modelo: vehiculoSeleccionado.modelo,
    bateria_util_kWh: vehiculoSeleccionado.bateriaUtilizable_kWh,
    consumo_medio_kWh_100km: vehiculoSeleccionado.consumoReferencia_kWhPor100km,
    potencia_carga_max_kW: vehiculoSeleccionado.potenciaCargaMaxima_kW,
    conectores: vehiculoSeleccionado.conectoresCompatibles,
  } : null;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
        <h2 className="card__title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Compass size={22} color="#00d4ff" />
          Planifica tu Viaje
        </h2>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
          RUTA 5 SUR
        </span>
      </div>

      {/* Visor 3D Interactivo del Vehículo con Celdas de Batería Reales */}
      {activeVehicle3D && (
        <Vehicle3DViewer
          vehiculo={activeVehicle3D}
          soc={socInicial}
          isCharging={cargando}
        />
      )}

      <form onSubmit={handleSubmit} id="planning-form">
        {errorCatalogos && <div className="error-banner error-banner--compact" role="alert">{errorCatalogos}</div>}
        <div className="form-grid">
          {/* Origen */}
          <div className="form-group">
            <label className="form-label" htmlFor="input-origen" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Navigation size={13} color="#00d4ff" /> Ciudad de Origen
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
            <label className="form-label" htmlFor="input-destino" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <MapPin size={13} color="#10b981" /> Ciudad de Destino
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
            <label className="form-label" htmlFor="input-vehiculo" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Car size={13} color="#00d4ff" /> Vehículo Eléctrico
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <span className="form-helper">
                  Conector: <strong>{vehiculoSeleccionado.conectoresCompatibles?.join(', ')}</strong> · Carga máx: <strong>{vehiculoSeleccionado.potenciaCargaMaxima_kW} kW DC</strong>
                </span>
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  style={{ fontSize: '0.72rem', padding: '3px 8px', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  onClick={() => setShowBlueprint(!showBlueprint)}
                >
                  <Cpu size={12} /> {showBlueprint ? 'Ocultar Blueprint' : 'Ver Blueprint Pinout'}
                </button>
              </div>
            )}

            {/* Blueprint Técnico Desplegable */}
            {showBlueprint && vehiculoSeleccionado && (
              <ConnectorBlueprint
                conector={vehiculoSeleccionado.conectoresCompatibles?.[0] || 'CCS2'}
                potenciaKw={vehiculoSeleccionado.potenciaCargaMaxima_kW || 100}
                active={true}
              />
            )}
          </div>

          {/* Batería inicial */}
          <div className="form-group form-group--full">
            <div className="battery-slider-container">
              <div className="battery-slider-header">
                <label className="form-label" htmlFor="input-bateria" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Battery size={14} color="#00d4ff" /> Nivel de Batería de Salida (SoC)
                </label>
                <span className="battery-value" style={{ fontFamily: 'var(--font-mono)' }}>{socInicial}%</span>
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
                  background: `linear-gradient(to right, ${socInicial < 20 ? '#ef4444' : '#00d4ff'} ${socInicial}%, rgba(15, 22, 40, 0.9) ${socInicial}%)`,
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginTop: 4 }}>
                <span style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <ShieldAlert size={11} /> 15% Reserva Mínima
                </span>
                <span>50%</span>
                <span style={{ color: '#00d4ff' }}>80% Carga Rápida</span>
                <span>100%</span>
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
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {cargando ? (
                <>
                  <span className="spinner" aria-hidden="true"></span>
                  Calculando estrategia de ruta...
                </>
              ) : (
                <>
                  <Zap size={16} /> Calcular Ruta y Paradas
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
