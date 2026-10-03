const express = require('express');

function createAccountRoutes({ accountController, authMiddleware }) {
  const router = express.Router();

  router.put('/perfil', authMiddleware.requireAuth, accountController.updateProfile);
  router.get('/viajes', authMiddleware.requireAuth, accountController.listTrips);
  router.post('/viajes', authMiddleware.requireAuth, accountController.saveTrip);
  router.get('/viajes/:id', authMiddleware.requireAuth, accountController.getTrip);
  router.delete('/viajes/:id', authMiddleware.requireAuth, accountController.deleteTrip);
  router.get('/favoritos', authMiddleware.requireAuth, accountController.listFavorites);
  router.post('/favoritos', authMiddleware.requireAuth, accountController.addFavorite);
  router.delete('/favoritos/:id', authMiddleware.requireAuth, accountController.removeFavorite);

  return router;
}

module.exports = { createAccountRoutes };
