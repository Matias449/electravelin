import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthPanel({ onClose }) {
  const { login, register } = useAuth();
  const [modo, setModo] = useState('login');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setEnviando(true);
    try {
      if (modo === 'login') await login(email, password);
      else await register(nombre, email, password);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal card"
        role="dialog"
        aria-modal="true"
        aria-label={modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <h2>{modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {modo === 'register' && (
            <div className="form-group">
              <label className="form-label" htmlFor="auth-nombre">Nombre</label>
              <input
                id="auth-nombre"
                className="form-input"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                autoComplete="name"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="auth-email">Correo electrónico</label>
            <input
              id="auth-email"
              type="email"
              className="form-input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="auth-password">Contraseña</label>
            <input
              id="auth-password"
              type="password"
              className="form-input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
              minLength={8}
              required
            />
            {modo === 'register' && <span className="form-helper">Mínimo 8 caracteres.</span>}
          </div>

          {error && <div className="error-banner error-banner--compact" role="alert">{error}</div>}

          <button type="submit" className="btn btn--primary btn--full" disabled={enviando}>
            {enviando ? 'Procesando…' : modo === 'login' ? 'Entrar' : 'Registrarme'}
          </button>
        </form>

        <p className="auth-switch">
          {modo === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
          <button
            type="button"
            className="link-button"
            onClick={() => { setModo(modo === 'login' ? 'register' : 'login'); setError(''); }}
          >
            {modo === 'login' ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </p>
        <p className="form-helper">
          También puedes planificar como invitado: solo inicia sesión si quieres guardar tus viajes.
        </p>
      </div>
    </div>
  );
}
