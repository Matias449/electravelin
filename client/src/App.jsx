// App.jsx
import React, { useEffect, useRef, useState } from 'react';
import Header from './components/Header';
import PlanningForm from './components/PlanningForm';
import RouteResults from './components/RouteResults';
import CatalogPanel from './components/CatalogPanel';
import ProfilePanel from './components/ProfilePanel';
import AdminPanel from './components/AdminPanel';
import AuthPanel from './components/AuthPanel';
import LandingHero from './components/LandingHero';
import { AuthProvider, useAuth } from './context/AuthContext';

const VISTA_POR_RUTA = {
  '/': 'inicio',
  '/ruta': 'ruta',
  '/sesion': 'sesion',
  '/administracion': 'admin',
};

const RUTA_POR_VISTA = {
  inicio: '/',
  ruta: '/ruta',
  sesion: '/sesion',
  admin: '/administracion',
};

function estadoDesdeUbicacion() {
  const vista = VISTA_POR_RUTA[window.location.pathname] || 'inicio';
  const tab = new URLSearchParams(window.location.search).get('tab');
  return { vista, subVistaRuta: tab === 'catalogo' ? 'catalogo' : 'planificar' };
}

function AppContent() {
  const { usuario } = useAuth();
  const [ubicacion, setUbicacion] = useState(estadoDesdeUbicacion);
  const { vista, subVistaRuta } = ubicacion;
  const [resultado, setResultado] = useState(null);
  const [consulta, setConsulta] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const resultsRef = useRef(null);

  useEffect(() => {
    const actualizarDesdeHistorial = () => setUbicacion(estadoDesdeUbicacion());
    window.addEventListener('popstate', actualizarDesdeHistorial);
    return () => window.removeEventListener('popstate', actualizarDesdeHistorial);
  }, []);

  function navegar(vistaDestino, subVista = 'planificar') {
    const ruta = RUTA_POR_VISTA[vistaDestino] || '/';
    const query = vistaDestino === 'ruta' && subVista === 'catalogo' ? '?tab=catalogo' : '';
    const url = `${ruta}${query}`;
    if (`${window.location.pathname}${window.location.search}` !== url) window.history.pushState({}, '', url);
    setUbicacion({ vista: vistaDestino, subVistaRuta: subVista });
  }

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

  function abrirRuta(subVista = 'planificar') {
    navegar('ruta', subVista);
  }

  function abrirSesion() {
    navegar('sesion');
    setAuthOpen(true);
  }

  return (
    <div className="app-container">
      <Header vista={vista} onNavigate={navegar} onOpenAuth={abrirSesion} />
      <main>
        {vista === 'inicio' && (
          <LandingHero onPlan={() => abrirRuta('planificar')} onExploreStations={() => abrirRuta('catalogo')} />
        )}

        {vista === 'ruta' && (
          <section className="route-workspace" aria-label="Planificación de ruta">
            <div className="route-workspace__nav" role="tablist" aria-label="Herramientas de ruta">
              <button type="button" role="tab" aria-selected={subVistaRuta === 'planificar'} className={subVistaRuta === 'planificar' ? 'route-workspace__tab route-workspace__tab--active' : 'route-workspace__tab'} onClick={() => navegar('ruta', 'planificar')}>1. Planificar</button>
              <button type="button" role="tab" aria-selected={subVistaRuta === 'catalogo'} className={subVistaRuta === 'catalogo' ? 'route-workspace__tab route-workspace__tab--active' : 'route-workspace__tab'} onClick={() => navegar('ruta', 'catalogo')}>2. Red de carga</button>
            </div>
            {subVistaRuta === 'planificar' && <>
            <PlanningForm onResult={handleResult} />
            <div ref={resultsRef}>
              <RouteResults resultado={resultado} consulta={consulta} onRequireAuth={requireAuth} />
            </div>
            </>}
            {subVistaRuta === 'catalogo' && <CatalogPanel onRequireAuth={requireAuth} />}
          </section>
        )}

        {vista === 'sesion' && <ProfilePanel onRequireAuth={requireAuth} />}

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
        <div className="footer__brand">
          <span className="footer__mark" aria-hidden="true">↗</span>
          <div>
            <strong>Electravelin</strong>
            <p>Ruta eléctrica para descubrir Chile con más información y menos impacto.</p>
          </div>
        </div>
        <nav className="footer__links" aria-label="Accesos del pie de página">
          <button type="button" onClick={() => navegar('inicio')}>Inicio</button>
          <button type="button" onClick={() => navegar('ruta', 'planificar')}>Planificar ruta</button>
          <button type="button" onClick={() => navegar('ruta', 'catalogo')}>Red de carga</button>
          <a href="https://cargadorespublicos.cl/" target="_blank" rel="noreferrer">Fuente SEC / EcoCarga</a>
        </nav>
        <p className="footer__legal">Los cálculos son estimaciones de referencia. Verifica el estado de cada estación antes de viajar.</p>
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
