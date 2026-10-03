import React, { useEffect, useState } from 'react';
import * as api from '../utils/api';

const VEHICLE_EMPTY = {
  id: '', modelo: '', marca: '', bateriaUtilizable_kWh: '', consumoReferencia_kWhPor100km: '',
  potenciaCargaMaxima_kW: '', conectoresCompatibles: ['CCS2'],
};

const STATION_EMPTY = {
  id: '', nombre: '', ciudad: '', region: '', operador: '', latitud: '', longitud: '',
  conectoresDisponibles: ['CCS2'], potenciaMaxima_kW: '', tarifa_CLPporKWh: '', verificada: false,
};

function formatDate(iso) {
  return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

export default function AdminPanel() {
  const [seccion, setSeccion] = useState('vehiculos');
  const [vehiculos, setVehiculos] = useState([]);
  const [estaciones, setEstaciones] = useState([]);
  const [auditoria, setAuditoria] = useState([]);
  const [vehicleForm, setVehicleForm] = useState(VEHICLE_EMPTY);
  const [stationForm, setStationForm] = useState(STATION_EMPTY);
  const [editandoVehiculo, setEditandoVehiculo] = useState(false);
  const [editandoEstacion, setEditandoEstacion] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  async function reload() {
    setError('');
    try {
      const [vehiculosData, estacionesData, auditoriaData] = await Promise.all([
        api.fetchAdminVehiculos(),
        api.fetchAdminEstaciones(),
        api.fetchAuditoria(),
      ]);
      setVehiculos(vehiculosData);
      setEstaciones(estacionesData);
      setAuditoria(auditoriaData);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { reload(); }, []);

  function toggleConector(list, conector, setter, field) {
    const next = list.includes(conector) ? list.filter((item) => item !== conector) : [...list, conector];
    setter((prev) => ({ ...prev, [field]: next }));
  }

  async function submitVehicle(event) {
    event.preventDefault();
    setMensaje('');
    setError('');
    const payload = {
      ...vehicleForm,
      bateriaUtilizable_kWh: Number(vehicleForm.bateriaUtilizable_kWh),
      consumoReferencia_kWhPor100km: Number(vehicleForm.consumoReferencia_kWhPor100km),
      potenciaCargaMaxima_kW: Number(vehicleForm.potenciaCargaMaxima_kW),
    };
    if (!payload.id) delete payload.id;
    try {
      if (editandoVehiculo) await api.updateAdminVehiculo(vehicleForm.id, payload);
      else await api.createAdminVehiculo(payload);
      setMensaje(editandoVehiculo ? 'Vehículo actualizado.' : 'Vehículo creado.');
      setVehicleForm(VEHICLE_EMPTY);
      setEditandoVehiculo(false);
      await reload();
    } catch (err) {
      setError(err.detalles?.join(' ') || err.message);
    }
  }

  async function submitStation(event) {
    event.preventDefault();
    setMensaje('');
    setError('');
    const payload = {
      ...stationForm,
      latitud: Number(stationForm.latitud),
      longitud: Number(stationForm.longitud),
      potenciaMaxima_kW: Number(stationForm.potenciaMaxima_kW),
      tarifa_CLPporKWh: Number(stationForm.tarifa_CLPporKWh),
    };
    if (!payload.id) delete payload.id;
    try {
      if (editandoEstacion) await api.updateAdminEstacion(stationForm.id, payload);
      else await api.createAdminEstacion(payload);
      setMensaje(editandoEstacion ? 'Estación actualizada.' : 'Estación creada.');
      setStationForm(STATION_EMPTY);
      setEditandoEstacion(false);
      await reload();
    } catch (err) {
      setError(err.detalles?.join(' ') || err.message);
    }
  }

  async function deactivateVehicle(id) {
    if (!window.confirm('¿Desactivar este vehículo? Dejará de aparecer en el catálogo público.')) return;
    try {
      await api.deactivateAdminVehiculo(id);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deactivateStation(id) {
    if (!window.confirm('¿Desactivar esta estación? Dejará de aparecer en el catálogo público.')) return;
    try {
      await api.deactivateAdminEstacion(id);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="panel" id="admin-panel">
      <div className="card">
        <h2 className="card__title"><span aria-hidden="true">🛠️</span> Panel de administración</h2>

        <div className="tab-row" role="tablist">
          {[
            { id: 'vehiculos', label: `Vehículos (${vehiculos.length})` },
            { id: 'estaciones', label: `Estaciones (${estaciones.length})` },
            { id: 'auditoria', label: 'Auditoría' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={seccion === tab.id}
              className={`tab ${seccion === tab.id ? 'tab--active' : ''}`}
              onClick={() => setSeccion(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {mensaje && <p className="form-success" role="status">{mensaje}</p>}
        {error && <div className="error-banner error-banner--compact" role="alert">{error}</div>}
      </div>

      {seccion === 'vehiculos' && (
        <>
          <div className="card">
            <h3>{editandoVehiculo ? 'Editar vehículo' : 'Nuevo vehículo'}</h3>
            <form onSubmit={submitVehicle} className="form-grid">
              {!editandoVehiculo && (
                <div className="form-group">
                  <label className="form-label" htmlFor="admin-vehicle-id">ID (opcional)</label>
                  <input id="admin-vehicle-id" className="form-input" value={vehicleForm.id} onChange={(event) => setVehicleForm({ ...vehicleForm, id: event.target.value })} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label" htmlFor="admin-vehicle-marca">Marca</label>
                <input id="admin-vehicle-marca" className="form-input" required value={vehicleForm.marca} onChange={(event) => setVehicleForm({ ...vehicleForm, marca: event.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="admin-vehicle-modelo">Modelo</label>
                <input id="admin-vehicle-modelo" className="form-input" required value={vehicleForm.modelo} onChange={(event) => setVehicleForm({ ...vehicleForm, modelo: event.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="admin-vehicle-bateria">Batería útil (kWh)</label>
                <input id="admin-vehicle-bateria" type="number" min="1" step="0.1" className="form-input" required value={vehicleForm.bateriaUtilizable_kWh} onChange={(event) => setVehicleForm({ ...vehicleForm, bateriaUtilizable_kWh: event.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="admin-vehicle-consumo">Consumo (kWh/100km)</label>
                <input id="admin-vehicle-consumo" type="number" min="1" step="0.1" className="form-input" required value={vehicleForm.consumoReferencia_kWhPor100km} onChange={(event) => setVehicleForm({ ...vehicleForm, consumoReferencia_kWhPor100km: event.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="admin-vehicle-potencia">Potencia de carga (kW)</label>
                <input id="admin-vehicle-potencia" type="number" min="1" className="form-input" required value={vehicleForm.potenciaCargaMaxima_kW} onChange={(event) => setVehicleForm({ ...vehicleForm, potenciaCargaMaxima_kW: event.target.value })} />
              </div>
              <div className="form-group">
                <span className="form-label">Conectores</span>
                <div className="checkbox-row">
                  {['CCS2', 'CHAdeMO'].map((conector) => (
                    <label key={conector} className="checkbox">
                      <input type="checkbox" checked={vehicleForm.conectoresCompatibles.includes(conector)} onChange={() => toggleConector(vehicleForm.conectoresCompatibles, conector, setVehicleForm, 'conectoresCompatibles')} />
                      {conector}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group form-group--full form-actions">
                <button type="submit" className="btn btn--primary">{editandoVehiculo ? 'Guardar cambios' : 'Crear vehículo'}</button>
                {editandoVehiculo && (
                  <button type="button" className="btn btn--ghost" onClick={() => { setEditandoVehiculo(false); setVehicleForm(VEHICLE_EMPTY); }}>
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="card">
            <ul className="list">
              {vehiculos.map((vehicle) => (
                <li key={vehicle.id} className={`list__item ${vehicle.activo === false ? 'list__item--disabled' : ''}`}>
                  <div>
                    <strong>{vehicle.marca} {vehicle.modelo}</strong>
                    <div className="list__meta">
                      {vehicle.bateriaUtilizable_kWh} kWh · {vehicle.potenciaCargaMaxima_kW} kW · {vehicle.conectoresCompatibles.join(', ')}
                      {vehicle.activo === false && <span className="badge badge--disabled">inactivo</span>}
                    </div>
                  </div>
                  <div className="list__actions">
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => { setEditandoVehiculo(true); setVehicleForm({ ...vehicle, conectoresCompatibles: [...vehicle.conectoresCompatibles] }); }}>Editar</button>
                    {vehicle.activo !== false && (
                      <button type="button" className="btn btn--danger btn--small" onClick={() => deactivateVehicle(vehicle.id)}>Desactivar</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {seccion === 'estaciones' && (
        <>
          <div className="card">
            <h3>{editandoEstacion ? 'Editar estación' : 'Nueva estación'}</h3>
            <form onSubmit={submitStation} className="form-grid">
              {!editandoEstacion && (
                <div className="form-group">
                  <label className="form-label" htmlFor="admin-station-id">ID (opcional)</label>
                  <input id="admin-station-id" className="form-input" value={stationForm.id} onChange={(event) => setStationForm({ ...stationForm, id: event.target.value })} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label" htmlFor="admin-station-nombre">Nombre</label>
                <input id="admin-station-nombre" className="form-input" required value={stationForm.nombre} onChange={(event) => setStationForm({ ...stationForm, nombre: event.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="admin-station-ciudad">Ciudad</label>
                <input id="admin-station-ciudad" className="form-input" required value={stationForm.ciudad} onChange={(event) => setStationForm({ ...stationForm, ciudad: event.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="admin-station-region">Región</label>
                <input id="admin-station-region" className="form-input" value={stationForm.region} onChange={(event) => setStationForm({ ...stationForm, region: event.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="admin-station-operador">Operador</label>
                <input id="admin-station-operador" className="form-input" required value={stationForm.operador} onChange={(event) => setStationForm({ ...stationForm, operador: event.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="admin-station-lat">Latitud</label>
                <input id="admin-station-lat" type="number" step="0.0001" className="form-input" required value={stationForm.latitud} onChange={(event) => setStationForm({ ...stationForm, latitud: event.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="admin-station-lon">Longitud</label>
                <input id="admin-station-lon" type="number" step="0.0001" className="form-input" required value={stationForm.longitud} onChange={(event) => setStationForm({ ...stationForm, longitud: event.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="admin-station-potencia">Potencia (kW)</label>
                <input id="admin-station-potencia" type="number" min="1" className="form-input" required value={stationForm.potenciaMaxima_kW} onChange={(event) => setStationForm({ ...stationForm, potenciaMaxima_kW: event.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="admin-station-tarifa">Tarifa (CLP/kWh)</label>
                <input id="admin-station-tarifa" type="number" min="0" className="form-input" required value={stationForm.tarifa_CLPporKWh} onChange={(event) => setStationForm({ ...stationForm, tarifa_CLPporKWh: event.target.value })} />
              </div>
              <div className="form-group">
                <span className="form-label">Conectores</span>
                <div className="checkbox-row">
                  {['CCS2', 'CHAdeMO'].map((conector) => (
                    <label key={conector} className="checkbox">
                      <input type="checkbox" checked={stationForm.conectoresDisponibles.includes(conector)} onChange={() => toggleConector(stationForm.conectoresDisponibles, conector, setStationForm, 'conectoresDisponibles')} />
                      {conector}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="checkbox">
                  <input type="checkbox" checked={stationForm.verificada} onChange={(event) => setStationForm({ ...stationForm, verificada: event.target.checked })} />
                  Verificada
                </label>
              </div>
              <div className="form-group form-group--full form-actions">
                <button type="submit" className="btn btn--primary">{editandoEstacion ? 'Guardar cambios' : 'Crear estación'}</button>
                {editandoEstacion && (
                  <button type="button" className="btn btn--ghost" onClick={() => { setEditandoEstacion(false); setStationForm(STATION_EMPTY); }}>
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="card">
            <ul className="list">
              {estaciones.map((station) => (
                <li key={station.id} className={`list__item ${station.disponible === false ? 'list__item--disabled' : ''}`}>
                  <div>
                    <strong>{station.nombre}</strong>
                    <div className="list__meta">
                      {station.ciudad} · {station.operador} · {station.potenciaMaxima_kW} kW · ${station.tarifa_CLPporKWh}/kWh
                      {station.disponible === false && <span className="badge badge--disabled">no disponible</span>}
                    </div>
                  </div>
                  <div className="list__actions">
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => { setEditandoEstacion(true); setStationForm({ ...station, conectoresDisponibles: [...station.conectoresDisponibles] }); }}>Editar</button>
                    {station.disponible !== false && (
                      <button type="button" className="btn btn--danger btn--small" onClick={() => deactivateStation(station.id)}>Desactivar</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {seccion === 'auditoria' && (
        <div className="card">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Actor</th>
                  <th>Acción</th>
                  <th>Entidad</th>
                  <th>ID</th>
                </tr>
              </thead>
              <tbody>
                {auditoria.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDate(entry.creadoEn)}</td>
                    <td>{entry.actorEmail || '—'}</td>
                    <td>{entry.accion}</td>
                    <td>{entry.entidad}</td>
                    <td>{entry.entidadId || '—'}</td>
                  </tr>
                ))}
                {auditoria.length === 0 && (
                  <tr><td colSpan="5" className="table__empty">Sin registros de auditoría.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
