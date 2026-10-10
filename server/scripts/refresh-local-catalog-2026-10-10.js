const fs = require('fs');
const path = require('path');

const dataDirectory = path.resolve(__dirname, '../data');
const storePath = path.join(dataDirectory, 'electravelin.json');
const backupPath = path.join(dataDirectory, 'electravelin.pre-catalog-2026-10-10.json');
const stations = require('../src/data/stations.json');
const vehicles = require('../src/data/vehicles.json');

if (!fs.existsSync(storePath)) {
  throw new Error(`No existe el almacén local: ${storePath}`);
}

const forceRefresh = process.argv.includes('--force');
if (fs.existsSync(backupPath) && !forceRefresh) {
  throw new Error(`Ya existe un respaldo en ${backupPath}; la migración no se ejecutó.`);
}

const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
if (!fs.existsSync(backupPath)) fs.copyFileSync(storePath, backupPath);

store.stations = stations;
store.vehicles = vehicles;
store.meta = {
  ...(store.meta && typeof store.meta === 'object' ? store.meta : {}),
  catalogoActualizadoEn: new Date().toISOString(),
  catalogoActualizadoPor: 'refresh-local-catalog-2026-10-10',
};

const temporaryPath = `${storePath}.${process.pid}.tmp`;
fs.writeFileSync(temporaryPath, JSON.stringify(store, null, 2), 'utf8');
fs.renameSync(temporaryPath, storePath);

console.log(`Catálogo actualizado: ${vehicles.length} vehículos y ${stations.length} estaciones.`);
console.log(`${fs.existsSync(backupPath) ? 'Respaldo disponible' : 'Respaldo creado'}: ${backupPath}`);
