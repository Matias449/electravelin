const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const COLLECTIONS = ['users', 'vehicles', 'stations', 'trips', 'favorites', 'audit', 'meta'];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Almacén local respaldado por un archivo JSON. Si no se entrega filePath,
 * opera solo en memoria (pruebas). La carga y escritura son perezosas para no
 * tocar el disco cuando la aplicación solo sirve endpoints sin estado.
 */
function createStore({ filePath = null, seed = {} } = {}) {
  const data = {};
  for (const collection of COLLECTIONS) {
    data[collection] = Array.isArray(seed[collection]) ? clone(seed[collection]) : [];
  }
  let loaded = false;

  function ensureLoaded() {
    if (loaded) return;
    loaded = true;
    if (!filePath || !fs.existsSync(filePath)) return;
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      throw new Error(`Almacén local ilegible (${filePath}): ${error.message}`);
    }
    for (const collection of COLLECTIONS) {
      if (Array.isArray(parsed[collection])) data[collection] = parsed[collection];
    }
  }

  function persist() {
    if (!filePath) return;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(temporary, filePath);
  }

  function all(collection) {
    ensureLoaded();
    return clone(data[collection]);
  }

  function find(collection, predicate) {
    ensureLoaded();
    const found = data[collection].find(predicate);
    return found ? clone(found) : null;
  }

  function findById(collection, id) {
    ensureLoaded();
    const found = data[collection].find((item) => item.id === id);
    return found ? clone(found) : null;
  }

  function filter(collection, predicate) {
    ensureLoaded();
    return data[collection].filter(predicate).map(clone);
  }

  function insert(collection, document) {
    ensureLoaded();
    const now = new Date().toISOString();
    const record = {
      ...clone(document),
      id: document.id || crypto.randomUUID(),
      creadoEn: document.creadoEn || now,
      actualizadoEn: now,
    };
    data[collection].push(record);
    persist();
    return clone(record);
  }

  function update(collection, id, patch) {
    ensureLoaded();
    const index = data[collection].findIndex((item) => item.id === id);
    if (index === -1) return null;
    data[collection][index] = {
      ...data[collection][index],
      ...clone(patch),
      id,
      actualizadoEn: new Date().toISOString(),
    };
    persist();
    return clone(data[collection][index]);
  }

  function remove(collection, id) {
    ensureLoaded();
    const index = data[collection].findIndex((item) => item.id === id);
    if (index === -1) return false;
    data[collection].splice(index, 1);
    persist();
    return true;
  }

  function replace(collection, items) {
    ensureLoaded();
    if (!Array.isArray(items)) throw new Error('items debe ser un arreglo.');
    data[collection] = clone(items);
    persist();
    return clone(data[collection]);
  }

  return { all, find, findById, filter, insert, update, remove, replace };
}

module.exports = { createStore, COLLECTIONS };
