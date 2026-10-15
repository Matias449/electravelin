import React, { useState } from 'react';
import ConnectorBlueprint from './ConnectorBlueprint';
import {
  Zap,
  Clock,
  Coins,
  BatteryCharging,
  Cpu,
  MapPin,
  ShieldCheck,
  Calendar,
  AlertCircle
} from 'lucide-react';

/**
 * StopCard — Tarjeta técnica de parada de recarga con transferencia visual de SoC,
 * telemetría de potencia, metadatos de procedencia oficial (RF17 & RF10)
 * y navegación interactiva hacia el mapa (IU02).
 */
export default function StopCard({
  parada,
  index,
  isHighlighted = false,
  onFocusOnMap = null,
}) {
  const [showBlueprint, setShowBlueprint] = useState(false);

  const esRecargaSobre80 = parada.socSalida > 80;
  const tieneTarifa = parada.costo_CLP != null && Number.isFinite(parada.costo_CLP);

  return (
    <div
      className={`stop-card ${isHighlighted ? 'stop-card--highlighted' : ''}`}
      style={{ animationDelay: `${index * 100}ms` }}
      id={`stop-card-${parada.orden}`}
    >
      {/* Encabezado de la parada */}
      <div className="stop-card__header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="stop-card__order" style={{ fontFamily: 'var(--font-mono)' }}>
              PARADA {parada.orden}
            </span>
            {parada.esCargaInicial && (
              <span className="badge badge--connector" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                Carga de Salida
              </span>
            )}
          </div>
          <h3 className="stop-card__name" style={{ fontFamily: 'var(--font-heading)' }}>
            {parada.estacionNombre}
          </h3>
          <span className="stop-card__operator">
            {parada.operador} · {parada.ciudad}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span className="badge badge--connector" style={{ fontFamily: 'var(--font-mono)' }}>
            {parada.conectorUsado}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {onFocusOnMap && (
              <button
                type="button"
                className="btn btn--ghost btn--small"
                style={{ fontSize: '0.7rem', padding: '3px 8px', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                onClick={() => onFocusOnMap(parada)}
                title="Centrar y ver marcador en el mapa interactivo (IU02)"
              >
                <MapPin size={12} color="#00d4ff" /> Ver en mapa
              </button>
            )}
            <button
              type="button"
              className="btn btn--ghost btn--small"
              style={{ fontSize: '0.7rem', padding: '3px 8px', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              onClick={() => setShowBlueprint(!showBlueprint)}
              title="Ver pinout y diagrama del conector"
            >
              <Cpu size={12} /> {showBlueprint ? 'Ocultar' : 'Pinout'}
            </button>
          </div>
        </div>
      </div>

      {/* Barra de Transferencia de Batería (SoC Entrada -> Salida) */}
      <div style={{ margin: '12px 0 14px', background: 'rgba(6, 10, 19, 0.7)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
          <span style={{ color: parada.socLlegada < 20 ? '#ef4444' : '#f59e0b' }}>
            Llegada: {parada.socLlegada.toFixed(1)}%
          </span>
          <span style={{ color: '#00d4ff' }}>
            +{(parada.socSalida - parada.socLlegada).toFixed(1)}% Recargado
          </span>
          <span style={{ color: '#10b981' }}>
            Salida: {parada.socSalida.toFixed(1)}%
          </span>
        </div>

        <div style={{ width: '100%', height: 7, background: '#141a29', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
          {/* Fill previo a la llegada */}
          <div style={{
            position: 'absolute',
            left: 0,
            width: `${Math.min(100, Math.max(0, parada.socLlegada))}%`,
            height: '100%',
            background: parada.socLlegada < 20 ? '#ef4444' : '#f59e0b'
          }} />
          {/* Fill de energía recargada */}
          <div style={{
            position: 'absolute',
            left: `${Math.min(100, Math.max(0, parada.socLlegada))}%`,
            width: `${Math.min(100 - parada.socLlegada, Math.max(0, parada.socSalida - parada.socLlegada))}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #00d4ff, #10b981)'
          }} />
        </div>
      </div>

      {/* Advertencia si la carga supera el 80% (RN04) */}
      {esRecargaSobre80 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          padding: '6px 10px',
          borderRadius: 6,
          fontSize: '0.74rem',
          color: '#fcd34d',
          marginBottom: 12
        }}>
          <AlertCircle size={14} color="#f59e0b" style={{ flexShrink: 0 }} />
          <span>
            <strong>Salida &gt; 80% (RN04):</strong> La velocidad en DC disminuye por el BMS del auto; la estimación de tiempo puede ser menos precisa.
          </span>
        </div>
      )}

      {/* Grid de telemetría técnica de la parada */}
      <div className="stop-card__details">
        <div className="stop-detail">
          <span className="stop-detail__label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Zap size={12} color="#00d4ff" /> Potencia DC
          </span>
          <span className="stop-detail__value">
            {parada.potenciaEfectiva_kW} kW
          </span>
        </div>

        <div className="stop-detail">
          <span className="stop-detail__label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <BatteryCharging size={12} color="#10b981" /> Energía
          </span>
          <span className="stop-detail__value stop-detail__value--accent">
            {parada.energiaCargada_kWh} kWh
          </span>
        </div>

        <div className="stop-detail">
          <span className="stop-detail__label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} color="#00d4ff" /> Tiempo Carga
          </span>
          <span className="stop-detail__value">
            {parada.tiempoCarga_min} min
          </span>
        </div>

        <div className="stop-detail">
          <span className="stop-detail__label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Coins size={12} color="#10b981" /> Costo Est.
          </span>
          <span className="stop-detail__value stop-detail__value--accent">
            {tieneTarifa ? (
              `$${parada.costo_CLP.toLocaleString('es-CL')} CLP`
            ) : (
              <span style={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: 500 }}>
                No disponible
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Blueprint técnico colapsable */}
      {showBlueprint && (
        <ConnectorBlueprint
          conector={parada.conectorUsado}
          potenciaKw={parada.potenciaEfectiva_kW}
          active={true}
        />
      )}

      {/* Metadatos oficiales de procedencia y fecha (RF17 & RF10) */}
      <div className="stop-card__provenance">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <ShieldCheck size={12} color="#10b981" /> Fuente: {parada.fuente || 'SEC / EcoCarga'}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Calendar size={12} color="#94a3b8" /> Revisión: {parada.fechaActualizacion || '02/10/2026'}
        </span>
      </div>
    </div>
  );
}
