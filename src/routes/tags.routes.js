const express = require('express');
const router = express.Router();
const { initConnection } = require('../database/connection');
const authMiddleware = require('../middlewares/auth.middleware');

// Mostrar formulario para crear tag
router.get('/tags/new', authMiddleware, (req, res) => {
  res.render('modales-home', { user: req.usuario, error: null });
});

// Procesar creación de tag
router.post('/tags/new', authMiddleware, async (req, res) => {
  const { name } = req.body;

  try {
    const connection = await initConnection();

    // Verificar que no exista
    const [existing] = await connection.query('SELECT * FROM tags WHERE name_tag = ?', [name]);
    if (existing.length > 0) {
      return res.render('modales-home', { user: req.usuario, error: 'Ya existe una etiqueta con ese nombre' });
    }

    // Insertar
    await connection.query('INSERT INTO tags (name_tag) VALUES (?)', [name]);

    res.redirect('/home');
  } catch (error) {
    console.error('Error al crear tag:', error);
    res.render('modales-home', { user: req.usuario, error: 'Error al crear la etiqueta' });
  }
});

module.exports = router;
