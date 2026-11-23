const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateChargingPlan } = require('../src/services/routePlanningService');

// RF15 y PR-017: si no hay ruta factible, el mensaje sugiere ajustar la batería inicial o el vehículo.
test('RF15: el mensaje de ruta no factible sugiere ajustar la batería o el vehículo', () => {
  const vehiculo = { modelo: 'Prueba', bateriaUtilizable_kWh: 40, consumoReferencia_kWhPor100km: 20, potenciaCargaMaxima_kW: 50, conectoresCompatibles: ['CHAdeMO'] };
  const r = calculateChargingPlan({ vehicle: vehiculo, stations: [], totalDistanceKm: 300, drivingMinutes: 200, socInicial: 10 });
  assert.equal(r.exito, false);
  assert.match(r.error, /batería inicial|otro vehículo/);
});
