const { Client, GatewayIntentBits, Partials } = require('discord.js');
const db = require('../db');

function createBot(io) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel],
  });

  client.on('messageCreate', (message) => {
    if (message.author.bot) return;
    if (message.attachments.size === 0) return;

    const group = db
      .prepare('SELECT id FROM groups WHERE channel_id = ?')
      .get(message.channelId);
    if (!group) return;

    const attachment = message.attachments.first();

    io.to(`group:${group.id}`).emit('drop', {
      imageUrl: attachment.url,
      contentType: attachment.contentType || null,
      text: message.content || '',
      author: message.author.username,
      timestamp: message.createdTimestamp,
    });
  });

  client.once('clientReady', () => {
    console.log(`Discord bot logged in as ${client.user.tag}`);
  });

  client.login(process.env.DISCORD_BOT_TOKEN).catch((err) => {
    console.error('Failed to log in Discord bot:', err.message);
  });

  return client;
}

module.exports = createBot;
