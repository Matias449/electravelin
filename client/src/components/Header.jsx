// Header.jsx
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from './hooks/useTheme';
import { Home, Map, User, Sliders, LogOut, ShieldCheck, Sun, Moon, Zap, Route } from 'lucide-react';

const TABS = [
  { id: 'inicio', label: 'Inicio', icon: Home },
  { id: 'ruta', label: 'Mi ruta', icon: Map },
  { id: 'sesion', label: 'Sesión', icon: User },
  { id: 'admin', label: 'Administración', icon: Sliders, requiresAdmin: true },
];

export default function Header({ vista, onNavigate, onOpenAuth }) {
  const { usuario, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

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
            <span className="header__strapline">EV Route OS · Chile</span>
          </div>
        </div>

        <div className="header__user">
          <button 
            type="button" 
            className="btn btn--ghost btn--small theme-toggle" 
            onClick={toggleTheme} 
            aria-label={ theme === 'dark' ? 'Activar modo diurno' : 'Activar modo nocturno' } 
            title={ theme === 'dark' ? 'Activar modo diurno' : 'Activar modo nocturno' } 
          > 
            {theme === 'dark' ? ( <Sun size={14} />) : ( <Moon size={14} /> )} 
          </button>
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

      <div className="header__intro">
        <p className="header__subtitle">
          Viajes eléctricos por Chile, con rutas calculadas según tu vehículo y una red de carga verificable.
        </p>
        <span className="header__live-status"><Route size={14} aria-hidden="true" /> Ruta y carga en un solo lugar</span>
      </div>

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
