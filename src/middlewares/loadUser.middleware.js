const jwt = require('jsonwebtoken');

const loadUser = (req, res, next) => {
    const token = req.cookies.auth_cookie;

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_CLAVE);
            req.usuario = decoded;
            res.locals.usuarioLogueado = decoded;
        } catch (error) {
            console.error('Error al verificar el token (loadUser):', error);
            // No hacemos redirect, solo no seteamos el usuario
        }
    }
    next();
};

module.exports = loadUser;
