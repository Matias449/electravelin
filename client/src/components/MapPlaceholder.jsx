import React from 'react';

/**
 * MapPlaceholder — Placeholder visual del mapa con representación estilizada
 * de la ruta. Diseñado para ser reemplazado por Leaflet o Google Maps.
 *
 * @param {{ origen?: Object, destino?: Object }} props
 */
export default function MapPlaceholder({ origen, destino }) {
  return (
    <div className="map-container" id="map-container">
      <div className="map-placeholder">
        <div className="map-placeholder__grid" aria-hidden="true"></div>
        <div className="map-placeholder__route" aria-hidden="true"></div>
        <div className="map-placeholder__dot map-placeholder__dot--start" aria-hidden="true"></div>
        <div className="map-placeholder__dot map-placeholder__dot--end" aria-hidden="true"></div>
        <span className="map-placeholder__icon" aria-hidden="true">🗺️</span>
        <span className="map-placeholder__text">
          {origen && destino
            ? `${origen.nombre} → ${destino.nombre}`
            : 'El mapa interactivo se mostrará aquí'}
        </span>
      </div>
    </div>
  );
}
