import React from 'react';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { id: 'planificar', label: 'Planificar', icon: '🗺️' },
  { id: 'catalogo', label: 'Catálogo', icon: '🔌' },
  { id: 'perfil', label: 'Mi perfil', icon: '👤', requiresAuth: true },
  { id: 'admin', label: 'Administración', icon: '🛠️', requiresAdmin: true },
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
          <div className="header__icon" aria-hidden="true">⚡</div>
          <h1 className="header__title">Electravelin</h1>
        </div>

        <div className="header__user">
          {usuario ? (
            <>
              <span className="user-chip" title={usuario.email}>
                {usuario.nombre}
                {usuario.rol === 'admin' && <span className="badge badge--admin">admin</span>}
              </span>
              <button type="button" className="btn btn--ghost btn--small" onClick={logout}>
                Salir
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
        Planifica tu viaje interurbano en vehículo eléctrico por Chile.
        Calcula paradas, costos y tiempos de carga en la Ruta 5.
      </p>

      <nav className="main-nav" aria-label="Secciones">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`main-nav__item ${vista === tab.id ? 'main-nav__item--active' : ''}`}
            onClick={() => onNavigate(tab.id)}
          >
            <span aria-hidden="true">{tab.icon}</span> {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
