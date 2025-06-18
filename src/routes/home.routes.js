const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { initConnection } = require('../database/connection');
const authMiddleware = require('../middlewares/auth.middleware');
const upload = require('../config/multer');

// Ruta principal: /home
// /home.routes.js
router.get('/home', authMiddleware, async (req, res) => {
  try {
    const connection = await initConnection();

    // 🚩 Traer datos del usuario actualizado (con su imagen de perfil)
    const [userRows] = await connection.query(
      'SELECT * FROM users WHERE id = ?', [req.usuario.id]
    );
    const user = userRows[0];
    // Álbumes del usuario
    const [albums] = await connection.query(
      'SELECT * FROM albums WHERE id_user = ?', [user.id]
    );

    // Agregar imágenes a los álbumes
   // Agregar imágenes a los álbumes
for (let album of albums) {
  const [images] = await connection.query(
    'SELECT * FROM images WHERE id_album = ?', [album.id]
  );

  for (let img of images) {
    // Traer comentarios
    const [comments] = await connection.query(
      `SELECT c.*, u.name, u.last_name, u.image_profile
        FROM comments c
        JOIN users u ON c.id_user = u.id
        WHERE c.id_image = ?
        ORDER BY c.created_time DESC`,
      [img.id]
    );
    img.comments = comments;

    // Traer tags
    const [tags] = await connection.query(
      `SELECT t.name_tag
         FROM image_tag it
         JOIN tags t ON t.id = it.id_tag
        WHERE it.id_image = ?`,
      [img.id]
    );
    img.tags = tags.map(t => t.name_tag);
  }

  album.images = images;
}
    // 🔔 Notificaciones de solicitudes de amistad
    const [notifications] = await connection.query(
      `SELECT * FROM notifications 
       WHERE id_user = ? 
       AND type = 'friendship' 
       ORDER BY created_time DESC`,
      [user.id]
    );
 console.log(notifications);

 const [friends] = await connection.query(
  `SELECT u.id, u.name, u.last_name, u.username, u.image_profile
   FROM users u
   JOIN \`friendships\` f ON (
        (f.id_sender = ? AND f.id_receiver = u.id) OR
        (f.id_receiver = ? AND f.id_sender = u.id)
   )
   WHERE f.request_status = 'accepted'`,
  [user.id, user.id]  
);

const [followers] = await connection.query(`
  SELECT u.id, u.name, u.last_name, u.username, u.image_profile
  FROM users u
  JOIN \`friendships\` f ON f.id_sender = u.id
  WHERE f.id_receiver = ? AND f.request_status = 'accepted'
`, [user.id]);
    // Renderizar home con notificaciones
    res.render('home', {
      user,
      albums,
      notifications,
      friends,
      followers,
      error: null
    });

  } catch (error) {
    console.error('Error en /home:', error);
    res.render('home', {
      user: req.usuario,
      albums: [],
      notifications: [],
      friends:[],
      error: 'Error al obtener los álbumes'
    });
  }
});

// Vista para crear un nuevo álbum
router.get('/albums/new', authMiddleware, (req, res) => {
  res.render('album-new', { user: req.usuario, error: null });
});

// Crear nuevo álbum
router.post('/albums/new', authMiddleware, upload.single('front_page'), async (req, res) => {
  const { title, description } = req.body;
  const frontPage = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const connection = await initConnection();
    await connection.query(
      'INSERT INTO albums (title, description, front_page, id_user) VALUES (?, ?, ?, ?)',
      [title, description, frontPage, req.usuario.id]
    );
    res.redirect('/home');
  } catch (error) {
    console.error('Error al crear álbum:', error);
    res.render('album-new', { user: req.usuario, error: 'No se pudo crear el álbum.' });
  }
});

// Ver un álbum específico con sus imágenes
router.get('/albums/:id', authMiddleware, async (req, res) => {
  const albumId = req.params.id;

  try {
    const connection = await initConnection();

    // Verificar que el álbum exista y pertenezca al usuario
    const [albumRows] = await connection.query(
      'SELECT * FROM albums WHERE id = ? AND id_user = ?',
      [albumId, req.usuario.id]
    );

    if (albumRows.length === 0) {
      return res.status(404).send('Álbum no encontrado o no autorizado.');
    }

    const album = albumRows[0];

    // Obtener imágenes del álbum
    const [images] = await connection.query(
      'SELECT * FROM images WHERE id_album = ?',
      [albumId]
    );

    // Renderizar vista del álbum individual
    res.render('album-detail', {
      user: req.usuario,
      album,
      images
    });

  } catch (error) {
    console.error('Error al obtener imágenes del álbum:', error);
    res.status(500).send('Error interno al cargar el álbum.');
  }
});

// Vista de edición del álbum
router.get('/albums/:id/edit', authMiddleware, async (req, res) => {
  const albumId = req.params.id;

  try {
    const connection = await initConnection();

    // Validar que el álbum exista y pertenezca al usuario
    const [rows] = await connection.query(
      'SELECT * FROM albums WHERE id = ? AND id_user = ?',
      [albumId, req.usuario.id]
    );

    if (rows.length === 0) {
      return res.status(404).send('Álbum no encontrado o no autorizado.');
    }

    res.render('album-edit', {
      user: req.usuario,
      album: rows[0],
      error: null
    });

  } catch (error) {
    console.error('Error al cargar vista de edición:', error);
    res.status(500).send('Error al cargar la edición del álbum.');
  }
});

// Procesar edición del álbum
router.post('/albums/:id/edit', authMiddleware, upload.single('front_page'), async (req, res) => {
  const albumId = req.params.id;
  const { title, description } = req.body;
  const frontPage = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const connection = await initConnection();

    // Verificar que el álbum pertenezca al usuario
    const [rows] = await connection.query(
      'SELECT * FROM albums WHERE id = ? AND id_user = ?',
      [albumId, req.usuario.id]
    );

    if (rows.length === 0) {
      return res.status(404).send('Álbum no autorizado o no existe.');
    }

    // Actualizar campos, usando la nueva portada solo si fue enviada
    if (frontPage) {
      await connection.query(
        'UPDATE albums SET title = ?, description = ?, front_page = ? WHERE id = ?',
        [title, description, frontPage, albumId]
      );
    } else {
      await connection.query(
        'UPDATE albums SET title = ?, description = ? WHERE id = ?',
        [title, description, albumId]
      );
    }

    res.redirect('/home');
  } catch (error) {
    console.error('Error al actualizar álbum:', error);
    res.render('album-edit', {
      user: req.usuario,
      album: { id: albumId, title, description, front_page: rows[0]?.front_page },
      error: 'No se pudo actualizar el álbum.'
    });
  }
});

// Eliminar álbum
router.post('/albums/:id/delete', authMiddleware, async (req, res) => {
  const albumId = req.params.id;

  try {
    const connection = await initConnection();

    // Verificar que el álbum pertenezca al usuario
    const [rows] = await connection.query(
      'SELECT * FROM albums WHERE id = ? AND id_user = ?',
      [albumId, req.usuario.id]
    );

    if (rows.length === 0) {
      return res.status(403).send('No autorizado para eliminar este álbum.');
    }

    // Eliminar el álbum (y gracias al ON DELETE CASCADE se eliminan sus imágenes)
    await connection.query('DELETE FROM albums WHERE id = ?', [albumId]);

    res.redirect('/home');
  } catch (error) {
    console.error('Error al eliminar álbum:', error);
    res.status(500).send('Error al eliminar el álbum.');
  }
});

router.post('/users/:id/report', authMiddleware, async (req, res) => {
  const id_user_reported = parseInt(req.params.id);
  const id_reporter = req.usuario.id;
  const reason = req.body.reason?.trim() || 'Seguidor inapropiado';

  try {
    const connection = await initConnection();

    // Solo permite reportar a alguien que te sigue realmente
    const [rows] = await connection.query(
      `SELECT * FROM \`friendships\` WHERE id_sender = ? AND id_receiver = ? AND request_status = 'accepted'`,
      [id_user_reported, id_reporter]
    );
    if (rows.length === 0) {
      return res.status(403).send('Solo puedes reportar a tus seguidores.');
    }

    // Insertar el reporte
    await connection.query(
      `INSERT INTO reports (id_reporter, id_user_reported, target_id, reason) VALUES (?, ?, ?, ?)`,
      [id_reporter, id_user_reported, id_user_reported, reason]
    );

    res.redirect('/home');
  } catch (error) {
    console.error('Error al reportar seguidor:', error);
    res.status(500).send('Error al reportar seguidor.');
  }
});



module.exports = router;
