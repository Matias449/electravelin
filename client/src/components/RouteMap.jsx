import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));
}

function markerHtml(kind, label, isSelected = false) {
  if (kind === 'stop') {
    return `
      <div class="route-map-marker-stop ${isSelected ? 'route-map-marker-stop--selected' : ''}" style="
        background: ${isSelected ? '#063a28' : '#0d1e17'};
        border: 2px solid ${isSelected ? '#00d4ff' : '#10b981'};
        color: ${isSelected ? '#00d4ff' : '#10b981'};
        padding: 4px 10px;
        border-radius: 8px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        font-weight: 700;
        box-shadow: ${isSelected ? '0 0 18px rgba(0, 212, 255, 0.7), 0 4px 15px rgba(0,0,0,0.8)' : '0 4px 15px rgba(0,0,0,0.7), 0 0 10px rgba(16, 185, 129, 0.4)'};
        display: inline-flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
        cursor: pointer;
        transform: ${isSelected ? 'scale(1.12)' : 'scale(1)'};
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      ">
        <span style="width: 8px; height: 8px; border-radius: 50%; background: ${isSelected ? '#00d4ff' : '#10b981'}; box-shadow: 0 0 6px ${isSelected ? '#00d4ff' : '#10b981'};"></span>
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
      padding: 4px 10px;
      border-radius: 8px;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 11px;
      font-weight: 700;
      box-shadow: 0 4px 12px rgba(0,0,0,0.6);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    ">
      <span>${isOrigin ? '📍' : '🏁'}</span>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
}

/**
 * RouteMap — Mapa interactivo Leaflet del trazado devuelto por POST /api/routes/plan
 * con sincronización bidireccional hacia las tarjetas de parada (IU02).
 */
export default function RouteMap({
  geometry,
  origen,
  destino,
  paradas = [],
  selectedStopOrder = null,
  onSelectStop = null,
}) {
  const elementRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const stopMarkersRef = useRef(new Map());
  const [loadError, setLoadError] = useState(false);

  // Registrar handler global para botones dentro de popups HTML de Leaflet
  useEffect(() => {
    window.__electravelinSelectStop = (orden) => {
      const targetParada = paradas.find((p) => p.orden === orden);
      if (targetParada && onSelectStop) {
        onSelectStop(targetParada);
      }
    };

    return () => {
      delete window.__electravelinSelectStop;
    };
  }, [paradas, onSelectStop]);

  // Inicializar mapa y capas
  useEffect(() => {
    if (!elementRef.current || !geometry?.coordinates?.length) {
      setLoadError(true);
      return undefined;
    }

    setLoadError(false);
    const map = L.map(elementRef.current, { scrollWheelZoom: false, attributionControl: true });
    mapInstanceRef.current = map;
    stopMarkersRef.current.clear();

    // Standard OpenStreetMap tiles (100% libres, sin API key requerida)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
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

    const icon = (kind, label, isSelected = false) => L.divIcon({
      className: 'route-map-custom-div-icon',
      html: markerHtml(kind, label, isSelected),
      iconSize: [140, 30],
      iconAnchor: [70, 15],
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
      const isSelected = selectedStopOrder === parada.orden;
      const labelText = `PARADA ${parada.orden}: ${parada.estacionNombre}`;
      const marker = L.marker([parada.latitud, parada.longitud], {
        icon: icon('stop', labelText, isSelected),
        zIndexOffset: isSelected ? 1000 : 100,
      });

      const costoTexto = parada.costo_CLP != null
        ? `$${parada.costo_CLP.toLocaleString('es-CL')} CLP`
        : 'Tarifa no informada';

      const popupContent = `
        <div style="font-family: 'Inter', sans-serif; font-size: 12px; color: #e2e8f0; min-width: 190px;">
          <div style="font-size: 10px; color: #10b981; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">
            ⚡ Parada ${parada.orden} de ${paradas.length}
          </div>
          <strong style="font-size: 13px; color: #fff; display: block; margin-bottom: 2px;">
            ${escapeHtml(parada.estacionNombre)}
          </strong>
          <div style="color: #94a3b8; font-size: 11px; margin-bottom: 8px;">
            ${escapeHtml(parada.ciudad)} · ${escapeHtml(parada.operador)}
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px; background: rgba(15, 23, 42, 0.85); padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); margin-bottom: 8px;">
            <div>Carga: <strong style="color: #10b981;">${parada.socLlegada.toFixed(0)}% → ${parada.socSalida.toFixed(0)}%</strong></div>
            <div>Tiempo: <strong style="color: #00d4ff;">${parada.tiempoCarga_min} min</strong></div>
            <div>Potencia: <strong>${parada.potenciaEfectiva_kW} kW</strong></div>
            <div>Costo: <strong>${costoTexto}</strong></div>
          </div>
          <div style="font-size: 10px; color: #64748b; margin-bottom: 8px;">
            Fuente: ${escapeHtml(parada.fuente || 'SEC EcoCarga')} (${escapeHtml(parada.fechaActualizacion || '02/10/2026')})
          </div>
          <button
            type="button"
            class="btn btn--primary btn--small"
            style="width: 100%; font-size: 11px; padding: 5px 8px; border-radius: 4px; cursor: pointer;"
            onclick="window.__electravelinSelectStop && window.__electravelinSelectStop(${parada.orden})"
          >
            Ver ficha técnica en lista ↓
          </button>
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 260 });

      // Click en marcador de parada -> sincroniza ficha (IU02)
      marker.on('click', () => {
        if (onSelectStop) {
          onSelectStop(parada);
        }
      });

      marker.addTo(map);
      stopMarkersRef.current.set(parada.orden, { marker, parada });
    });

    map.fitBounds(route.getBounds(), { padding: [50, 50], maxZoom: 11 });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      stopMarkersRef.current.clear();
    };
  }, [geometry, origen, destino, paradas]);

  // Sincronizar foco y popup del marcador cuando cambia selectedStopOrder desde el exterior
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedStopOrder) return;
    const target = stopMarkersRef.current.get(selectedStopOrder);
    if (target) {
      const { marker, parada } = target;
      mapInstanceRef.current.panTo([parada.latitud, parada.longitud], { animate: true, duration: 0.6 });
      marker.openPopup();
    }
  }, [selectedStopOrder]);

  if (loadError) {
    return <div className="map-container map-container--unavailable">No fue posible cargar el mapa interactivo.</div>;
  }

  return (
    <div
      ref={elementRef}
      className="map-container route-map"
      id="map-container"
      aria-label="Mapa interactivo de la ruta"
    />
  );
}
