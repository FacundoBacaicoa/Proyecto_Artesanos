const express = require('express');
const router = express.Router();
const { initConnection } = require('../database/connection');
const authMiddleware = require('../middlewares/auth.middleware');

// Ver perfil de un usuario específico
router.get('/:id', authMiddleware, async (req, res) => {
  const userId = req.params.id;

  try {
    const connection = await initConnection();

    // Usuario cuyo perfil se quiere ver
    const [users] = await connection.query('SELECT * FROM users WHERE id = ?', [userId]);
    const profile = users[0];

    if (!profile) {
      return res.status(404).send('Usuario no encontrado');
    }

    // Álbumes del perfil
    const [albums] = await connection.query('SELECT * FROM albums WHERE id_user = ?', [userId]);

    res.render('user-profile', { user: req.usuario, profile, albums });
  } catch (error) {
    console.error('Error al cargar perfil:', error);
    res.status(500).send('Error al cargar el perfil del usuario.');
  }
});

module.exports = router;
