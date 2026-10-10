// App.jsx
import React, { useRef, useState } from 'react';
import Header from './components/Header';
import PlanningForm from './components/PlanningForm';
import RouteResults from './components/RouteResults';
import CatalogPanel from './components/CatalogPanel';
import ProfilePanel from './components/ProfilePanel';
import AdminPanel from './components/AdminPanel';
import AuthPanel from './components/AuthPanel';
import { AuthProvider, useAuth } from './context/AuthContext';

function AppContent() {
  const { usuario } = useAuth();
  const [vista, setVista] = useState('planificar');
  const [resultado, setResultado] = useState(null);
  const [consulta, setConsulta] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const resultsRef = useRef(null);

  function handleResult(data, params) {
    setResultado(data);
    setConsulta(params);
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  function requireAuth() {
    setAuthOpen(true);
  }

  return (
    <div className="app-container">
      <Header vista={vista} onNavigate={setVista} onOpenAuth={requireAuth} />
      <main>
        {vista === 'planificar' && (
          <>
            <PlanningForm onResult={handleResult} />
            <div ref={resultsRef}>
              <RouteResults resultado={resultado} consulta={consulta} onRequireAuth={requireAuth} />
            </div>
          </>
        )}

        {vista === 'catalogo' && <CatalogPanel onRequireAuth={requireAuth} />}

        {vista === 'perfil' && <ProfilePanel onRequireAuth={requireAuth} />}

        {vista === 'admin' && (
          usuario?.rol === 'admin'
            ? <AdminPanel />
            : (
              <div className="card empty-state">
                <span aria-hidden="true" className="empty-state__icon">🔒</span>
                <h2>Acceso restringido</h2>
                <p>Esta sección requiere una cuenta con rol de administrador.</p>
              </div>
            )
        )}
      </main>
      {authOpen && <AuthPanel onClose={() => setAuthOpen(false)} />}
      <footer className="footer">
        <p>Electravelin MVP v2.0 — Planificador de viajes EV para Chile 🇨🇱</p>
        <p>Los cálculos son estimaciones de referencia basadas en consumo nominal.</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
