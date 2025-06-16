const express = require('express');
const router = express.Router();
const { initConnection } = require('../database/connection');
const authMiddleware = require('../middlewares/auth.middleware');

// Agregar comentario
router.post('/add', authMiddleware, async (req, res) => {
  const { id_image, content } = req.body;
  const id_user = req.usuario.id;

  try {
    const connection = await initConnection();
    await connection.query(
      'INSERT INTO comments (id_user, id_image, content) VALUES (?, ?, ?)',
      [id_user, id_image, content.trim()]
    );
    res.redirect('/home');
  } catch (error) {
    console.error('Error al agregar comentario:', error);
    res.status(500).send('Error al comentar la imagen.');
  }
});

module.exports = router;
