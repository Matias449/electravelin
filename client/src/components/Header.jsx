import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Compass, Zap, User, Sliders, LogOut, ShieldCheck } from 'lucide-react';

const TABS = [
  { id: 'planificar', label: 'Planificar', icon: Compass },
  { id: 'catalogo', label: 'Catálogo', icon: Zap },
  { id: 'perfil', label: 'Mi perfil', icon: User },
  { id: 'admin', label: 'Administración', icon: Sliders, requiresAdmin: true },
];

export default function Header({ vista, onNavigate, onOpenAuth }) {
  const { usuario, logout } = useAuth();

  const tabs = TABS.filter((tab) => {
    if (tab.requiresAdmin) return usuario?.rol === 'admin';
    return true;
  });

  return (
    <header className="header">
      <div className="header__top">
        <div className="header__logo">
          <div className="header__icon" aria-hidden="true" style={{ display: 'grid', placeItems: 'center' }}>
            <Zap size={22} color="#00d4ff" />
          </div>
          <div>
            <h1 className="header__title">Electravelin</h1>
            <span style={{
              fontSize: '0.68rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-cyan)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase'
            }}>
              EV ROUTE OS · RUTA 5 CHILE
            </span>
          </div>
        </div>

        <div className="header__user">
          {usuario ? (
            <>
              <span className="user-chip" title={usuario.email}>
                <User size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                {usuario.nombre}
                {usuario.rol === 'admin' && (
                  <span className="badge badge--admin" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <ShieldCheck size={11} /> admin
                  </span>
                )}
              </span>
              <button type="button" className="btn btn--ghost btn--small" onClick={logout} title="Cerrar sesión">
                <LogOut size={13} style={{ marginRight: 4 }} /> Salir
              </button>
            </>
          ) : (
            <button type="button" className="btn btn--primary btn--small" onClick={onOpenAuth}>
              Iniciar sesión
            </button>
          )}
        </div>
      </div>

      <p className="header__subtitle">
        Planificación avanzada para vehículos eléctricos por Chile. Telemetría de batería, paradas óptimas y costos en la Ruta 5.
      </p>

      <nav className="main-nav" aria-label="Secciones">
        {tabs.map((tab) => {
          const IconComp = tab.icon;
          const isActive = vista === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`main-nav__item ${isActive ? 'main-nav__item--active' : ''}`}
              onClick={() => onNavigate(tab.id)}
            >
              <IconComp size={15} style={{ marginRight: 6 }} /> {tab.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
