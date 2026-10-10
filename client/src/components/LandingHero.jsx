import React from 'react';
import { ArrowRight, Leaf, Map, Sparkles, Trees, Wind, MapPinned, BatteryCharging, CircleCheck } from 'lucide-react';

/**
 * Editorial landing for the trip planner. The photograph is intentionally a
 * local public asset so the app remains usable offline and in deployments
 * without third-party image tracking.
 */
export default function LandingHero({ onPlan, onExploreStations }) {
  return (
    <div className="landing">
      <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-hero__image" aria-hidden="true" />
      <div className="landing-hero__veil" aria-hidden="true" />

      <div className="landing-hero__content">
        <div className="landing-hero__eyebrow">
          <Leaf size={15} aria-hidden="true" />
          Viaja ligero. Deja intacto lo esencial.
        </div>

        <h2 id="landing-title" className="landing-hero__title">
          El sur se disfruta<br />
          <em>sin dejar huella.</em>
        </h2>

        <p className="landing-hero__lead">
          Planifica tu ruta eléctrica entre bosques, lagos y volcanes. Electravelin
          encuentra las cargas que necesitas para que el paisaje siga siendo el protagonista.
        </p>

        <div className="landing-hero__actions">
          <button type="button" className="landing-hero__cta" onClick={onPlan}>
            Crear una ruta real <ArrowRight size={17} aria-hidden="true" />
          </button>
          <button type="button" className="landing-hero__link" onClick={onExploreStations}>
            <Map size={16} aria-hidden="true" /> Ver red de carga
          </button>
        </div>

        <div className="landing-hero__proof" aria-label="Beneficios de Electravelin">
          <span><Sparkles size={15} aria-hidden="true" /> Rutas pensadas para EV</span>
          <span>Chile austral</span>
          <span>Paradas con propósito</span>
        </div>
      </div>

      </section>

      <section className="landing-journey" aria-labelledby="journey-title">
        <div className="landing-journey__copy">
          <span className="landing-kicker"><MapPinned size={14} aria-hidden="true" /> Diseñado para avanzar</span>
          <h3 id="journey-title">La ruta no es una línea.<br /><em>Es todo lo que decides cuidar.</em></h3>
          <p>Una experiencia de viaje serena empieza antes de encender el auto: eliges el vehículo, confirmas conectores y revisas el estado real de cada carga.</p>
          <div className="landing-journey__steps" aria-label="Pasos para planificar">
            <span><b>01</b> Elige tu vehículo</span>
            <span><b>02</b> Traza tu recorrido</span>
            <span><b>03</b> Carga con información real</span>
          </div>
          <button type="button" className="landing-text-link" onClick={onPlan}>Abrir planificador <ArrowRight size={15} aria-hidden="true" /></button>
        </div>
        <aside className="landing-park-panel" aria-label="Paisaje protegido del sur de Chile">
          <div className="landing-park-panel__image" aria-hidden="true" />
          <div className="landing-park-panel__veil" aria-hidden="true" />
          <p><Trees size={14} aria-hidden="true" /> Más paisaje. Menos incertidumbre.</p>
          <span><Wind size={13} aria-hidden="true" /> Chile austral, a tu ritmo</span>
        </aside>
      </section>

      <section className="landing-charge-story" aria-labelledby="charge-story-title">
        <div className="landing-charge-story__image" aria-hidden="true" />
        <div className="landing-charge-story__content">
          <span className="landing-kicker"><BatteryCharging size={14} aria-hidden="true" /> Una red que acompaña</span>
          <h3 id="charge-story-title">Que una parada no interrumpa <em>el paisaje.</em></h3>
          <p>Consulta la red de carga antes de salir: dirección, disponibilidad declarada, potencia, conectores y compatibilidad con tu vehículo.</p>
          <ul className="landing-charge-story__facts" aria-label="Datos del catálogo de carga">
            <li><CircleCheck size={15} aria-hidden="true" /> Direcciones más precisas</li>
            <li><CircleCheck size={15} aria-hidden="true" /> Estado informado por operador</li>
            <li><CircleCheck size={15} aria-hidden="true" /> Compatibilidad por conector</li>
          </ul>
          <button type="button" className="landing-text-link" onClick={onExploreStations}>Explorar red de carga <ArrowRight size={15} aria-hidden="true" /></button>
        </div>
      </section>
    </div>
  );
}
