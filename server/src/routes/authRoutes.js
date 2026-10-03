const express = require('express');

function createAuthRoutes({ accountController, authMiddleware }) {
  const router = express.Router();

  router.post('/register', accountController.register);
  router.post('/login', accountController.login);
  router.get('/me', authMiddleware.requireAuth, accountController.me);

  return router;
}

module.exports = { createAuthRoutes };
