import React, { useEffect, useState } from 'react';
import StopCard from './StopCard';
import RouteMap from './RouteMap';
import BatteryProfileChart from './BatteryProfileChart';
import { useAuth } from '../context/AuthContext';
import { saveTrip } from '../utils/api';
import {
  MapPin,
  Car,
  Route,
  Clock,
  BatteryCharging,
  Zap,
  Coins,
  AlertTriangle,
  Bookmark,
  CheckCircle,
  Sparkles
} from 'lucide-react';

/**
 * RouteResults — Visualización de resultados del cálculo de ruta
 * Enriquecido con Gráfico Dinámico de Batería, Telemetría y Lucide Icons.
 */
export default function RouteResults({ resultado, consulta, onRequireAuth }) {
  const { usuario } = useAuth();
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState('');

  useEffect(() => {
    setGuardando(false);
    setGuardado(false);
    setErrorGuardar('');
  }, [resultado]);

  if (!resultado) return null;

  // ─── Ruta no factible (RF15): error sin romper la UI ─────────────────
  if (!resultado.exito) {
    const coberturaInsuficiente = resultado.code === 'INSUFFICIENT_COVERAGE';
    const estacionesOrigen = resultado.estacionesOrigenCompatibles || [];
    return (
      <div className="results-section" id="results-error">
        <div className="error-banner">
          <span className="error-banner__icon" aria-hidden="true">
            <AlertTriangle size={24} color="#f59e0b" />
          </span>
          <div>
            <p className="error-banner__title">
              {coberturaInsuficiente ? 'Cobertura insuficiente en el tramo' : 'Ruta no factible'}
            </p>
            <p className="error-banner__message">
              {resultado.error ||
                'No se pudo calcular una ruta válida con los parámetros proporcionados. Intenta con una mayor carga inicial o un vehículo con mayor autonomía.'}
            </p>
          </div>
        </div>
        {estacionesOrigen.length > 0 && (
          <div className="card route-alternatives" role="status">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={18} color="#00d4ff" /> Electrolineras compatibles cerca del origen
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
              Antes de salir a la Ruta 5, recarga en una de estas estaciones para alcanzar la siguiente parada sin bajar del 15% de reserva.
            </p>
            <ul className="route-alternatives__list">
              {estacionesOrigen.map((estacion) => (
                <li key={estacion.id}>
                  <strong>{estacion.nombre}</strong>
                  <span>{estacion.ciudad} · {estacion.conector} · {estacion.potenciaMaxima_kW} kW · a {estacion.distanciaKm} km</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const { resumen, paradas, origen, destino, vehiculo, geometry, advertencias = [] } = resultado;

  async function handleGuardar() {
    if (!usuario) {
      onRequireAuth?.();
      return;
    }
    setErrorGuardar('');
    setGuardando(true);
    try {
      await saveTrip({
        origen: origen?.nombre || 'Origen',
        destino: destino?.nombre || 'Destino',
        vehiculoId: vehiculo?.id,
        socInicial: consulta?.socInicial ?? 100,
        resumen,
        paradas,
        geometry,
        advertencias,
      });
      setGuardado(true);
    } catch (error) {
      setErrorGuardar(error.message);
    } finally {
      setGuardando(false);
    }
  }

  function formatearTiempo(minutos) {
    if (minutos < 60) return `${minutos} min`;
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return mins > 0 ? `${horas}h ${mins}min` : `${horas}h`;
  }

  return (
    <div className="results-section" id="results-section">
      {/* Header de resultados */}
      <div className="results-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={22} color="#00d4ff" />
          {origen?.nombre} → {destino?.nombre}
        </h2>
        {vehiculo && (
          <span className="vehicle-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Car size={14} />
            {vehiculo.modelo} · {vehiculo.bateriaUtilizable_kWh} kWh
          </span>
        )}
        <div className="results-header__actions">
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={handleGuardar}
            disabled={guardando || guardado}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {guardado ? (
              <>
                <CheckCircle size={14} color="#10b981" /> Guardado
              </>
            ) : guardando ? (
              'Guardando…'
            ) : usuario ? (
              <>
                <Bookmark size={14} /> Guardar viaje
              </>
            ) : (
              'Inicia sesión para guardar'
            )}
          </button>
          {errorGuardar && <span className="form-error">{errorGuardar}</span>}
        </div>
      </div>

      {/* Mapa interactivo de la ruta */}
      <RouteMap geometry={geometry} origen={origen} destino={destino} paradas={paradas} />

      {advertencias.length > 0 && (
        <div className="warning-banner" role="status">
          <AlertTriangle size={18} color="#f59e0b" style={{ flexShrink: 0 }} />
          <span>{advertencias.join(' ')}</span>
        </div>
      )}

      {/* Resumen global con iconos automotrices */}
      <div className="summary-grid" id="summary-grid">
        <div className="summary-card">
          <div className="summary-card__icon" aria-hidden="true">
            <Route size={22} color="#00d4ff" />
          </div>
          <div className="summary-card__value">{resumen.distanciaTotal_km} km</div>
          <div className="summary-card__label">Distancia Total</div>
        </div>

        <div className="summary-card">
          <div className="summary-card__icon" aria-hidden="true">
            <Clock size={22} color="#00d4ff" />
          </div>
          <div className="summary-card__value">
            {formatearTiempo(resumen.tiempoConduccionTotal_min)}
          </div>
          <div className="summary-card__label">Conducción</div>
        </div>

        <div className="summary-card">
          <div className="summary-card__icon" aria-hidden="true">
            <BatteryCharging size={22} color="#10b981" />
          </div>
          <div className="summary-card__value">
            {formatearTiempo(resumen.tiempoCargaTotal_min)}
          </div>
          <div className="summary-card__label">Tiempo de Carga</div>
        </div>

        <div className="summary-card">
          <div className="summary-card__icon" aria-hidden="true">
            <Clock size={22} color="#f59e0b" />
          </div>
          <div className="summary-card__value">
            {formatearTiempo(resumen.tiempoTotalViaje_min)}
          </div>
          <div className="summary-card__label">Tiempo Total</div>
        </div>

        <div className="summary-card">
          <div className="summary-card__icon" aria-hidden="true">
            <Coins size={22} color="#10b981" />
          </div>
          <div className="summary-card__value">
            {resumen.costoTotal_CLP != null ? `$${resumen.costoTotal_CLP.toLocaleString('es-CL')}` : 'No disponible'}
          </div>
          <div className="summary-card__label">Costo Estimado CLP</div>
        </div>

        <div className="summary-card">
          <div className="summary-card__icon" aria-hidden="true">
            <Zap size={22} color="#00d4ff" />
          </div>
          <div className="summary-card__value">{resumen.cantidadParadas}</div>
          <div className="summary-card__label">Paradas de Carga</div>
        </div>

        <div className="summary-card">
          <div className="summary-card__icon" aria-hidden="true">
            <BatteryCharging size={22} color={resumen.socFinal < 20 ? '#ef4444' : '#10b981'} />
          </div>
          <div className="summary-card__value">{resumen.socFinal.toFixed(1)}%</div>
          <div className="summary-card__label">Batería en Destino</div>
        </div>
      </div>

      {/* Gráfico Dinámico de Descarga de Batería y Reserva */}
      <BatteryProfileChart
        socInicial={consulta?.socInicial ?? 80}
        paradas={paradas}
        socFinal={resumen.socFinal}
        distanciaTotalKm={resumen.distanciaTotal_km}
      />

      {/* Timeline de paradas (RF17) */}
      {paradas.length > 0 ? (
        <>
          <h3 style={{ marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={20} color="#00d4ff" />
            Paradas de Recarga Programadas
          </h3>
          <div className="stops-timeline" id="stops-timeline">
            {paradas.map((parada, idx) => (
              <StopCard key={parada.estacionId} parada={parada} index={idx} />
            ))}
          </div>
        </>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
          <Sparkles size={36} color="#10b981" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ marginTop: 'var(--space-md)', marginBottom: 'var(--space-sm)' }}>
            ¡Ruta Directa Sin Paradas!
          </h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Tu vehículo tiene suficiente autonomía para completar el viaje sin detenerse a cargar, llegando con {resumen.socFinal.toFixed(1)}% de batería.
          </p>
        </div>
      )}
    </div>
  );
}
