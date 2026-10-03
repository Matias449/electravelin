const crypto = require('crypto');
const path = require('path');
const express = require('express');
const cors = require('cors');
const createRouteRoutes = require('./routes/routeRoutes');
const { createAuthRoutes } = require('./routes/authRoutes');
const { createAccountRoutes } = require('./routes/accountRoutes');
const { createAdminRoutes } = require('./routes/adminRoutes');
const { createAccountController } = require('./controllers/accountController');
const { createCatalogController } = require('./controllers/catalogController');
const { createCityController } = require('./controllers/cityController');
const { createStore } = require('./services/dataStore');
const { createLogger } = require('./services/logger');
const { createAuthService } = require('./services/authService');
const { createAuditService } = require('./services/auditService');
const { createCatalogService } = require('./services/catalogService');
const { createAccountService } = require('./services/accountService');
const { createAuthMiddleware } = require('./middleware/auth');
const { createRequestContext } = require('./middleware/requestContext');
const { createRoutePlanningService } = require('./services/routePlanningService');
const { createSecConnectorService } = require('./services/secConnectorService');
const { loadEnvironment } = require('./config/loadEnvironment');
const seedVehicles = require('./data/vehicles.json');
const seedStations = require('./data/stations.json');

const VERSION = '2.0.0-mvp';

function resolveJwtSecret(logger) {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET es obligatorio en producción.');
  }
  logger.warn('jwt_secret_efimero', {
    mensaje: 'JWT_SECRET no está definido; se generó uno efímero. Define JWT_SECRET para conservar sesiones entre reinicios.',
  });
  return crypto.randomBytes(32).toString('hex');
}

function ensureBootstrapAdmin(store, authService, logger) {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  const existing = store.find('users', (user) => user.email === String(email).trim().toLowerCase());
  if (existing) return;
  try {
    authService.register({ nombre: 'Administrador', email, password, rol: 'admin' });
    logger.info('admin_bootstrap_creado', { email });
  } catch (error) {
    logger.error('admin_bootstrap_fallido', { message: error.message });
  }
}

function createApp({ routePlanner, store, jwtSecret, logger } = {}) {
  const log = logger || createLogger();
  const dataStore = store || createStore({
    filePath: process.env.DATA_FILE || path.resolve(__dirname, '../data/electravelin.json'),
    seed: { vehicles: seedVehicles, stations: seedStations },
  });

  const authService = createAuthService({ store: dataStore, jwtSecret: jwtSecret || resolveJwtSecret(log) });
  ensureBootstrapAdmin(dataStore, authService, log);

  const auditService = createAuditService({ store: dataStore });
  const catalogService = createCatalogService({ store: dataStore });
  const accountService = createAccountService({ store: dataStore });
  const secConnectorService = createSecConnectorService({ store: dataStore, logger: log });
  const authMiddleware = createAuthMiddleware({ authService });

  const catalogController = createCatalogController({ catalogService, auditService, secConnectorService });
  const accountController = createAccountController({ authService, accountService, catalogService, auditService });
  const cityController = createCityController();

  const planner = routePlanner || (() => createRoutePlanningService({
    vehicles: catalogService.listVehicles(),
    stations: catalogService.listStations(),
  }));

  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));
  app.use(createRequestContext({ logger: log }));

  app.use('/api/auth', createAuthRoutes({ accountController, authMiddleware }));
  app.use('/api', createAccountRoutes({ accountController, authMiddleware }));
  app.use('/api/admin', createAdminRoutes({ catalogController, authMiddleware }));
  app.use('/api', createRouteRoutes({ routePlanner: planner, catalogController, cityController, logger: log }));

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      servicio: 'Electravelin API',
      version: VERSION,
      uptime_s: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  });

  app.get('/api/ready', (req, res) => {
    try {
      dataStore.all('vehicles');
      const checks = {
        almacen: 'ok',
        ruteoConfigurado: Boolean(process.env.ORS_API_KEY || process.env.OSRM_BASE_URL || process.env.ROUTING_PROVIDER !== 'openrouteservice'),
        proveedorRuteo: process.env.ROUTING_PROVIDER || (process.env.ORS_API_KEY ? 'openrouteservice' : 'osrm'),
      };
      return res.status(200).json({ status: 'ready', checks, requestId: req.requestId });
    } catch (error) {
      log.error('ready_check_failed', { requestId: req.requestId, message: error.message });
      return res.status(503).json({ status: 'unavailable', checks: { almacen: 'error' }, requestId: req.requestId });
    }
  });

  app.use((req, res) => res.status(404).json({ exito: false, code: 'NOT_FOUND', error: 'Ruta no encontrada' }));

  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ exito: false, code: 'INVALID_JSON', error: 'El cuerpo de la solicitud no es JSON válido.' });
    }
    log.error('unhandled_error', {
      requestId: req.requestId,
      message: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ exito: false, code: 'INTERNAL_ERROR', error: 'Error interno del servidor' });
  });

  return app;
}

if (require.main === module) {
  loadEnvironment();
  const logger = createLogger();
  const port = process.env.PORT || 3001;
  createApp({ logger }).listen(port, () => {
    logger.info('server_started', { port, version: VERSION });
  });
}

module.exports = { createApp, ensureBootstrapAdmin };
