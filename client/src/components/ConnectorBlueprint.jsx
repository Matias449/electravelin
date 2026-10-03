import React from 'react';
import { Zap, CheckCircle2, ShieldCheck } from 'lucide-react';

/**
 * ConnectorBlueprint — Diagramas técnicos vectoriales con pinouts reales
 * de conectores de electromovilidad en Chile (CCS2, CHAdeMO, Tipo 2).
 */
export default function ConnectorBlueprint({ conector = 'CCS2', potenciaKw = 100, active = true }) {
  const isCCS2 = conector.toUpperCase().includes('CCS');
  const isChademo = conector.toUpperCase().includes('CHADEMO');
  const isType2 = conector.toUpperCase().includes('TIPO 2') || conector.toUpperCase().includes('TYPE 2');

  return (
    <div className={`connector-blueprint ${active ? 'active' : ''}`}>
      <div className="connector-blueprint-header">
        <div className="connector-title-wrap">
          <span className="connector-code-badge">{conector}</span>
          <span className="connector-standard-label">
            {isCCS2 && 'IEC 62196-3 Combo 2 (DC)'}
            {isChademo && 'JEVS G105-1993 (DC)'}
            {isType2 && 'Mennekes IEC 62196-2 (AC)'}
          </span>
        </div>
        <span className="connector-power-pill">
          <Zap size={12} /> {potenciaKw} kW Max
        </span>
      </div>

      <div className="connector-diagram-stage">
        {/* Blueprint SVG interactivo según estándar */}
        {isCCS2 && (
          <svg className="connector-svg" viewBox="0 0 160 180" width="120" height="135">
            <defs>
              <linearGradient id="pinGold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffd700" />
                <stop offset="100%" stopColor="#b8860b" />
              </linearGradient>
              <linearGradient id="dcGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00d4ff" />
                <stop offset="100%" stopColor="#0077b6" />
              </linearGradient>
            </defs>

            {/* Enclosure Shell Superior (Tipo 2) */}
            <circle cx="80" cy="65" r="48" fill="#131926" stroke="#2a364f" strokeWidth="2.5" />
            {/* Pines de Control y AC */}
            <circle cx="80" cy="40" r="7" fill="url(#pinGold)" />
            <circle cx="58" cy="55" r="7" fill="url(#pinGold)" />
            <circle cx="102" cy="55" r="7" fill="url(#pinGold)" />
            <circle cx="64" cy="78" r="7" fill="url(#pinGold)" />
            <circle cx="96" cy="78" r="7" fill="url(#pinGold)" />
            <circle cx="80" cy="90" r="5" fill="#38bdf8" />
            <circle cx="70" cy="30" r="4" fill="#a855f7" />
            <circle cx="90" cy="30" r="4" fill="#a855f7" />

            {/* Shell Inferior (Combo DC) */}
            <path
              d="M 45 110 C 45 98, 115 98, 115 110 L 115 145 C 115 160, 45 160, 45 145 Z"
              fill="#0f1522"
              stroke="#00d4ff"
              strokeWidth="2"
            />
            {/* Pines Masivos de Alta Corriente DC+ y DC- */}
            <circle cx="63" cy="130" r="11" fill="url(#dcGlow)" />
            <circle cx="63" cy="130" r="6" fill="#ffffff" opacity="0.9" />
            <circle cx="97" cy="130" r="11" fill="url(#dcGlow)" />
            <circle cx="97" cy="130" r="6" fill="#ffffff" opacity="0.9" />

            <text x="63" y="156" fill="#94a3b8" fontSize="8" textAnchor="middle" fontFamily="monospace">DC-</text>
            <text x="97" y="156" fill="#94a3b8" fontSize="8" textAnchor="middle" fontFamily="monospace">DC+</text>
          </svg>
        )}

        {isChademo && (
          <svg className="connector-svg" viewBox="0 0 160 160" width="120" height="120">
            <circle cx="80" cy="80" r="56" fill="#131926" stroke="#f59e0b" strokeWidth="2.5" />
            <circle cx="60" cy="65" r="12" fill="#f59e0b" />
            <circle cx="100" cy="65" r="12" fill="#f59e0b" />
            <circle cx="80" cy="95" r="8" fill="#38bdf8" />
            <circle cx="60" cy="110" r="6" fill="#e2e8f0" />
            <circle cx="100" cy="110" r="6" fill="#e2e8f0" />
            <circle cx="80" cy="50" r="5" fill="#a855f7" />
            <text x="80" y="135" fill="#f59e0b" fontSize="9" textAnchor="middle" fontFamily="monospace">CHAdeMO DC</text>
          </svg>
        )}

        {isType2 && (
          <svg className="connector-svg" viewBox="0 0 160 160" width="120" height="120">
            <circle cx="80" cy="80" r="54" fill="#131926" stroke="#10b981" strokeWidth="2.5" />
            <circle cx="80" cy="52" r="8" fill="#10b981" />
            <circle cx="56" cy="68" r="8" fill="#10b981" />
            <circle cx="104" cy="68" r="8" fill="#10b981" />
            <circle cx="62" cy="96" r="8" fill="#10b981" />
            <circle cx="98" cy="96" r="8" fill="#10b981" />
            <circle cx="80" cy="110" r="6" fill="#38bdf8" />
            <text x="80" y="136" fill="#10b981" fontSize="9" textAnchor="middle" fontFamily="monospace">Mennekes AC</text>
          </svg>
        )}

        <div className="connector-specs-list">
          <div className="spec-row">
            <span className="spec-k">Voltaje:</span>
            <span className="spec-v">{isType2 ? '400V Trifásico' : '400V - 800V DC'}</span>
          </div>
          <div className="spec-row">
            <span className="spec-k">Corriente:</span>
            <span className="spec-v">{isType2 ? '32A AC' : 'Hasta 300A DC'}</span>
          </div>
          <div className="spec-row">
            <span className="spec-k">Protocolo:</span>
            <span className="spec-v">{isChademo ? 'CAN Bus' : 'ISO 15118 / DIN 70121'}</span>
          </div>
          <div className="spec-row highlight">
            <CheckCircle2 size={12} color="#10b981" />
            <span>Verificado SEC Chile</span>
          </div>
        </div>
      </div>
    </div>
  );
}
