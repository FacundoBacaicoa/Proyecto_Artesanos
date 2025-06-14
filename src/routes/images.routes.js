const express = require('express');
const router = express.Router();
const upload = require('../config/multer');
const authMiddleware = require('../middlewares/auth.middleware');
const { initConnection } = require('../database/connection');

// Ruta para subir imágenes a un álbum
router.post('/upload', authMiddleware, upload.single('image'), async (req, res) => {
  const { title, id_album } = req.body;

  if (!req.file) {
    return res.status(400).send('No se subió ninguna imagen.');
  }

  const imagePath = `/uploads/${req.file.filename}`;

  try {
    const connection = await initConnection();
        await connection.query(
        'INSERT INTO images (title, routh_image, id_album) VALUES (?, ?, ?)',
        [title, imagePath, id_album]
        );
    res.redirect('/home');
  } catch (error) {
    console.error('Error al subir imagen:', error);
    res.status(500).send('Error interno al subir la imagen.');
  }
});

module.exports = router;
