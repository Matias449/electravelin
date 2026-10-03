import React, { useState } from 'react';
import ConnectorBlueprint from './ConnectorBlueprint';
import { Zap, Clock, Coins, BatteryCharging, ChevronDown, ChevronUp, Cpu } from 'lucide-react';

/**
 * StopCard — Tarjeta técnica de parada de recarga con transferencia visual de SoC,
 * telemetría de potencia y blueprints de conectores.
 */
export default function StopCard({ parada, index }) {
  const [showBlueprint, setShowBlueprint] = useState(false);

  return (
    <div
      className="stop-card"
      style={{ animationDelay: `${index * 100}ms` }}
      id={`stop-card-${parada.orden}`}
    >
      <div className="stop-card__header">
        <div>
          <span className="stop-card__order" style={{ fontFamily: 'var(--font-mono)' }}>PARADA {parada.orden}</span>
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
          <button
            type="button"
            className="btn btn--ghost btn--small"
            style={{ fontSize: '0.68rem', padding: '2px 6px', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: 3 }}
            onClick={() => setShowBlueprint(!showBlueprint)}
            title="Ver pinout del conector"
          >
            <Cpu size={11} /> {showBlueprint ? 'Ocultar' : 'Pinout'}
          </button>
        </div>
      </div>

      {/* Barra de Transferencia de Batería (SoC Entrada -> Salida) */}
      <div style={{ margin: '12px 0 16px', background: 'rgba(6, 10, 19, 0.7)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
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
            width: `${parada.socLlegada}%`,
            height: '100%',
            background: parada.socLlegada < 20 ? '#ef4444' : '#f59e0b'
          }} />
          {/* Fill de energía recargada */}
          <div style={{
            position: 'absolute',
            left: `${parada.socLlegada}%`,
            width: `${parada.socSalida - parada.socLlegada}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #00d4ff, #10b981)'
          }} />
        </div>
      </div>

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
            ${parada.costo_CLP.toLocaleString('es-CL')} CLP
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
    </div>
  );
}
