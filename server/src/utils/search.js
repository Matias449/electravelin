// src/utils/search.js

function normalizarTexto(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function tokenizar(busqueda) {
  return normalizarTexto(busqueda).split(/\s+/).filter(Boolean);
}

function coincideBusqueda(campos, terminos) {
  if (!terminos || terminos.length === 0) return true;
  const haystack = normalizarTexto(campos.filter(Boolean).join(' '));
  return terminos.every((termino) => haystack.includes(termino));
}

module.exports = { normalizarTexto, tokenizar, coincideBusqueda };