/**
 * =============================================================================
 * persistence.js — Compuerta de persistencia para almacenes asíncronos
 * =============================================================================
 *
 * Con un almacén que tiene ready() (Supabase), espera la carga inicial antes de
 * atender cada petición. Con un almacén que tiene flush(), retrasa el cierre de
 * la respuesta hasta que las escrituras pendientes terminen: en Vercel la
 * función puede congelarse apenas se envía la respuesta y perder escrituras.
 *
 * Decisión sobre fallas de escritura: si flush() falla, se registra
 * `store_flush_failed` y la respuesta original se envía igual (sin 500). Motivo:
 * la mutación ya quedó aplicada en la caché de esta instancia; responder 500
 * induciría reintentos de operaciones no idempotentes (p. ej. crear un viaje
 * dos veces) mientras la caché sí cambió. El costo es que el cliente recibe un
 * éxito que quizá no quedó en Supabase; por eso la falla queda en logs.
 *
 * Las rutas de salud y de disponibilidad quedan fuera: /api/ready informa el
 * estado del almacén por sí mismo, sin propagar un 500 genérico.
 * =============================================================================
 */

const RUTAS_SIN_COMPUERTA = new Set(['/api/health', '/api/ready']);

function createPersistenceGate({ dataStore, onReady, logger }) {
  const esAsincrono = typeof dataStore.ready === 'function';
  const conFlush = typeof dataStore.flush === 'function';

  return async function persistenceGate(req, res, next) {
    if (!esAsincrono && !conFlush) return next();
    if (RUTAS_SIN_COMPUERTA.has(req.path)) return next();

    if (esAsincrono) {
      try {
        await dataStore.ready();
        onReady?.();
      } catch (error) {
        logger?.error('almacen_no_disponible', { requestId: req.requestId, message: error.message });
        return next(error);
      }
    }

    if (conFlush) {
      const finalizar = res.end;
      res.end = function finalizarTrasEscrituras(...args) {
        dataStore.flush()
          .catch((error) => {
            logger?.error('store_flush_failed', { requestId: req.requestId, message: error.message });
          })
          .then(() => finalizar.apply(res, args));
        return res;
      };
    }

    return next();
  };
}

module.exports = { createPersistenceGate };
