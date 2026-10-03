import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(Boolean(api.getToken()));

  useEffect(() => {
    let active = true;
    async function loadSession() {
      if (!api.getToken()) {
        setCargando(false);
        return;
      }
      try {
        const data = await api.fetchMe();
        if (active) setUsuario(data.usuario);
      } catch {
        api.setToken(null);
      } finally {
        if (active) setCargando(false);
      }
    }
    loadSession();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.login({ email, password });
    api.setToken(data.token);
    setUsuario(data.usuario);
    return data.usuario;
  }, []);

  const register = useCallback(async (nombre, email, password) => {
    const data = await api.register({ nombre, email, password });
    api.setToken(data.token);
    setUsuario(data.usuario);
    return data.usuario;
  }, []);

  const logout = useCallback(() => {
    api.setToken(null);
    setUsuario(null);
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const data = await api.updateProfile(payload);
    setUsuario(data.usuario);
    return data.usuario;
  }, []);

  const value = { usuario, cargando, login, register, logout, updateProfile };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider.');
  return context;
}
