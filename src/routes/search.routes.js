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
      error: 'Debes ingresar un término para buscar.',
    });
  }

  try {
    const connection = await initConnection();

    // Buscar Usuarios
    const [users] = await connection.query(
      `SELECT id, name, last_name, username, image_profile
       FROM users
       WHERE (name LIKE ? OR last_name LIKE ? OR username LIKE ?)
         AND id <> ?`,
      [`%${query}%`, `%${query}%`, `%${query}%`, req.usuario.id]
    );

    // Buscar Álbumes
    const [albums] = await connection.query(
      `SELECT a.*, u.username as owner_username 
       FROM albums a
       JOIN users u ON a.id_user = u.id
       WHERE a.title LIKE ?`,
      [`%${query}%`]
    );

    // Buscar Imágenes (por título o por tag)
    const [images] = await connection.query(
      `SELECT DISTINCT i.*, u.username as owner_username
       FROM images i
       JOIN albums a ON i.id_album = a.id
       JOIN users u ON a.id_user = u.id
       LEFT JOIN image_tag it ON i.id = it.id_image
       LEFT JOIN tags t ON it.id_tag = t.id
       WHERE i.title LIKE ? OR t.name_tag LIKE ?`,
      [`%${query}%`, `%${query}%`]
    );

    res.render('user-search', {
      user: req.usuario,
      results: { users, albums, images },
      error: (users.length === 0 && albums.length === 0 && images.length === 0) ? 'No se encontraron resultados.' : null,
    });

  } catch (error) {
    console.error('Error en búsqueda:', error);
    res.status(500).render('user-search', {
      user: req.usuario,
      results: { users: [], albums: [], images: [] },
      error: 'Ocurrió un error en la búsqueda.',
    });
  }
});

module.exports = router;
