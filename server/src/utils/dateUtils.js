/**
 * dateUtils.js — Utilidades de normalización de fechas y evaluación de frescura (CR-01).
 *
 * Implementa las reglas de negocio para:
 * - Conversión a ISO 8601 (YYYY-MM-DD).
 * - Conversión a formato legible chileno (DD/MM/AAAA).
 * - Cálculo determinista de días transcurridos y alerta de obsolescencia (>30 días).
 */

const MS_POR_DIA = 86400000;
const ALERTA_OBSOLESCENCIA = '⚠️ Datos con más de 30 días sin revisión (podrían estar desactualizados)';

function parseDateSafe(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Formato DD/MM/AAAA o DD-MM-AAAA
    const ddmmyyyy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (ddmmyyyy) {
      const day = ddmmyyyy[1].padStart(2, '0');
      const month = ddmmyyyy[2].padStart(2, '0');
      const year = ddmmyyyy[3];
      const d = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    // Formato YYYY-MM-DD
    const yyyymmdd = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (yyyymmdd) {
      const year = yyyymmdd[1];
      const month = yyyymmdd[2].padStart(2, '0');
      const day = yyyymmdd[3].padStart(2, '0');
      const d = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    // Cualquier otro string ISO
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function toIsoDate(value) {
  const parsed = parseDateSafe(value);
  if (!parsed) return null;
  return parsed.toISOString().slice(0, 10);
}

function formatDateLegible(value) {
  const parsed = parseDateSafe(value);
  if (!parsed) return 'Sin fecha registrada';
  const iso = parsed.toISOString().slice(0, 10);
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function checkDataFreshness(fechaRevision, fechaActual = new Date()) {
  const dRevision = parseDateSafe(fechaRevision);
  const dActual = parseDateSafe(fechaActual) || new Date();

  if (!dRevision) {
    return {
      diasTranscurridos: null,
      desactualizada: true,
      fechaLegible: 'Sin fecha registrada',
      alerta: ALERTA_OBSOLESCENCIA,
    };
  }

  // diasTranscurridos = floor((fechaActual - fechaRevision) / 86400000)
  const diffMs = dActual.getTime() - dRevision.getTime();
  const diasTranscurridos = Math.floor(diffMs / MS_POR_DIA);
  const desactualizada = diasTranscurridos > 30 || diasTranscurridos < 0;

  return {
    diasTranscurridos,
    desactualizada,
    fechaLegible: formatDateLegible(dRevision),
    alerta: desactualizada ? ALERTA_OBSOLESCENCIA : null,
  };
}

module.exports = {
  MS_POR_DIA,
  ALERTA_OBSOLESCENCIA,
  parseDateSafe,
  toIsoDate,
  formatDateLegible,
  checkDataFreshness,
};
