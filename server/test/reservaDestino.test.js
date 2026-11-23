const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateChargingPlan } = require('../src/services/routePlanningService');

// RN02 y PR-012: el destino debe alcanzarse con batería estrictamente superior a 15%.
const vehiculo = { modelo: 'Prueba', bateriaUtilizable_kWh: 50, consumoReferencia_kWhPor100km: 16.6, potenciaCargaMaxima_kW: 100, conectoresCompatibles: ['CCS2'] };
const estacion = (km) => ({ id: `e${km}`, nombre: `Estación km ${km}`, operador: 'Op', potenciaMaxima_kW: 100, tarifa_CLPporKWh: 300, conectores: ['CCS2'], route: { progressKm: km, distanceFromRouteKm: 0 } });

test('RN02: una ruta con una parada llega al destino sobre el 15%', () => {
  const r = calculateChargingPlan({ vehicle: vehiculo, stations: [estacion(190)], totalDistanceKm: 404, drivingMinutes: 276, socInicial: 80 });
  assert.equal(r.exito, true);
  assert.ok(r.resumen.socFinal > 15, `socFinal=${r.resumen.socFinal}`);
});

test('RN02: una ruta sin paradas que llegaría justo al 15% obliga a cargar', () => {
  const kmJusto = ((80 - 15) / 100) * 50 / 0.166; // llegaría exactamente con 15%
  const r = calculateChargingPlan({ vehicle: vehiculo, stations: [estacion(100)], totalDistanceKm: kmJusto, drivingMinutes: 200, socInicial: 80 });
  assert.equal(r.exito, true);
  assert.ok(r.resumen.socFinal > 15, `socFinal=${r.resumen.socFinal}`);
});
