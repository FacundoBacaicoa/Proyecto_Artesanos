const { initConnection } = require('../database/connection');

const viewDataMiddleware = async (req, res, next) => {
    // Solo si el usuario está logueado
    if (req.usuario) {
        try {
            const connection = await initConnection();

            // Traer datos del usuario actual (por si cambió algo como la foto)
            const [userRows] = await connection.query(
                'SELECT * FROM users WHERE id = ?', [req.usuario.id]
            );

            if (userRows.length > 0) {
                res.locals.user = userRows[0];

                // Traer notificaciones no leídas
                const [notifications] = await connection.query(
                    `SELECT * FROM notifications 
           WHERE id_user = ? 
           AND is_read = FALSE
           ORDER BY created_time DESC`,
                    [req.usuario.id]
                );
                res.locals.notifications = notifications;
            } else {
                res.locals.user = null;
                res.locals.notifications = [];
            }
        } catch (error) {
            console.error('Error in viewDataMiddleware:', error);
            res.locals.user = req.usuario;
            res.locals.notifications = [];
        }
    } else {
        res.locals.user = null;
        res.locals.notifications = [];
    }
    next();
};

module.exports = viewDataMiddleware;
