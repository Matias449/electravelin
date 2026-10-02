import React from 'react';

/**
 * Header — Cabecera de la aplicación Electravelin.
 * Muestra el logotipo, nombre y descripción.
 */
export default function Header() {
  return (
    <header className="header">
      <div className="header__logo">
        <div className="header__icon" aria-hidden="true">⚡</div>
        <h1 className="header__title">Electravelin</h1>
      </div>
      <p className="header__subtitle">
        Planifica tu viaje interurbano en vehículo eléctrico por Chile.
        Calcula paradas, costos y tiempos de carga en la Ruta 5.
      </p>
    </header>
  );
}
