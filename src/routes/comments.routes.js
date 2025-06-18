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

    // Insertar el comentario
    await connection.query(
      'INSERT INTO comments (id_user, id_image, content) VALUES (?, ?, ?)',
      [id_user, id_image, content.trim()]
    );

    // Traer el comentario recién insertado con datos de usuario (el último insert)
    const [comments] = await connection.query(`
      SELECT c.*, u.name, u.last_name, u.image_profile
      FROM comments c
      JOIN users u ON c.id_user = u.id
      WHERE c.id_image = ?
      ORDER BY c.created_time DESC
      LIMIT 1
    `, [id_image]);

    // Respondé con el comentario nuevo (como objeto JSON)
    res.json({
      success: true,
      comment: comments[0]
    });
  } catch (error) {
    console.error('Error al agregar comentario:', error);
    res.status(500).json({ success: false, message: 'Error al comentar la imagen.' });
  }
});

module.exports = router;
