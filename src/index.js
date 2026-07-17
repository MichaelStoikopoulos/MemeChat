require('dotenv').config();

const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const cookieSession = require('cookie-session');

const authRoutes = require('./routes/auth');
const { createApiRouter, createPairRouter } = require('./routes/api');
const createSocketServer = require('./socket');
const createBot = require('./discord/bot');

for (const key of ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_BOT_TOKEN', 'SESSION_SECRET']) {
  if (!process.env[key]) {
    console.warn(`Warning: ${key} is not set in .env — see README for setup.`);
  }
}

const app = express();
const httpServer = http.createServer(app);
const io = createSocketServer(httpServer);
const bot = createBot(io);

app.use(express.json());
app.use(
  cookieSession({
    name: 'session',
    secret: process.env.SESSION_SECRET || 'dev-only-insecure-secret',
    maxAge: 90 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  })
);

app.use('/auth', authRoutes);
app.use('/api', createPairRouter());
app.use('/api', createApiRouter(bot));

const dashboardDist = path.join(__dirname, '..', 'dashboard', 'dist');
if (fs.existsSync(dashboardDist)) {
  app.use(express.static(dashboardDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(dashboardDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res
      .status(200)
      .send('Dashboard not built yet. Run "npm run build:dashboard" then restart the server.');
  });
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Meme Relay server listening on port ${PORT}`);
});
