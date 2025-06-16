const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { initConnection } = require('../database/connection');
const authMiddleware = require('../middlewares/auth.middleware');
const upload = require('../config/multer');

// Ruta principal: /home
router.get('/home', authMiddleware, async (req, res) => {
  try {
    const connection = await initConnection();

    // Obtener álbumes del usuario logueado
    const [albums] = await connection.query(
      'SELECT * FROM albums WHERE id_user = ?', [req.usuario.id]
    );

   // Obtener imágenes asociadas a cada álbum
for (let album of albums) {
  const [images] = await connection.query(
    'SELECT * FROM images WHERE id_album = ?', [album.id]
  );
  album.images = images;
}

// Obtener todas las etiquetas disponibles
const [tags] = await connection.query('SELECT * FROM tags');

// Renderizar home con tags también
res.render('home', {
  user: req.usuario,
  albums,
  tags,
  error: null
});

  } catch (error) {
    console.error('Error en /home:', error);
    res.render('home', {
      user: req.usuario,
      albums: [],
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


module.exports = router;
