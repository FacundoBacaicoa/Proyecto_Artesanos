const loginMiddleware = (req, res, next) => {
  const { username, password } = req.body;

  if (!username) {
    return res.status(400).json({
      message: 'El username es obligatorio',
    });
  }

  if (!password) {
    return res.status(400).json({
      message: 'El password es obligatorio',
    });
  }

  next();
};

module.exports = loginMiddleware;
