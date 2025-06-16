const express = require('express');
const router = express.Router();
const upload = require('../config/multer');
const authMiddleware = require('../middlewares/auth.middleware');
const { initConnection } = require('../database/connection');

// Ruta para subir imágenes a un álbum
router.post('/upload', authMiddleware, upload.single('image'), async (req, res) => {
  const { title, id_album, tags } = req.body;

  if (!req.file) return res.status(400).send('No se subió ninguna imagen.');

  const imagePath = `/uploads/${req.file.filename}`;
  const connection = await initConnection();

  try {
    // Insertar imagen
    const [result] = await connection.query(
      'INSERT INTO images (title, routh_image, id_album) VALUES (?, ?, ?)',
      [title, imagePath, id_album]
    );

    const imageId = result.insertId;

    // Procesar tags
    if (tags) {
      const tagsArray = Array.isArray(tags)
        ? tags
        : tags.split(',').map(t => t.trim()).filter(t => t);

      for (let tagName of tagsArray) {
        // Buscar o crear el tag
        const [existing] = await connection.query('SELECT id FROM tags WHERE name_tag = ?', [tagName]);
        let tagId;

        if (existing.length > 0) {
          tagId = existing[0].id;
        } else {
          const [newTagResult] = await connection.query(
            'INSERT INTO tags (name_tag) VALUES (?)',
            [tagName]
          );
          tagId = newTagResult.insertId;
        }

        // Relacionar imagen con tag
        await connection.query(
          'INSERT INTO image_tag (id_image, id_tag) VALUES (?, ?)',
          [imageId, tagId]
        );
      }
    }

    res.redirect('/home');
  } catch (error) {
    console.error('Error al subir imagen:', error);
    res.status(500).send('Error al subir imagen.');
  }
});

// Eliminar imagen
router.post('/delete/:id', authMiddleware, async (req, res) => {
  const imageId = req.params.id;
  try {
    const connection = await initConnection();

    await connection.query('DELETE FROM image_tag WHERE id_image = ?', [imageId]);
    await connection.query('DELETE FROM images WHERE id = ?', [imageId]);

    res.redirect('/home');
  } catch (error) {
    console.error('Error al eliminar imagen:', error);
    res.status(500).send('Error al eliminar imagen.');
  }
});

module.exports = router;