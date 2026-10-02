import React from 'react';

/**
 * StopCard — Tarjeta de una parada de recarga en la timeline.
 * Muestra operador, conector, SoC de llegada/salida, energía, tiempo y costo.
 *
 * @param {{ parada: Object, index: number }} props
 */
export default function StopCard({ parada, index }) {
  return (
    <div
      className="stop-card"
      style={{ animationDelay: `${index * 100}ms` }}
      id={`stop-card-${parada.orden}`}
    >
      <div className="stop-card__header">
        <div>
          <span className="stop-card__order">Parada {parada.orden}</span>
          <h3 className="stop-card__name">{parada.estacionNombre}</h3>
          <span className="stop-card__operator">
            {parada.operador} · {parada.ciudad}
          </span>
        </div>
        <span className="badge badge--connector">{parada.conectorUsado}</span>
      </div>

      <div className="stop-card__details">
        <div className="stop-detail">
          <span className="stop-detail__label">Batería Llegada</span>
          <span
            className={`stop-detail__value ${
              parada.socLlegada < 20
                ? 'stop-detail__value--warning'
                : ''
            }`}
          >
            {parada.socLlegada.toFixed(1)}%
          </span>
        </div>

        <div className="stop-detail">
          <span className="stop-detail__label">Batería Salida</span>
          <span className="stop-detail__value stop-detail__value--success">
            {parada.socSalida.toFixed(1)}%
          </span>
        </div>

        <div className="stop-detail">
          <span className="stop-detail__label">Energía Cargada</span>
          <span className="stop-detail__value stop-detail__value--accent">
            {parada.energiaCargada_kWh} kWh
          </span>
        </div>

        <div className="stop-detail">
          <span className="stop-detail__label">Potencia Efectiva</span>
          <span className="stop-detail__value">
            {parada.potenciaEfectiva_kW} kW
          </span>
        </div>

        <div className="stop-detail">
          <span className="stop-detail__label">Tiempo Carga</span>
          <span className="stop-detail__value">
            {parada.tiempoCarga_min} min
          </span>
        </div>

        <div className="stop-detail">
          <span className="stop-detail__label">Costo Estimado</span>
          <span className="stop-detail__value stop-detail__value--accent">
            ${parada.costo_CLP.toLocaleString('es-CL')} CLP
          </span>
        </div>
      </div>
    </div>
  );
}
