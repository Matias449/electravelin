/**
 * routeRoutes.js — Definición de rutas Express para la API de Electravelin
 */

const express = require('express');
const router = express.Router();
const {
  calcularRuta,
  obtenerVehiculos,
  obtenerCiudades,
  obtenerEstaciones,
} = require('../controllers/routeController');

// POST /api/calcular-ruta — Endpoint principal de cálculo (RF11-RF15)
router.post('/calcular-ruta', calcularRuta);

// GET /api/vehiculos — Catálogo de VE (RF06)
router.get('/vehiculos', obtenerVehiculos);

// GET /api/ciudades — Ciudades disponibles
router.get('/ciudades', obtenerCiudades);

// GET /api/estaciones — Estaciones de carga (RF07)
router.get('/estaciones', obtenerEstaciones);

module.exports = router;
