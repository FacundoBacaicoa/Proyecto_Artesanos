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
      `SELECT * FROM \`friendships\` 
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



module.exports = router;
