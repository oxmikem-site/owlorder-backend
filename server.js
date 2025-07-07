require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();

// Генеруємо code_verifier та code_challenge (для OAuth 2.0 PKCE)
let code_verifier = crypto.randomBytes(32).toString('hex');
let code_challenge = crypto
  .createHash('sha256')
  .update(code_verifier)
  .digest()
  .toString('base64')
  .replace(/=/g, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_');

// 📍 Домашній маршрут (щоб не було "Cannot GET /")
app.get('/', (req, res) => {
  res.send('✅ Backend is running. Use /login to authenticate via Twitter.');
});

// 1️⃣ Перенаправлення користувача на Twitter OAuth2
app.get('/login', (req, res) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.CLIENT_ID,
    redirect_uri: process.env.REDIRECT_URI,
    scope: 'tweet.read users.read offline.access',
    state: 'secure_random_state', // у майбутньому варто зберігати унікальний
    code_challenge: code_challenge,
    code_challenge_method: 'S256'
  });

  res.redirect(`https://twitter.com/i/oauth2/authorize?${params.toString()}`);
});

// 2️⃣ Twitter повертає код → обмін на токен → отримаємо юзернейм
app.get('/raffle', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send('❌ Missing code from Twitter');

  try {
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

    const userResponse = await axios.get('https://api.twitter.com/2/users/me', {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });

    const { username } = userResponse.data.data;

    // ✅ Перенаправлення назад на фронт із Twitter username
    res.redirect(`https://owlbtc.art/raffle/?twitter=${username}`);
  } catch (error) {
    console.error('❌ Twitter Auth Error:', error.response?.data || error.message);
    res.status(500).send('Authentication failed');
  }
});

// ▶️ Запуск сервера
app.listen(process.env.PORT || 3000, () => {
  console.log(`✅ Server started on port ${process.env.PORT || 3000}`);
});
