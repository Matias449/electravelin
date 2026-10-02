/**
 * index.js — Punto de entrada del servidor Express de Electravelin
 */

const express = require('express');
const cors = require('cors');
const routeRoutes = require('./routes/routeRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware Global ─────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Logging básico de requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ─── Rutas de la API ───────────────────────────────────────────────────────────
app.use('/api', routeRoutes);

// ─── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', servicio: 'Electravelin API', version: '1.0.0-mvp' });
});

// ─── Manejo de rutas no encontradas ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ─── Manejo global de errores ──────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR GLOBAL]', err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ─── Iniciar servidor ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n⚡ Electravelin API corriendo en http://localhost:${PORT}`);
  console.log(`   Endpoints disponibles:`);
  console.log(`   POST /api/calcular-ruta`);
  console.log(`   GET  /api/vehiculos`);
  console.log(`   GET  /api/ciudades`);
  console.log(`   GET  /api/estaciones`);
  console.log(`   GET  /api/health\n`);
});
