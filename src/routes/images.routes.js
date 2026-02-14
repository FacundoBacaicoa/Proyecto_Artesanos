const express = require('express');
const router = express.Router();
const upload = require('../config/multer');
const authMiddleware = require('../middlewares/auth.middleware');
const { initConnection } = require('../database/connection');
const { emitToUser } = require('../socket/socket');

// Ruta para subir imágenes a un álbum
router.post('/upload', authMiddleware, upload.single('image'), async (req, res) => {
  const { title, id_album, tags, is_shared } = req.body;
  const shared = is_shared === 'on' || is_shared === true || is_shared === 'true';

  if (!req.file) return res.status(400).send('No se subió ninguna imagen.');

  const imagePath = `/uploads/${req.file.filename}`;
  const connection = await initConnection();

  try {
    // ... (omitting count check for brevity in replacement, but wait, I must keep it)
    const [imageCountResult] = await connection.query(
      'SELECT COUNT(*) as count FROM images WHERE id_album = ?',
      [id_album]
    );
    if (imageCountResult[0].count >= 20) {
      return res.status(400).send('El álbum ya alcanzó el límite de 20 imágenes.');
    }

    // Insertar imagen con is_shared
    const [result] = await connection.query(
      'INSERT INTO images (title, routh_image, id_album, is_shared) VALUES (?, ?, ?, ?)',
      [title, imagePath, id_album, shared]
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

// Agregar comentario a una imagen
// images.routes.js (agregá esto)
router.post('/comment/:id', authMiddleware, async (req, res) => {
  const imageId = req.params.id;
  // Si es AJAX (Content-Type: application/json) leemos así:
  const content = req.body.content;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Comentario vacío' });
  }

  try {
    const connection = await initConnection();

    // Guardar el comentario
    await connection.query(
      `INSERT INTO comments (id_image, id_user, content, created_time) VALUES (?, ?, ?, NOW())`,
      [imageId, req.usuario.id, content.trim()]
    );

    // Obtener información del dueño de la imagen para la notificación
    const [imageOwnerResult] = await connection.query(
      `SELECT i.title, a.id_user as owner_id 
       FROM images i 
       JOIN albums a ON i.id_album = a.id 
       WHERE i.id = ?`,
      [imageId]
    );

    if (imageOwnerResult.length > 0) {
      const { title, owner_id } = imageOwnerResult[0];
      const commenterName = `${req.usuario.name} ${req.usuario.last_name}`;
      const excerpt = content.trim().substring(0, 30) + (content.length > 30 ? '...' : '');
      const message = `${commenterName} comentó en tu imagen "${title || 'Sin título'}": "${excerpt}"`;

      // Solo notificar si el que comenta no es el dueño
      if (owner_id !== req.usuario.id) {
        await connection.query(
          `INSERT INTO notifications (id_user, type, message, reference_id) VALUES (?, ?, ?, ?)`,
          [owner_id, 'comment', message, imageId]
        );

        // Emitir tiempo real
        emitToUser(owner_id, 'notification', {
          type: 'comment',
          message,
          reference_id: imageId
        });
      }
    }

    // Traer todos los comentarios actualizados para esa imagen
    const [comments] = await connection.query(
      `SELECT c.*, u.name, u.last_name, u.image_profile 
        FROM comments c 
        JOIN users u ON u.id = c.id_user
        WHERE c.id_image = ?
        ORDER BY c.created_time ASC`,
      [imageId]
    );

    // Devuelve la lista de comentarios como JSON (lo espera tu JS)
    res.json(comments);

  } catch (err) {
    console.error('Error al comentar:', err);
    res.status(500).json({ error: 'No se pudo agregar el comentario.' });
  }
});


module.exports = router;