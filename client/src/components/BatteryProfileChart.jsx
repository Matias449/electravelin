import React from 'react';
import { BatteryCharging, ShieldAlert } from 'lucide-react';

/**
 * BatteryProfileChart — Gráfico dinámico SVG del perfil de consumo,
 * recarga en paradas y margen de seguridad respecto al buffer del 15%.
 */
export default function BatteryProfileChart({ socInicial = 80, paradas = [], socFinal = 20, distanciaTotalKm = 500 }) {
  // Construcción de puntos (x: km normalizado a 0-500, y: soc invertido para SVG 0-100)
  const svgWidth = 500;
  const svgHeight = 120;
  const padX = 25;
  const padY = 15;
  const plotW = svgWidth - padX * 2;
  const plotH = svgHeight - padY * 2;

  const getX = (km) => padX + (Math.max(0, Math.min(km, distanciaTotalKm)) / (distanciaTotalKm || 1)) * plotW;
  const getY = (soc) => padY + plotH - (Math.max(0, Math.min(soc, 100)) / 100) * plotH;

  // Puntos del recorrido
  let currentKm = 0;
  const points = [];
  const waypoints = [];

  // Punto inicial (Origen)
  points.push({ x: getX(0), y: getY(socInicial) });
  waypoints.push({ km: 0, soc: socInicial, label: 'Origen' });

  paradas.forEach((p) => {
    const stopKm = p.distanciaAcumulada_km || (distanciaTotalKm * 0.5);
    // Llegada a la estación
    points.push({ x: getX(stopKm), y: getY(p.socLlegada) });
    // Recarga en la estación
    points.push({ x: getX(stopKm), y: getY(p.socSalida) });

    waypoints.push({ km: Math.round(stopKm), soc: Math.round(p.socLlegada), label: p.estacionNombre });
  });

  // Punto final (Destino)
  points.push({ x: getX(distanciaTotalKm), y: getY(socFinal) });
  waypoints.push({ km: Math.round(distanciaTotalKm), soc: Math.round(socFinal), label: 'Destino' });

  const pointsString = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const polygonString = `${pointsString} ${getX(distanciaTotalKm)},${getY(0)} ${getX(0)},${getY(0)}`;

  const yReserve15 = getY(15);
  const yOpt80 = getY(80);

  return (
    <div className="card battery-profile-chart-card">
      <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BatteryCharging size={18} color="#00d4ff" />
          <h4 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '0.95rem', color: '#fff' }}>
            Perfil Dinámico de Batería y Reserva
          </h4>
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: '#00d4ff' }}>● SoC Proyectado</span>
          <span style={{ color: '#ef4444' }}>- - Reserva Mín. 15%</span>
        </div>
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <linearGradient id="curveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Línea de referencia 80% */}
          <line x1={padX} y1={yOpt80} x2={svgWidth - padX} y2={yOpt80} stroke="#2a364f" strokeDasharray="3,3" />
          <text x={svgWidth - padX} y={yOpt80 - 4} fill="#64748b" fontSize="8" textAnchor="end" fontFamily="monospace">80% Óptimo DC</text>

          {/* Línea crítica de reserva 15% */}
          <line x1={padX} y1={yReserve15} x2={svgWidth - padX} y2={yReserve15} stroke="#ef4444" strokeWidth="1.2" strokeDasharray="4,4" />
          <text x={svgWidth - padX} y={yReserve15 + 11} fill="#ef4444" fontSize="8" textAnchor="end" fontFamily="monospace">Buffer 15%</text>

          {/* Área sombreada bajo la curva */}
          <polygon points={polygonString} fill="url(#curveGradient)" />

          {/* Polilínea principal de descarga */}
          <polyline
            fill="none"
            stroke="#00d4ff"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={pointsString}
          />

          {/* Marcadores de Waypoint */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={4}
              fill={p.y >= yReserve15 ? '#ef4444' : '#00d4ff'}
              stroke="#060a13"
              strokeWidth="1.5"
            />
          ))}
        </svg>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
        <span>0 km · Salida ({socInicial}%)</span>
        {paradas.length > 0 && <span>⚡ {paradas.length} parada(s) de recarga</span>}
        <span>{Math.round(distanciaTotalKm)} km · Llegada ({Math.round(socFinal)}%)</span>
      </div>
    </div>
  );
}
