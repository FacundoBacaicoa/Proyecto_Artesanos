const express = require('express');
const router = express.Router();
const { initConnection } = require('../database/connection');
const authMiddleware = require('../middlewares/auth.middleware');

// Ver perfil de un usuario específico
router.get('/:id', authMiddleware, async (req, res) => {
  const userId = parseInt(req.params.id);

  try {
    const connection = await initConnection();

    // Usuario cuyo perfil se quiere ver
    const [users] = await connection.query('SELECT * FROM users WHERE id = ?', [userId]);
    const profile = users[0];
    if (!profile) return res.status(404).send('Usuario no encontrado');

    // Chequear si el usuario logueado es amigo (seguidor) del perfil visitado
    let friendshipStatus = null;
    let areFriends = false;

    if (userId !== req.usuario.id) {
      // Solo cuenta si el usuario logueado (yo) le mandé solicitud a él y él la aceptó
      const [friendship] = await connection.query(
        `SELECT * FROM friendships 
         WHERE id_sender = ? AND id_receiver = ?`,
        [req.usuario.id, userId]
      );
      if (friendship.length > 0) {
        friendshipStatus = friendship[0].request_status;
        areFriends = friendship[0].request_status === 'accepted';
      }
    } else {
      areFriends = true; // Puedo ver mis propios álbumes
    }

    let albums = [];
    if (areFriends) {
      // Solo si yo soy amigo (seguidor) del perfil, o es mi perfil, veo los álbumes
      [albums] = await connection.query('SELECT * FROM albums WHERE id_user = ?', [userId]);
      for (let album of albums) {
        const [images] = await connection.query('SELECT * FROM images WHERE id_album = ?', [album.id]);
        for (let img of images) {
          const [comments] = await connection.query(`
            SELECT c.*, u.name, u.last_name, u.image_profile
            FROM comments c
            JOIN users u ON c.id_user = u.id
            WHERE c.id_image = ?
            ORDER BY c.created_time ASC
          `, [img.id]);
          img.comments = comments;
        }
        album.images = images;
      }
    }

    res.render('user-profile', { user: req.usuario, profile, albums, friendshipStatus, areFriends });
  } catch (error) {
    console.error('Error al cargar perfil:', error);
    res.status(500).send('Error al cargar el perfil del usuario.');
  }
});



// Enviar solicitud de amistad
router.post('/:id/request-friend', authMiddleware, async (req, res) => {
  const receiverId = parseInt(req.params.id);
  const senderId = req.usuario.id;

  if (receiverId === senderId) {
    return res.status(400).send("No puedes enviarte una solicitud a vos mismo.");
  }

  try {
    const connection = await initConnection();

    // Verificar si ya existe una solicitud entre ambos
    const [existing] = await connection.query(
      `SELECT * FROM friendships 
       WHERE (id_sender = ? AND id_receiver = ?) 
          OR (id_sender = ? AND id_receiver = ?)`,
      [senderId, receiverId, receiverId, senderId]
    );

    if (existing.length > 0) {
      return res.redirect(`/users/${receiverId}`); // ya existe alguna relación
    }

    // Insertar solicitud de amistad
    await connection.query(
      'INSERT INTO friendships (id_sender, id_receiver, request_status) VALUES (?, ?, ?)',
      [senderId, receiverId, 'pending']
    );

    // Crear notificación
    await connection.query(
      'INSERT INTO notifications (id_user, type, menssage, reference_id) VALUES (?, ?, ?, ?)',
      [receiverId, 'friendship', `¡${req.usuario.name} te envió una solicitud de amistad!`, senderId]
    );

    res.redirect(`/users/${receiverId}`);
  } catch (error) {
    console.error('Error al enviar solicitud:', error);
    res.status(500).send('Error al enviar solicitud de amistad.');
  }
});

//Aceptar o rechazar
router.post('/:id/friend-request-response', authMiddleware, async (req, res) => {
  const receiverId = req.usuario.id;
  const senderId = parseInt(req.params.id);
  const { action, notification_id } = req.body;

  try {
    const connection = await initConnection();

    if (action === 'accept') {
      await connection.query(
        `UPDATE friendships SET request_status = 'accepted' 
         WHERE id_sender = ? AND id_receiver = ?`,
        [senderId, receiverId]
      );
    } else if (action === 'reject') {
      await connection.query(
        `UPDATE friendships SET request_status = 'rejected' 
         WHERE id_sender = ? AND id_receiver = ?`,
        [senderId, receiverId]
      );
    }

    await connection.query('DELETE FROM notifications WHERE id = ?', [notification_id]);

    res.redirect('/home');
  } catch (error) {
    console.error('Error al responder solicitud:', error);
    res.status(500).send('Error al procesar la solicitud.');
  }
});

// Eliminar amistad
router.post('/:id/delete-friend', authMiddleware, async (req, res) => {
  const userId1 = req.usuario.id;
  const userId2 = parseInt(req.params.id);

  try {
    const connection = await initConnection();
    // Borrar la relación en ambas direcciones
    await connection.query(
      `DELETE FROM friendships 
        WHERE (id_sender = ? AND id_receiver = ?) 
           OR (id_sender = ? AND id_receiver = ?)`,
      [userId1, userId2, userId2, userId1]
    );
    res.redirect(`/users/${userId2}`);
  } catch (error) {
    console.error('Error al eliminar amistad:', error);
    res.status(500).send('Error al eliminar amistad.');
  }
});





module.exports = router;
