require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const app = express();

// ⛓️ Middleware для сесій
app.use(session({
  secret: 'super-secret-session-key', // заміни на свій секрет!
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // якщо використовуєш https, постав true
}));

// 🏠 Домашній маршрут для перевірки
app.get('/', (req, res) => {
  res.send('✅ Backend is running. Use /login to authenticate via Twitter.');
});

// 🔐 Користувач натискає кнопку "Connect Twitter" → редірект
app.get('/login', (req, res) => {
  // Генерація нового code_verifier і code_challenge
  const code_verifier = crypto.randomBytes(32).toString('hex');
  const code_challenge = crypto
    .createHash('sha256')
    .update(code_verifier)
    .digest()
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  // Зберігаємо в сесії
  req.session.code_verifier = code_verifier;

  // Формуємо запит до Twitter
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.CLIENT_ID,
    redirect_uri: process.env.REDIRECT_URI,
    scope: 'tweet.read users.read offline.access',
    state: 'secure_random_state',
    code_challenge: code_challenge,
    code_challenge_method: 'S256'
  });

  res.redirect(`https://twitter.com/i/oauth2/authorize?${params.toString()}`);
});

// 🌀 Callback після авторизації з кодом → обмін на токен → отримуємо username
app.get('/raffle', async (req, res) => {
  const code = req.query.code;
  const code_verifier = req.session.code_verifier;

  if (!code || !code_verifier) {
    return res.send('❌ Missing code or verifier. Please try logging in again.');
  }

  try {
    // Отримуємо access_token
    const tokenResponse = await axios.post(
      'https://api.twitter.com/2/oauth2/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.CLIENT_ID,
        redirect_uri: process.env.REDIRECT_URI,
        code: code,
        code_verifier: code_verifier
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(
            `${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`
          ).toString('base64')}`
        }
      }
    );

    const { access_token } = tokenResponse.data;

    // Отримуємо username
    const userResponse = await axios.get('https://api.twitter.com/2/users/me', {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });

    const { username } = userResponse.data.data;

    // 🔁 Повертаємо користувача на фронт
    res.redirect(`https://owlbtc.art/raffle/?twitter=${username}`);
  } catch (error) {
    console.error('❌ Twitter Auth Error:', error.response?.data || error.message);
    res.status(500).send('Authentication failed');
  }
});

// ▶️ Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server started on http://localhost:${PORT}`);
});
