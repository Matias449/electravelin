import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));
}

function markerHtml(kind, label) {
  if (kind === 'stop') {
    return `
      <div style="
        background: #0d1e17;
        border: 2px solid #10b981;
        color: #10b981;
        padding: 4px 8px;
        border-radius: 6px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        font-weight: 700;
        box-shadow: 0 4px 15px rgba(0,0,0,0.7), 0 0 10px rgba(16, 185, 129, 0.4);
        display: inline-flex;
        align-items: center;
        gap: 5px;
        white-space: nowrap;
      ">
        <span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981;"></span>
        <span>⚡ ${escapeHtml(label)}</span>
      </div>
    `;
  }

  const isOrigin = kind === 'origin';
  return `
    <div style="
      background: ${isOrigin ? '#081c24' : '#1c0f24'};
      border: 2px solid ${isOrigin ? '#00d4ff' : '#a855f7'};
      color: #fff;
      padding: 4px 8px;
      border-radius: 6px;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 11px;
      font-weight: 700;
      box-shadow: 0 4px 12px rgba(0,0,0,0.6);
      display: inline-flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
    ">
      <span>${isOrigin ? '📍' : '🏁'}</span>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
}

/** Mapa Leaflet del trazado devuelto por POST /api/routes/plan con trazado animado y pines modernos */
export default function RouteMap({ geometry, origen, destino, paradas = [] }) {
  const elementRef = useRef(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!elementRef.current || !geometry?.coordinates?.length) {
      setLoadError(true);
      return undefined;
    }

    setLoadError(false);
    const map = L.map(elementRef.current, { scrollWheelZoom: false, attributionControl: true });

    // Modern clean tiles (CartoDB Voyager)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(map);

    // Glow background line
    L.geoJSON(geometry, {
      style: { color: '#00d4ff', weight: 12, opacity: 0.25 },
    }).addTo(map);

    // Main route line with animated dash pulse
    const route = L.geoJSON(geometry, {
      style: {
        color: '#00d4ff',
        weight: 5,
        opacity: 0.95,
        className: 'route-polyline-animated',
      },
    }).addTo(map);

    const icon = (kind, label) => L.divIcon({
      className: '',
      html: markerHtml(kind, label),
      iconSize: [120, 28],
      iconAnchor: [60, 14],
    });

    if (origen) {
      L.marker([origen.latitud, origen.longitud], { icon: icon('origin', origen.nombre) })
        .bindPopup(`<strong>Origen</strong><br>${escapeHtml(origen.nombre)}`)
        .addTo(map);
    }

    if (destino) {
      L.marker([destino.latitud, destino.longitud], { icon: icon('destination', destino.nombre) })
        .bindPopup(`<strong>Destino</strong><br>${escapeHtml(destino.nombre)}`)
        .addTo(map);
    }

    paradas.forEach((parada) => {
      L.marker([parada.latitud, parada.longitud], { icon: icon('stop', parada.estacionNombre) })
        .bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px;">
            <strong>${escapeHtml(parada.estacionNombre)}</strong><br/>
            ${escapeHtml(parada.ciudad)} · ${escapeHtml(parada.operador)}<br/>
            Carga: <strong>${parada.socLlegada.toFixed(0)}% → ${parada.socSalida.toFixed(0)}%</strong> (${parada.tiempoCarga_min} min)
          </div>
        `)
        .addTo(map);
    });

    map.fitBounds(route.getBounds(), { padding: [50, 50], maxZoom: 11 });

    return () => {
      map.remove();
    };
  }, [geometry, origen, destino, paradas]);

  if (loadError) {
    return <div className="map-container map-container--unavailable">No fue posible cargar el mapa interactivo.</div>;
  }
  return <div ref={elementRef} className="map-container route-map" id="map-container" aria-label="Mapa de la ruta" />;
}
