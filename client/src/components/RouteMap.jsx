import { useEffect, useRef, useState } from 'react';

function markerHtml(kind, label) {
  const icon = kind === 'stop' ? '⚡' : kind === 'origin' ? 'A' : 'B';
  return `<span class="route-map-marker route-map-marker--${kind}" aria-label="${escapeHtml(label)}">${icon}</span>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));
}

/** Mapa Leaflet del trazado devuelto por POST /api/routes/plan. */
export default function RouteMap({ geometry, origen, destino, paradas = [] }) {
  const elementRef = useRef(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let map = null;
    let timer = null;

    function initMap() {
      const L = window.L;
      if (!L) return false;
      if (!elementRef.current || !geometry?.coordinates?.length) return true;

      setLoadError(false);
      map = L.map(elementRef.current, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const route = L.geoJSON(geometry, {
        style: { color: '#00d4ff', weight: 5, opacity: 0.9 },
      }).addTo(map);
      const icon = (kind, label) => L.divIcon({
        className: 'route-map-icon-wrapper',
        html: markerHtml(kind, label),
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      if (origen) L.marker([origen.latitud, origen.longitud], { icon: icon('origin', origen.nombre) }).bindPopup(`<strong>Origen</strong><br>${escapeHtml(origen.nombre)}`).addTo(map);
      if (destino) L.marker([destino.latitud, destino.longitud], { icon: icon('destination', destino.nombre) }).bindPopup(`<strong>Destino</strong><br>${escapeHtml(destino.nombre)}`).addTo(map);
      paradas.forEach((parada) => {
        L.marker([parada.latitud, parada.longitud], { icon: icon('stop', parada.estacionNombre) })
          .bindPopup(`<strong>${escapeHtml(parada.estacionNombre)}</strong><br>${escapeHtml(parada.ciudad)} · ${parada.socLlegada}% → ${parada.socSalida}%`)
          .addTo(map);
      });

      map.fitBounds(route.getBounds(), { padding: [30, 30], maxZoom: 10 });
      return true;
    }

    if (!initMap()) {
      let attempts = 0;
      timer = setInterval(() => {
        attempts += 1;
        if (initMap() || attempts > 20) {
          clearInterval(timer);
          if (!window.L) setLoadError(true);
        }
      }, 100);
    }

    return () => {
      if (timer) clearInterval(timer);
      if (map) map.remove();
    };
  }, [geometry, origen, destino, paradas]);

  if (loadError) {
    return <div className="map-container map-container--unavailable">No fue posible cargar el mapa interactivo.</div>;
  }
  return <div ref={elementRef} className="map-container route-map" id="map-container" aria-label="Mapa de la ruta" />;
}
