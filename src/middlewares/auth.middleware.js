const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.cookies.auth_cookie;

  if (!token) {
    return res.redirect("/auth/login?error=No%20estas%20logueado");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_CLAVE);
    req.usuario = decoded;
    res.locals.usuarioLogueado = decoded;
    next();
  } catch (error) {
    console.error('Error al verificar el token:', error);
    return res.redirect("/auth/login?error=Token%20no%20valido");
  }
};

module.exports = authMiddleware;