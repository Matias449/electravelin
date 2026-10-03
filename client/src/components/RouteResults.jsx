import React, { useEffect, useState } from 'react';
import StopCard from './StopCard';
import RouteMap from './RouteMap';
import { useAuth } from '../context/AuthContext';
import { saveTrip } from '../utils/api';

/**
 * RouteResults — Visualización completa de los resultados del cálculo de ruta.
 *
 * Muestra:
 *  - Mapa Leaflet con trazado, marcadores y zoom automático (RF16)
 *  - Resumen global: distancia, tiempo conducción, tiempo carga, costo total (RF18)
 *  - Timeline de paradas de recarga (RF17)
 *  - Manejo de errores: mensaje claro si no hay ruta factible (RF15)
 *
 * @param {{ resultado: Object, consulta: Object, onRequireAuth: Function }} props
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
          <span className="error-banner__icon" aria-hidden="true">⚠️</span>
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
            <h3>Electrolineras compatibles cerca del origen</h3>
            <p>Antes de salir, carga en una de estas estaciones y vuelve a calcular la ruta.</p>
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

  /**
   * Formatea minutos a horas y minutos legibles.
   * Ej: 145 min → "2h 25min"
   */
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
        <h2>
          <span aria-hidden="true">📍</span>
          {origen?.nombre} → {destino?.nombre}
        </h2>
        {vehiculo && (
          <span className="vehicle-tag">
            <span aria-hidden="true">🚗</span>
            {vehiculo.modelo} · {vehiculo.bateriaUtilizable_kWh} kWh
          </span>
        )}
        <div className="results-header__actions">
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={handleGuardar}
            disabled={guardando || guardado}
          >
            {guardado ? '✓ Guardado' : guardando ? 'Guardando…' : usuario ? 'Guardar viaje' : 'Inicia sesión para guardar'}
          </button>
          {errorGuardar && <span className="form-error">{errorGuardar}</span>}
        </div>
      </div>

      <RouteMap geometry={geometry} origen={origen} destino={destino} paradas={paradas} />

      {advertencias.length > 0 && (
        <div className="warning-banner" role="status">
          <span aria-hidden="true">⚠️</span>
          <span>{advertencias.join(' ')}</span>
        </div>
      )}

      {/* Resumen global (RF18) */}
      <div className="summary-grid" id="summary-grid">
        <div className="summary-card">
          <div className="summary-card__icon" aria-hidden="true">📏</div>
          <div className="summary-card__value">{resumen.distanciaTotal_km} km</div>
          <div className="summary-card__label">Distancia Total</div>
        </div>

        <div className="summary-card">
          <div className="summary-card__icon" aria-hidden="true">🚗</div>
          <div className="summary-card__value">
            {formatearTiempo(resumen.tiempoConduccionTotal_min)}
          </div>
          <div className="summary-card__label">Conducción</div>
        </div>

        <div className="summary-card">
          <div className="summary-card__icon" aria-hidden="true">🔋</div>
          <div className="summary-card__value">
            {formatearTiempo(resumen.tiempoCargaTotal_min)}
          </div>
          <div className="summary-card__label">Tiempo de Carga</div>
        </div>

        <div className="summary-card">
          <div className="summary-card__icon" aria-hidden="true">⏱️</div>
          <div className="summary-card__value">
            {formatearTiempo(resumen.tiempoTotalViaje_min)}
          </div>
          <div className="summary-card__label">Tiempo Total</div>
        </div>

        <div className="summary-card">
          <div className="summary-card__icon" aria-hidden="true">💰</div>
          <div className="summary-card__value">
            {resumen.costoTotal_CLP != null ? `$${resumen.costoTotal_CLP.toLocaleString('es-CL')}` : 'No disponible'}
          </div>
          <div className="summary-card__label">Costo Total (CLP)</div>
        </div>

        <div className="summary-card">
          <div className="summary-card__icon" aria-hidden="true">🔌</div>
          <div className="summary-card__value">{resumen.cantidadParadas}</div>
          <div className="summary-card__label">Paradas de Carga</div>
        </div>

        <div className="summary-card">
          <div className="summary-card__icon" aria-hidden="true">🔋</div>
          <div className="summary-card__value">{resumen.socFinal.toFixed(1)}%</div>
          <div className="summary-card__label">Batería al Llegar</div>
        </div>
      </div>

      {/* Timeline de paradas (RF17) */}
      {paradas.length > 0 ? (
        <>
          <h3 style={{ marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span aria-hidden="true">⚡</span>
            Paradas de Recarga
          </h3>
          <div className="stops-timeline" id="stops-timeline">
            {paradas.map((parada, idx) => (
              <StopCard key={parada.estacionId} parada={parada} index={idx} />
            ))}
          </div>
        </>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
          <span style={{ fontSize: '2rem' }} aria-hidden="true">🎉</span>
          <h3 style={{ marginTop: 'var(--space-md)', marginBottom: 'var(--space-sm)' }}>
            ¡Sin paradas necesarias!
          </h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Tu vehículo tiene suficiente autonomía para completar el viaje sin detenerse a cargar.
          </p>
        </div>
      )}
    </div>
  );
}
