/**
 * Registro de auditoría de acciones administrativas y de cuenta.
 * Nunca guarda cuerpos completos: solo un resumen de cambios.
 */
function createAuditService({ store } = {}) {
  if (!store) throw new Error('createAuditService requiere un store.');

  function record({ actorId = null, actorEmail = null, accion, entidad, entidadId = null, detalle = null, requestId = null }) {
    return store.insert('audit', {
      actorId,
      actorEmail,
      accion,
      entidad,
      entidadId,
      detalle,
      requestId,
    });
  }

  function list({ entidad, limit = 50 } = {}) {
    const entries = store
      .all('audit')
      .filter((entry) => !entidad || entry.entidad === entidad)
      .sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
    return entries.slice(0, Math.min(Math.max(Number(limit) || 50, 1), 200));
  }

  return { record, list };
}

module.exports = { createAuditService };
