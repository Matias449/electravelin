/**
 * stationFreshness.js — Utilidad pura para evaluar la frescura de los datos de una estación / parada (CR-01).
 *
 * Reglas de negocio:
 * 1. Calcula días transcurridos entre fechaActual (por defecto new Date()) y fechaRevision:
 *    diasTranscurridos = Math.floor((fechaActual - fechaRevision) / 86400000)
 * 2. Si diasTranscurridos > 30 o !fechaRevision o fecha inválida:
 *    desactualizada = true
 *    alerta = "⚠️ Datos con más de 30 días sin revisión (podrían estar desactualizados)"
 * 3. Si diasTranscurridos <= 30 y >= 0:
 *    desactualizada = false
 *    alerta = null
 * 4. Formatea la fecha a formato legible DD/MM/AAAA.
 */

export const MS_POR_DIA = 86400000;
export const ALERTA_OBSOLESCENCIA = '⚠️ Datos con más de 30 días sin revisión (podrían estar desactualizados)';

export function parseDateSafe(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Formato DD/MM/AAAA o DD-MM-AAAA -> normalizar a YYYY-MM-DD
    const ddmmyyyy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (ddmmyyyy) {
      const day = ddmmyyyy[1].padStart(2, '0');
      const month = ddmmyyyy[2].padStart(2, '0');
      const year = ddmmyyyy[3];
      const iso = `${year}-${month}-${day}`;
      const d = new Date(`${iso}T00:00:00.000Z`);
      return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : d;
    }

    // Formato YYYY-MM-DD
    const yyyymmdd = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (yyyymmdd) {
      const year = yyyymmdd[1];
      const month = yyyymmdd[2].padStart(2, '0');
      const day = yyyymmdd[3].padStart(2, '0');
      const iso = `${year}-${month}-${day}`;
      const d = new Date(`${iso}T00:00:00.000Z`);
      return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : d;
    }

    // Rechazar fechas ISO cuyo día no existe, incluso con hora.
    const prefix = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:T|\s)/);
    if (prefix) {
      const dateOnly = new Date(`${prefix[1]}T00:00:00.000Z`);
      if (Number.isNaN(dateOnly.getTime()) || dateOnly.toISOString().slice(0, 10) !== prefix[1]) return null;
    }
    // Cualquier otro string ISO
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

export function toIsoDate(value) {
  const parsed = parseDateSafe(value);
  if (!parsed) return null;
  return parsed.toISOString().slice(0, 10);
}

export function formatDateLegible(value) {
  const parsed = parseDateSafe(value);
  if (!parsed) return 'Sin fecha registrada';
  const iso = parsed.toISOString().slice(0, 10);
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export function checkDataFreshness(fechaRevision, fechaActual = new Date()) {
  const dRevision = parseDateSafe(fechaRevision);
  const dActual = parseDateSafe(fechaActual) || new Date();

  if (!dRevision) {
    return {
      diasTranscurridos: null,
      desactualizada: true,
      fechaLegible: 'Sin fecha registrada',
      alerta: '⚠️ Fecha de revisión no disponible; los datos podrían estar desactualizados',
    };
  }

  const diffMs = dActual.getTime() - dRevision.getTime();
  const diasTranscurridos = Math.floor(diffMs / MS_POR_DIA);
  const desactualizada = diasTranscurridos > 30 || diasTranscurridos < 0;

  return {
    diasTranscurridos,
    desactualizada,
    fechaLegible: formatDateLegible(dRevision),
    alerta: diasTranscurridos < 0 ? '⚠️ Fecha de revisión futura; verifica los datos' : (desactualizada ? ALERTA_OBSOLESCENCIA : null),
  };
}
