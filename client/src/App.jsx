import React, { useState, useRef } from 'react';
import Header from './components/Header';
import PlanningForm from './components/PlanningForm';
import RouteResults from './components/RouteResults';

/**
 * App — Componente raíz de Electravelin.
 * Orquesta el flujo: formulario → resultado.
 */
export default function App() {
  const [resultado, setResultado] = useState(null);
  const resultsRef = useRef(null);

  function handleResult(data) {
    setResultado(data);
    // Scroll suave hacia los resultados
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  return (
    <div className="app-container">
      <Header />
      <main>
        <PlanningForm onResult={handleResult} />
        <div ref={resultsRef}>
          <RouteResults resultado={resultado} />
        </div>
      </main>
      <footer className="footer">
        <p>Electravelin MVP v1.0 — Planificador de viajes EV para Chile 🇨🇱</p>
        <p>Los cálculos son estimaciones de referencia basadas en consumo nominal.</p>
      </footer>
    </div>
  );
}
