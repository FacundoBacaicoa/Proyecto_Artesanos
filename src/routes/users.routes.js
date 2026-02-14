const express = require('express');
const router = express.Router();
const { initConnection } = require('../database/connection');
const authMiddleware = require('../middlewares/auth.middleware');
const { emitToUser } = require('../socket/socket');
const loadUser = require('../middlewares/loadUser.middleware');

router.get('/:id', loadUser, async (req, res) => {
  const userId = parseInt(req.params.id);
  const currentUser = req.usuario; // Puede ser null si viene de vitrina

  try {
    const connection = await initConnection();

    // Usuario cuyo perfil se quiere ver
    const [users] = await connection.query('SELECT * FROM users WHERE id = ?', [userId]);
    const profile = users[0];
    if (!profile) return res.status(404).send('Usuario no encontrado');

    // Estadísticas
    const [[{ imgCount }]] = await connection.query('SELECT COUNT(*) as imgCount FROM images i JOIN albums a ON i.id_album = a.id WHERE a.id_user = ?', [userId]);
    const [[{ commentCount }]] = await connection.query('SELECT COUNT(*) as commentCount FROM comments c JOIN images i ON c.id_image = i.id JOIN albums a ON i.id_album = a.id WHERE a.id_user = ?', [userId]);
    const [[{ friendCount }]] = await connection.query("SELECT COUNT(*) as friendCount FROM friendships WHERE (id_sender = ? OR id_receiver = ?) AND request_status = 'accepted'", [userId, userId]);

    profile.stats = { imgCount, commentCount, friendCount };

    // Chequear si el usuario logueado es amigo (seguidor) del perfil visitado
    let friendshipStatus = null;
    let areFriends = false;

    if (currentUser && userId !== currentUser.id) {
      const [friendship] = await connection.query(
        `SELECT * FROM friendships 
         WHERE id_sender = ? AND id_receiver = ?`,
        [currentUser.id, userId]
      );
      if (friendship.length > 0) {
        friendshipStatus = friendship[0].request_status;
        areFriends = friendship[0].request_status === 'accepted';
      }
    } else if (currentUser && userId === currentUser.id) {
      areFriends = true;
    }

    // Modo Vitrina: Si el perfil es público, cualquier visitante (incluso sin login) puede ver álbumes
    const isPublicPortfolio = profile.is_portfolio_public;
    const canViewContent = areFriends || isPublicPortfolio;

    let albums = [];
    if (canViewContent) {
      [albums] = await connection.query('SELECT * FROM albums WHERE id_user = ?', [userId]);
      for (let album of albums) {
        // Si no es el dueño y no es vitrina total, filtrar compartidas
        // Si es vitrina pública, asumimos que se ven las compartidas por defecto
        const imgQuery = (currentUser && userId === currentUser.id)
          ? 'SELECT * FROM images WHERE id_album = ?'
          : 'SELECT * FROM images WHERE id_album = ? AND is_shared = TRUE';

        const [images] = await connection.query(imgQuery, [album.id]);
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

    res.render('user-profile', { user: currentUser, profile, albums, friendshipStatus, areFriends, isPublicPortfolio });
  } catch (error) {
    console.error('Error al cargar perfil:', error);
    res.status(500).send('Error al cargar el perfil del usuario.');
  }
});

// Ruta pública para Modo Vitrina (sin login)
router.get('/vitrina/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const connection = await initConnection();
    const [users] = await connection.query('SELECT id FROM users WHERE username = ?', [username]);
    if (users.length === 0) return res.status(404).send('Usuario no encontrado');

    // Redirigir a la vista de perfil estándar (que ahora maneja acceso público)
    res.redirect(`/users/${users[0].id}`);
  } catch (error) {
    res.status(500).send('Error al cargar vitrina');
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
      const friendship = existing[0];
      // Si ya son amigos o hay una pendiente, no hacemos nada
      if (friendship.request_status !== 'rejected') {
        return res.redirect(`/users/${receiverId}`);
      }
      // Si estaba rechazada, la borramos para permitir una nueva solicitud
      await connection.query('DELETE FROM friendships WHERE id = ?', [friendship.id]);
    }

    // Insertar solicitud de amistad
    await connection.query(
      'INSERT INTO friendships (id_sender, id_receiver, request_status) VALUES (?, ?, ?)',
      [senderId, receiverId, 'pending']
    );

    // Crear notificación
    const [notifResult] = await connection.query(
      'INSERT INTO notifications (id_user, type, message, reference_id) VALUES (?, ?, ?, ?)',
      [receiverId, 'friendship', `¡${req.usuario.name} te envió una solicitud de amistad!`, senderId]
    );

    // Emitir notificación en tiempo real
    emitToUser(receiverId, 'notification', {
      id: notifResult.insertId,
      type: 'friendship',
      message: `¡${req.usuario.name} te envió una solicitud de amistad!`,
      reference_id: senderId
    });

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

      // Obtener datos del usuario que aceptó (B)
      const [receiverRows] = await connection.query('SELECT name, last_name FROM users WHERE id = ?', [receiverId]);
      const receiver = receiverRows[0];
      const albumTitle = `${receiver.name} ${receiver.last_name}`;

      // Crear álbum automático para el que envió la solicitud (A)
      await connection.query(
        'INSERT INTO albums (title, description, id_user, source_user_id) VALUES (?, ?, ?, ?)',
        [albumTitle, `Álbum compartido de ${albumTitle}`, senderId, receiverId]
      );

      // Notificar al sender (A) que su solicitud fue aceptada
      const notificationMessage = `¡${receiver.name} aceptó tu solicitud de amistad!`;
      await connection.query(
        'INSERT INTO notifications (id_user, type, message, reference_id) VALUES (?, ?, ?, ?)',
        [senderId, 'friendship_accepted', notificationMessage, receiverId]
      );

      // Emitir tiempo real
      emitToUser(senderId, 'notification', {
        type: 'friendship_accepted',
        message: notificationMessage,
        reference_id: receiverId
      });

    } else if (action === 'reject') {
      await connection.query(
        `UPDATE friendships SET request_status = 'rejected' 
         WHERE id_sender = ? AND id_receiver = ?`,
        [senderId, receiverId]
      );

      // Notificar al sender (A) que su solicitud fue rechazada
      const [receiverRows] = await connection.query('SELECT name FROM users WHERE id = ?', [receiverId]);
      const notificationMessage = `${receiverRows[0].name} rechazó tu solicitud de amistad.`;
      await connection.query(
        'INSERT INTO notifications (id_user, type, message, reference_id) VALUES (?, ?, ?, ?)',
        [senderId, 'friendship_rejected', notificationMessage, receiverId]
      );

      // Emitir tiempo real
      emitToUser(senderId, 'notification', {
        type: 'friendship_rejected',
        message: notificationMessage,
        reference_id: receiverId
      });
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
