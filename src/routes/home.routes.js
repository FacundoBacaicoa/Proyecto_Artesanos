const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { initConnection } = require('../database/connection');
const authMiddleware = require('../middlewares/auth.middleware');

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

    // Renderizar vista
    res.render('home', {
      user: req.usuario,
      albums,
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
router.post('/albums/new', authMiddleware, async (req, res) => {
  const { title, description } = req.body;
  try {
    const connection = await initConnection();
    await connection.query(
      'INSERT INTO albums (title, description, id_user) VALUES (?, ?, ?)',
      [title, description, req.usuario.id]
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

module.exports = router;
