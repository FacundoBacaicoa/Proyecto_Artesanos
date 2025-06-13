const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { initConnection } = require('../database/connection');



router.get('/home', async (req, res) => {
  try {
    const token = req.cookies.auth_cookie;
    if (!token) {
      return res.redirect('/auth/login');
    }

    const decoded = jwt.verify(token, 'claveSecretaQueNadieDebeSaber');
    res.render('home', { user: decoded });
  } catch (error) {
    res.redirect('/auth/login');
  }
});

module.exports = router;