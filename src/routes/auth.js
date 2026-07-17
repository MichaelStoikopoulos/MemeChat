const express = require('express');
const db = require('../db');

const router = express.Router();

const DISCORD_API = 'https://discord.com/api/v10';

router.get('/login', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');

  try {
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error('Discord token exchange failed:', body);
      return res.status(502).send('Discord login failed');
    }

    const tokenData = await tokenRes.json();

    const userRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) {
      return res.status(502).send('Discord login failed');
    }
    const discordUser = await userRes.json();

    db.prepare(
      `INSERT INTO users (id, username, avatar)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar`
    ).run(discordUser.id, `${discordUser.username}`, discordUser.avatar);

    req.session.userId = discordUser.id;
    res.redirect('/');
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).send('Login failed');
  }
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

module.exports = router;
