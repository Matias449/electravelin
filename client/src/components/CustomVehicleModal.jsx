import React, { useState } from 'react';
import * as api from '../utils/api';
import { Car, Zap, BatteryCharging, Gauge, Check, AlertCircle, X, ShieldCheck } from 'lucide-react';

const CONECTORES_OPCIONES = [
  { id: 'CCS2', label: 'CCS2 (Combo 2)', desc: 'Estándar oficial en Chile y Europa para carga rápida DC y AC.' },
  { id: 'CHAdeMO', label: 'CHAdeMO', desc: 'Protocolo japonés DC (Nissan Leaf, Mitsubishi Outlander PHEV).' },
  { id: 'Type 2', label: 'Type 2 (Mennekes)', desc: 'Carga semi-rápida y lenta en corriente alterna (AC).' },
  { id: 'Type 1', label: 'Type 1 (J1772)', desc: 'Conector AC monofásico americano.' },
  { id: 'CCS1', label: 'CCS1 (Combo 1)', desc: 'Carga rápida DC con base Tipo 1 americana.' },
  { id: 'Tesla', label: 'Tesla / NACS', desc: 'Conector de la red de supercargadores Tesla.' },
];

export default function CustomVehicleModal({ vehiculo = null, onClose, onSuccess }) {
  const esEdicion = Boolean(vehiculo?.id);
  const [marca, setMarca] = useState(vehiculo?.marca || '');
  const [modelo, setModelo] = useState(vehiculo?.modelo || '');
  const [bateria, setBateria] = useState(vehiculo?.bateriaUtilizable_kWh || '');
  const [consumo, setConsumo] = useState(vehiculo?.consumoReferencia_kWhPor100km || '');
  const [potencia, setPotencia] = useState(vehiculo?.potenciaCargaMaxima_kW || '');
  const [conectores, setConectores] = useState(vehiculo?.conectoresCompatibles || ['CCS2']);
  const [imagenUrl, setImagenUrl] = useState(vehiculo?.imagenUrl || '');
  const [esHabitual, setEsHabitual] = useState(!esEdicion);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  function toggleConector(conectorId) {
    if (conectores.includes(conectorId)) {
      if (conectores.length === 1) return; // Mantener al menos uno
      setConectores(conectores.filter((c) => c !== conectorId));
    } else {
      setConectores([...conectores, conectorId]);
    }
  }

  // Estimación en tiempo real de autonomía
  const bateriaNum = Number(bateria);
  const consumoNum = Number(consumo);
  const autonomiaEstimada = (bateriaNum > 0 && consumoNum > 0)
    ? Math.round((bateriaNum / consumoNum) * 100)
    : null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!marca.trim()) {
      setError('Por favor indica la marca del vehículo.');
      return;
    }
    if (!modelo.trim()) {
      setError('Por favor indica el modelo del vehículo.');
      return;
    }
    if (!bateriaNum || bateriaNum <= 0) {
      setError('La batería utilizable debe ser un número mayor a 0 (ej. 60 kWh).');
      return;
    }
    if (!consumoNum || consumoNum <= 0) {
      setError('El consumo de referencia debe ser mayor a 0 (ej. 15.5 kWh/100km).');
      return;
    }
    const potenciaNum = Number(potencia);
    if (!potenciaNum || potenciaNum <= 0) {
      setError('La potencia máxima de carga debe ser mayor a 0 (ej. 100 kW).');
      return;
    }
    if (!conectores || conectores.length === 0) {
      setError('Selecciona al menos un conector compatible con tu vehículo.');
      return;
    }

    setEnviando(true);
    try {
      const payload = {
        marca: marca.trim(),
        modelo: modelo.trim(),
        bateriaUtilizable_kWh: bateriaNum,
        consumoReferencia_kWhPor100km: consumoNum,
        potenciaCargaMaxima_kW: potenciaNum,
        conectoresCompatibles: conectores,
        imagenUrl: imagenUrl.trim() || null,
        esHabitual,
      };

      let result;
      if (esEdicion) {
        result = await api.updateMiVehiculo(vehiculo.id, payload);
      } else {
        result = await api.createMiVehiculo(payload);
      }

      window.dispatchEvent(new CustomEvent('electravelin:vehicles-updated', { detail: { vehicle: result } }));
      if (onSuccess) onSuccess(result);
      onClose();
    } catch (err) {
      setError(err.detalles?.join(' ') || err.message || 'Error al guardar el vehículo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal card custom-vehicle-modal"
        role="dialog"
        aria-modal="true"
        aria-label={esEdicion ? 'Editar vehículo' : 'Subir mi vehículo al catálogo'}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '580px', width: '100%' }}
      >
        <div className="modal__header" style={{ marginBottom: 'var(--space-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-cyan-dim)',
              display: 'grid',
              placeItems: 'center',
              border: '1px solid var(--border-accent)'
            }}>
              <Car size={20} color="var(--accent-cyan)" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', margin: 0, color: '#fff', fontFamily: 'var(--font-heading)' }}>
                {esEdicion ? 'Editar mi Vehículo' : 'Subir Vehículo a mi Perfil'}
              </h2>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                CATÁLOGO PERSONALIZADO · PARÁMETROS TÉCNICOS
              </span>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar modal">
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
          Ingresa los atributos de tu auto eléctrico para que el motor de ruta calcule las paradas óptimas, tiempos de carga y costos exactos en la Ruta 5.
        </p>

        {error && (
          <div className="error-banner error-banner--compact" role="alert" style={{ marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-grid" id="custom-vehicle-form">
          {/* Marca */}
          <div className="form-group">
            <label className="form-label" htmlFor="custom-veh-marca">
              Marca <span style={{ color: 'var(--accent-cyan)' }}>*</span>
            </label>
            <input
              id="custom-veh-marca"
              className="form-input"
              placeholder="Ej: Nissan, Hyundai, Kia, BYD, MG..."
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Modelo */}
          <div className="form-group">
            <label className="form-label" htmlFor="custom-veh-modelo">
              Modelo y versión <span style={{ color: 'var(--accent-cyan)' }}>*</span>
            </label>
            <input
              id="custom-veh-modelo"
              className="form-input"
              placeholder="Ej: Leaf e+ 62 kWh, Kona EV 64..."
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              required
            />
          </div>

          {/* Batería Utilizable */}
          <div className="form-group">
            <label className="form-label" htmlFor="custom-veh-bateria" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <BatteryCharging size={13} color="var(--accent-cyan)" /> Batería útil (kWh) <span style={{ color: 'var(--accent-cyan)' }}>*</span>
            </label>
            <input
              id="custom-veh-bateria"
              type="number"
              step="0.1"
              min="1"
              max="250"
              className="form-input"
              placeholder="Ej: 58.0"
              value={bateria}
              onChange={(e) => setBateria(e.target.value)}
              required
            />
            <span className="form-helper" style={{ fontSize: '0.72rem' }}>Capacidad neta utilizable real.</span>
          </div>

          {/* Consumo de referencia */}
          <div className="form-group">
            <label className="form-label" htmlFor="custom-veh-consumo" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Gauge size={13} color="#10b981" /> Consumo (kWh/100km) <span style={{ color: 'var(--accent-cyan)' }}>*</span>
            </label>
            <input
              id="custom-veh-consumo"
              type="number"
              step="0.1"
              min="5"
              max="45"
              className="form-input"
              placeholder="Ej: 16.5"
              value={consumo}
              onChange={(e) => setConsumo(e.target.value)}
              required
            />
            <span className="form-helper" style={{ fontSize: '0.72rem' }}>Consumo medio en carretera.</span>
          </div>

          {/* Potencia máxima de carga */}
          <div className="form-group">
            <label className="form-label" htmlFor="custom-veh-potencia" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Zap size={13} color="#f59e0b" /> Potencia máx. DC (kW) <span style={{ color: 'var(--accent-cyan)' }}>*</span>
            </label>
            <input
              id="custom-veh-potencia"
              type="number"
              step="1"
              min="10"
              max="400"
              className="form-input"
              placeholder="Ej: 100"
              value={potencia}
              onChange={(e) => setPotencia(e.target.value)}
              required
            />
            <span className="form-helper" style={{ fontSize: '0.72rem' }}>Potencia máxima admitida en electrolinera.</span>
          </div>

          {/* Imagen URL opcional */}
          <div className="form-group">
            <label className="form-label" htmlFor="custom-veh-imagen">
              URL Imagen (opcional)
            </label>
            <input
              id="custom-veh-imagen"
              type="url"
              className="form-input"
              placeholder="https://ejemplo.com/mi-auto.jpg"
              value={imagenUrl}
              onChange={(e) => setImagenUrl(e.target.value)}
            />
            <span className="form-helper" style={{ fontSize: '0.72rem' }}>Opcional para ver miniatura.</span>
          </div>

          {/* Resumen live */}
          {autonomiaEstimada && (
            <div className="form-group form-group--full" style={{
              background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.08), rgba(124, 58, 237, 0.08))',
              border: '1px solid var(--border-accent)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
            }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                ⚡ Autonomía estimada teórica:
              </span>
              <strong style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-cyan)', fontSize: '0.95rem' }}>
                ~{autonomiaEstimada} km por carga completa
              </strong>
            </div>
          )}

          {/* Conectores compatibles */}
          <div className="form-group form-group--full">
            <label className="form-label">
              Conectores compatibles con este vehículo <span style={{ color: 'var(--accent-cyan)' }}>*</span>
            </label>
            <p className="form-helper" style={{ marginBottom: 8, fontSize: '0.74rem' }}>
              El planificador solo te sugerirá electrolineras que tengan al menos uno de estos conectores.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
              {CONECTORES_OPCIONES.map((c) => {
                const activo = conectores.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleConector(c.id)}
                    style={{
                      textAlign: 'left',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: activo ? 'var(--accent-cyan-dim)' : 'rgba(255, 255, 255, 0.03)',
                      border: activo ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                      color: activo ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <strong style={{ fontSize: '0.82rem', color: activo ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                        {c.label}
                      </strong>
                      {activo && <Check size={14} color="var(--accent-cyan)" />}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                      {c.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Checkbox Establecer como habitual */}
          <div className="form-group form-group--full">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={esHabitual}
                onChange={(e) => setEsHabitual(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--accent-cyan)' }}
              />
              <span>Establecer como mi <strong>vehículo habitual</strong> en mi perfil (preseleccionado en cada viaje)</span>
            </label>
          </div>

          {/* Botones de acción */}
          <div className="form-group form-group--full" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 'var(--space-sm)' }}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onClose}
              disabled={enviando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={enviando}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {enviando ? 'Guardando...' : (
                <>
                  <ShieldCheck size={16} />
                  {esEdicion ? 'Actualizar vehículo' : 'Guardar y agregar a mi perfil'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
