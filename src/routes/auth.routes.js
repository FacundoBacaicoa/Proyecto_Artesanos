const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const upload = require('../config/multer');
const authMiddleware = require('../middlewares/auth.middleware');
const { initConnection } = require('../database/connection');
const loginMiddleware = require('../middlewares/login.middleware');


// Mostrar formulario de registro
router.get('/auth/register', (req, res) => {
  res.render('register', {
    error: null,
    name: '',
    last_name: '',
    username: '',
    email: ''
  });
});

// Procesar formulario de registro
router.post('/auth/register', async (req, res) => {
  try {
    const { name, last_name, username, email, password, confirm_password } = req.body;

    // 1. Validar campos obligatorios
    if (!name || !last_name || !username || !email || !password || !confirm_password) {
      return res.render('register', {
        error: 'Todos los campos son obligatorios',
        name, last_name, username, email
      });
    }

    // 2. Validar que las contraseñas coincidan
    if (password !== confirm_password) {
      return res.render('register', {
        error: 'Las contraseñas no coinciden',
        name, last_name, username, email
      });
    }

    const connection = await initConnection();

    // 3. Verificamos si ya existe el email o username
    const [existing] = await connection.query(
      'SELECT * FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existing.length > 0) {
      const conflict = existing[0];

      if (conflict.email === email) {
        return res.render('register', {
          error: 'El email ya está registrado',
          name, last_name, username, email
        });
      }

      if (conflict.username === username) {
        return res.render('register', {
          error: 'El nombre de usuario ya está en uso',
          name, last_name, username, email
        });
      }
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    await connection.query(
      'INSERT INTO users (name, last_name, username, email, pass) VALUES (?, ?, ?, ?, ?)',
      [name, last_name, username, email, hashedPassword]
    );

    res.redirect('/auth/login');
  } catch (error) {
    console.error(error);
    res.render('register', {
      error: 'Ocurrió un error al registrar el usuario',
      name: req.body.name,
      last_name: req.body.last_name,
      username: req.body.username,
      email: req.body.email
    });
  }
});

// Mostrar formulario de login
router.get('/auth/login', (req, res) => {
  res.render('login', { error: null });
});


// Procesar login
router.post('/auth/login', [loginMiddleware], async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.render('login', { error: 'Por favor, completa todos los campos' });
    }

    const connection = await initConnection();
    const [userResult] = await connection.query(
      'SELECT * FROM users WHERE username = ?', [username]
    );
    const user = userResult[0];

    if (!user) {
      return res.render('login', { error: 'El usuario no existe' });
    }

    const isValidPassword = bcrypt.compareSync(password, user.pass);
    if (!isValidPassword) {
      return res.render('login', { error: 'Contraseña incorrecta' });
    }

    const payload = {
      id: user.id,
      name: user.name,
      last_name: user.last_name,
      username: user.username,
      email: user.email,
      image_profile: user.image_profile // <--- agregalo acá
    };


    const token = jwt.sign(payload, process.env.JWT_CLAVE);

    res.cookie('auth_cookie', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    res.redirect('/home'); // Redirigí donde corresponda
  } catch (error) {
    res.render('login', { error: 'Ocurrió un error al iniciar sesión' });
  }
});

// Logout
router.post('/auth/logout', (req, res) => {
  res.clearCookie('auth_cookie');
  res.redirect('/auth/login');
});

// Mostrar formulario de cambio de contraseña
router.get('/auth/change-password', (req, res) => {
  res.render('change-password', { error: null, success: null });
});

// Procesar cambio de contraseña
router.post('/auth/change-password', async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;

    const connection = await initConnection();
    const [userResult] = await connection.query('SELECT * FROM users WHERE username = ?', [username]);
    const user = userResult[0];

    if (!user) {
      return res.render('change-password', { error: 'Usuario no encontrado', success: null });
    }

    const isValidPassword = bcrypt.compareSync(currentPassword, user.pass);
    if (!isValidPassword) {
      return res.render('change-password', { error: 'Contraseña actual incorrecta', success: null });
    }

    const hashedNewPassword = bcrypt.hashSync(newPassword, 10);
    await connection.query(
      'UPDATE users SET pass = ? WHERE id = ?',
      [hashedNewPassword, user.id]
    );

    res.render('change-password', { error: null, success: 'Contraseña actualizada correctamente' });
  } catch (error) {
    res.render('change-password', { error: 'Error al cambiar la contraseña', success: null });
  }
});

// Mostrar formulario de edición de perfil
router.get('/auth/details-profile', authMiddleware, async (req, res) => {
  try {
    const token = req.cookies.auth_cookie;
    const payload = jwt.verify(token, process.env.JWT_CLAVE);

    const connection = await initConnection();
    const [result] = await connection.query('SELECT * FROM users WHERE id = ?', [payload.id]);
    const user = result[0];

    res.render('details-profile', {
      user,
      error: null,
      success: null
    });
  } catch (error) {
    console.error(error);
    res.render('details-profile', {
      user: {},
      error: 'No se pudo cargar el perfil',
      success: null
    });
  }
});

// Procesar edición de perfil (con nuevos campos)
router.post('/auth/details-profile', authMiddleware, upload.single('image_profile'), async (req, res) => {
  try {
    const token = req.cookies.auth_cookie;
    const payload = jwt.verify(token, process.env.JWT_CLAVE);
    const { name, last_name, username, email, interest, record } = req.body;

    const connection = await initConnection();

    // Obtené el usuario actual
    const [userResult] = await connection.query('SELECT * FROM users WHERE id = ?', [payload.id]);
    const user = userResult[0];

    // Si hay imagen nueva, usá esa. Si no, mantené la actual.
    let imagePath;
    if (req.file) {
      imagePath = `/uploads/${req.file.filename}`;
    } else {
      imagePath = user.image_profile; // mantiene la anterior
    }

    // Actualizá todo junto
    await connection.query(
      `UPDATE users SET name = ?, last_name = ?, username = ?, email = ?, interest = ?, record = ?, image_profile = ? WHERE id = ?`,
      [name, last_name, username, email, interest, record, imagePath, payload.id]
    );

    // Usá la imagen actualizada para la respuesta
    res.render('details-profile', {
      user: { ...user, name, last_name, username, email, interest, record, image_profile: imagePath },
      error: null,
      success: 'Perfil actualizado correctamente'
    });
  } catch (error) {
    console.error(error);
    res.render('details-profile', {
      user: req.body,
      error: 'Error al actualizar el perfil',
      success: null
    });
  }
});



module.exports = router;
