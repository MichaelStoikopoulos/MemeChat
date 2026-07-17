const express = require('express');
const { ChannelType, PermissionsBitField } = require('discord.js');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { randomToken, randomCode } = require('../util/random');

const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;

function createApiRouter(botClient) {
  const router = express.Router();

  function getGroupOr404(req, res) {
    const group = db
      .prepare('SELECT * FROM groups WHERE id = ?')
      .get(req.params.id);
    if (!group) {
      res.status(404).json({ error: 'group_not_found' });
      return null;
    }
    return group;
  }

  function isMember(groupId, userId) {
    return !!db
      .prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?')
      .get(groupId, userId);
  }

  router.use(requireAuth);

  router.get('/me', (req, res) => {
    const user = db.prepare('SELECT id, username, avatar FROM users WHERE id = ?').get(req.session.userId);
    res.json(user);
  });

  router.get('/groups', (req, res) => {
    const groups = db
      .prepare(
        `SELECT g.* FROM groups g
         JOIN group_members gm ON gm.group_id = g.id
         WHERE gm.user_id = ?
         ORDER BY g.created_at DESC`
      )
      .all(req.session.userId);
    res.json(groups.map((g) => ({ ...g, isOwner: g.owner_id === req.session.userId })));
  });

  router.post('/groups', (req, res) => {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name_required' });

    const inviteCode = randomCode(8);
    const info = db
      .prepare('INSERT INTO groups (name, owner_id, invite_code) VALUES (?, ?, ?)')
      .run(name, req.session.userId, inviteCode);

    db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(
      info.lastInsertRowid,
      req.session.userId
    );

    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ ...group, isOwner: true });
  });

  router.get('/groups/:id', (req, res) => {
    const group = getGroupOr404(req, res);
    if (!group) return;
    if (!isMember(group.id, req.session.userId)) {
      return res.status(403).json({ error: 'not_a_member' });
    }

    const members = db
      .prepare(
        `SELECT u.id, u.username, u.avatar FROM users u
         JOIN group_members gm ON gm.user_id = u.id
         WHERE gm.group_id = ?`
      )
      .all(group.id);

    const botInGuild = group.guild_id ? botClient.guilds.cache.has(group.guild_id) : false;

    res.json({ ...group, isOwner: group.owner_id === req.session.userId, members, botInGuild });
  });

  router.put('/groups/:id/channel', (req, res) => {
    const group = getGroupOr404(req, res);
    if (!group) return;
    if (group.owner_id !== req.session.userId) {
      return res.status(403).json({ error: 'owner_only' });
    }

    const { guildId, channelId } = req.body;
    const guild = botClient.guilds.cache.get(guildId);
    if (!guild) return res.status(400).json({ error: 'bot_not_in_guild' });
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return res.status(400).json({ error: 'channel_not_found' });

    db.prepare(
      'UPDATE groups SET guild_id = ?, guild_name = ?, channel_id = ?, channel_name = ? WHERE id = ?'
    ).run(guild.id, guild.name, channel.id, channel.name, group.id);

    res.json({ ok: true });
  });

  router.get('/guilds', (req, res) => {
    const guilds = botClient.guilds.cache.map((g) => ({ id: g.id, name: g.name }));
    res.json(guilds);
  });

  router.get('/guilds/:guildId/channels', (req, res) => {
    const guild = botClient.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'guild_not_found' });

    const me = guild.members.me;
    const channels = guild.channels.cache
      .filter(
        (c) =>
          c.type === ChannelType.GuildText &&
          (!me || c.permissionsFor(me)?.has(PermissionsBitField.Flags.ViewChannel))
      )
      .map((c) => ({ id: c.id, name: c.name }));

    res.json(channels);
  });

  router.get('/bot-invite-url', (req, res) => {
    const permissions = new PermissionsBitField([
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.ReadMessageHistory,
    ]).bitfield.toString();

    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      scope: 'bot',
      permissions,
    });
    res.json({ url: `https://discord.com/oauth2/authorize?${params.toString()}` });
  });

  router.post('/join/:code', (req, res) => {
    const group = db.prepare('SELECT * FROM groups WHERE invite_code = ?').get(req.params.code);
    if (!group) return res.status(404).json({ error: 'invalid_invite_code' });

    db.prepare(
      'INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)'
    ).run(group.id, req.session.userId);

    res.json({ groupId: group.id });
  });

  router.post('/groups/:id/pairing-code', (req, res) => {
    const group = getGroupOr404(req, res);
    if (!group) return;
    if (!isMember(group.id, req.session.userId)) {
      return res.status(403).json({ error: 'not_a_member' });
    }

    const code = randomCode(6);
    const expiresAt = Date.now() + PAIRING_CODE_TTL_MS;
    db.prepare(
      'INSERT INTO pairing_codes (code, group_id, user_id, expires_at, used) VALUES (?, ?, ?, ?, 0)'
    ).run(code, group.id, req.session.userId, expiresAt);

    res.json({ code, expiresAt });
  });

  return router;
}

// Unauthenticated: called by the desktop app with a one-time pairing code.
function createPairRouter() {
  const router = express.Router();

  router.post('/pair', (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'code_required' });

    const pairing = db.prepare('SELECT * FROM pairing_codes WHERE code = ?').get(code.toUpperCase());
    if (!pairing || pairing.used || pairing.expires_at < Date.now()) {
      return res.status(400).json({ error: 'invalid_or_expired_code' });
    }

    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(pairing.group_id);
    if (!group) return res.status(400).json({ error: 'group_not_found' });

    const token = randomToken(32);
    db.prepare('INSERT INTO devices (group_id, user_id, token) VALUES (?, ?, ?)').run(
      group.id,
      pairing.user_id,
      token
    );
    db.prepare('UPDATE pairing_codes SET used = 1 WHERE code = ?').run(pairing.code);

    res.json({ token, groupId: group.id, groupName: group.name });
  });

  return router;
}

module.exports = { createApiRouter, createPairRouter };
