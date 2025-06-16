const express = require('express');
const router = express.Router();
const { initConnection } = require('../database/connection');
const authMiddleware = require('../middlewares/auth.middleware');

// Ruta: GET /users/search
router.get('/search', authMiddleware, async (req, res) => {
  const query = req.query.query?.trim();

  if (!query) {
    return res.render('user-search', {
      user: req.usuario,
      results: [],
      error: 'Debes ingresar un término para buscar.'
    });
  }

  try {
    const connection = await initConnection();

    const [results] = await connection.query(
      `SELECT id, name, last_name, username, image_profile
       FROM users
       WHERE (name LIKE ? OR last_name LIKE ? OR username LIKE ?)
         AND id <> ?`,
      [`%${query}%`, `%${query}%`, `%${query}%`, req.usuario.id]
    );

    res.render('user-search', {
      user: req.usuario,
      results,
      error: results.length === 0 ? 'No se encontraron usuarios.' : null
    });

  } catch (error) {
    console.error('Error en búsqueda:', error);
    res.status(500).render('user-search', {
      user: req.usuario,
      results: [],
      error: 'Ocurrió un error en la búsqueda.'
    });
  }
});

module.exports = router;
