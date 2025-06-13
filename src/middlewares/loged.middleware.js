const jwt = require('jsonwebtoken');

const isLoggedMiddleware = (req, res, next) => {
  const token = req.cookies.auth_cookie;

  if (!token) {
    return res.status(401).json({
      message: 'No estas autorizado (necesitas estar enviar un token)',
    });
  }

  try {
    const user = jwt.verify(token, 'claveSecretaQueNadieDebeSaber');

    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({
      message: 'No estas autorizado (token invalido)',
    });
  }
};

module.exports = isLoggedMiddleware;
