'use strict';

const bcrypt = require('bcrypt');
const boom = require('boom');
const express = require('express');
const jwt = require('jsonwebtoken');
const knex = require('../knex');
const { camelizeKeys } = require('humps');

// eslint-disable-next-line new-cap
const router = express.Router();

router.get('/token', (req, res) => {
  jwt.verify(req.cookies.token, process.env.JWT_KEY, (err, _payload) => {
    if (err) {
      return res.send(false);
    }

    res.send(true);
  });
});

// LOGIN (w/ user-pass from POST data) (create token for sesh)
router.post('/token', (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !email.trim()) {
    return next(boom.create(400, 'Email must not be blank'));
  }

  if (!password || !password.trim()) {
    return next(boom.create(400, 'Password must not be blank'));
  }

  let user;

  knex('users')
    .where('email', email)
    .first()
    .then((row) => {
      if (!row) {
        throw boom.create(400, 'Bad email or password');
      }

      user = camelizeKeys(row);
      return bcrypt.compare(password, user.hashedPassword)
    })
    .then(() => {
      const claim = { userId: user.id };
      const token = jwt.sign(claim, process.env.JWT_KEY, {
        expiresIn: '7 days'  // Adds an exp field to the payload
      });

      res.cookie('token', token, {
        httpOnly: true,
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),  // 7 days
        secure: router.get('env') === 'production'  // Set from the NODE_ENV
      });

      delete user.hashedPassword;
      res.send(user);
    })
    .catch(() => {
      throw boom.create(400, 'Bad email or password');
    })
    .catch((err) => {
      next(err);
    });
});

// LOGOUT (del token)
router.delete('/token', (req, res) => {
  res.clearCookie('token');
  res.send({'status': 200});
});

module.exports = router;
