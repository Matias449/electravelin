// StationsMap.jsx

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function StationsMap({
  estaciones = [],
  seleccionada,
  onSelect,
}) {
  const mapRef = useRef(null);
  const markersRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  const leafletMapRef = useRef(null);

  function crearIconoSeleccionado(activo) {
    const background = activo ? '#00d4ff' : '#fd3838';
    const size = activo ? 30 : 20;
    return L.divIcon({
      className: '',
      html: `
        <div style="
          width: ${size}px;
          height: ${size}px;
          background: ${background};
          border: 2px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            width: 8px;
            height: 8px;
            background: white;
            border-radius: 50%;
          "></div>
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size],
    });
  }

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = L.map(mapRef.current, {
      scrollWheelZoom: false,
    }).setView([-35.7, -71.5], 5);

    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }
    ).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = markersRef.current;
    if (!map) return;

    map.clearLayers();
    const bounds = [];

    estaciones.forEach((estacion) => {
      const lat = Number(estacion.latitud);
      const lng = Number(estacion.longitud);

      if (!Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          Math.abs(lat) > 90 ||
          Math.abs(lng) > 180) return;

      // const marker = L.marker([lat, lng]);
      const activo = String(seleccionada?.id) === String(estacion.id);
      const marker = L.marker([lat, lng], {
        icon: crearIconoSeleccionado(activo),
        zIndexOffset: activo ? 1000 : 0,
      });

      marker.bindTooltip(estacion.nombre || 'Electrolinera');

      marker.on('click', () => {
        onSelectRef.current?.(estacion);
      });

      marker.addTo(map);
      bounds.push([lat, lng]);
    });

    const leafletMap = map.getLayers()[0]?._map;

  }, [estaciones, seleccionada]);

  return (
    <div
      ref={mapRef}
      className="map-container stations-map"
      aria-label="Mapa de estaciones de carga"
    />
  );
}