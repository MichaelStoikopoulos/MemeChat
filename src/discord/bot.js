const { Client, GatewayIntentBits, Partials } = require('discord.js');
const db = require('../db');

function extractMedia(message) {
  const attachment = message.attachments.first();
  if (attachment) {
    const isVideo = (attachment.contentType || '').startsWith('video/');
    return { mediaUrl: attachment.url, mediaType: isVideo ? 'video' : 'image' };
  }

  // Pasted links (e.g. a Tenor/Giphy URL) arrive as embeds, not attachments.
  const embed = message.embeds[0];
  if (embed) {
    if (embed.video?.url) return { mediaUrl: embed.video.url, mediaType: 'video' };
    if (embed.image?.url) return { mediaUrl: embed.image.url, mediaType: 'image' };
    if (embed.thumbnail?.url) return { mediaUrl: embed.thumbnail.url, mediaType: 'image' };
  }

  return { mediaUrl: null, mediaType: null };
}

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
    if (!message.content && message.attachments.size === 0 && message.embeds.length === 0) return;

    const group = db
      .prepare('SELECT id FROM groups WHERE channel_id = ?')
      .get(message.channelId);
    if (!group) return;

    const { mediaUrl, mediaType } = extractMedia(message);

    io.to(`group:${group.id}`)
      .except(`group:${group.id}:user:${message.author.id}`)
      .emit('drop', {
        mediaUrl,
        mediaType,
        text: message.content || '',
        author: message.member?.displayName || message.author.username,
        authorAvatar: message.author.displayAvatarURL({ extension: 'png', size: 64 }),
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
