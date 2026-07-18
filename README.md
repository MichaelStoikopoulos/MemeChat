# MemeChat

Turn any Discord channel into a meme cannon aimed at your friends' screens.

Post an image, a video, or just text in a watched channel, and it pops up —
with sound — directly on the desktop of everyone in the group, floating over
whatever they're doing. No opening Discord, no missing the drop.

## What it does

- **Groups watch a channel.** Anyone can spin up a group, pick a Discord
  server + channel, and invite friends to it. Multiple independent groups can
  run off the same bot at once, each watching their own channel.
- **Post normally in Discord.** An image, a gif, a video, or plain text — the
  bot picks it up and relays it to everyone linked to that group, instantly.
- **It shows up on your screen, not in a window you have to check.** The
  desktop app is an invisible, click-through overlay that only appears when
  something's dropped, plays it (with sound, and a full video plays out
  completely rather than looping or cutting off), then fades away.
- **You never see your own posts** — drops are relayed to everyone in the
  group except whoever sent them.

## How it fits together

```
Dashboard (web) ──┐
                   ├── one Node service (Express + Socket.IO + discord.js)
Discord bot   ─────┘         │
                              │  SQLite (users, groups, channels, tokens)
                              ▼
                    Desktop app (Electron) on each person's screen
```

- **Dashboard**: log in with Discord, create/join/rename/delete groups, pick
  which server + channel each group watches, invite others, generate pairing
  codes for the desktop app, and download the desktop installer — all from
  the browser.
- **Bot**: one bot, can be in many servers at once. For every message in a
  watched channel — image, video, or just text — it broadcasts a "drop" to
  that group only, skipping the sender.
- **Desktop app**: paired to exactly one group via a one-time code. Sits
  invisible on someone's screen until a drop comes in for their group, then
  shows the media with the poster's name and avatar, plays a notification
  sound, and fades out on its own.

## Tech stack

- **Server**: Node.js, Express, Socket.IO, discord.js, better-sqlite3
- **Dashboard**: React (Vite), no external UI framework
- **Desktop app**: Electron, packaged with electron-builder (Windows/macOS/Linux)

## Project structure

```
src/              the server: Discord OAuth, REST API, Socket.IO, the bot
dashboard/        React dashboard, built to static files the server serves
desktop-client/   Electron overlay app + installer config
```

## Getting started (self-hosting)

### 1. Create the Discord application

1. https://discord.com/developers/applications → **New Application**.
2. **OAuth2** tab: note the **Client ID** and **Client Secret**.
3. **OAuth2 → Redirects**: add `http://<your-domain-or-ip>:3000/auth/callback`
   (must exactly match `DISCORD_REDIRECT_URI` in `.env`).
4. **Bot** tab → **Add Bot** → copy the **Token**.
5. Under **Privileged Gateway Intents**, enable **Message Content Intent**.

You do **not** need to manually invite the bot to every server — the dashboard
generates an invite link per group when someone sets up a channel.

### 2. Run the server

```bash
npm install
cp .env.example .env
nano .env   # fill in DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_BOT_TOKEN,
            # DISCORD_REDIRECT_URI, and generate a SESSION_SECRET
npm start
```

This starts everything on one port (default `3000`): the dashboard, the API,
the Socket.IO server, and the bot. SQLite data lives in `data.sqlite` next to
the project (or wherever `DATA_DIR` points) — back it up if you care about
not losing groups.

Keep it alive with `pm2`:

```bash
npm install -g pm2
pm2 start src/index.js --name memechat
pm2 save && pm2 startup
```

Open the port in your VPS firewall, and set `DISCORD_REDIRECT_URI` /
`PUBLIC_URL` in `.env` to use your real public IP or domain (not `localhost`)
once it's not just running on your own machine. If deploying somewhere with
an ephemeral filesystem (Railway, etc.), point `DATA_DIR` at a persistent
volume so the database survives redeploys.

### 3. Using the dashboard

1. Visit `http://<your-server>:3000` and **Login with Discord**.
2. **Create a group** — this makes you the owner.
3. Under the group page, if the bot isn't in your server yet, click the
   **Invite the bot** link, then refresh the page.
4. Pick the **server** and **channel** you want watched, save.
5. Share the **invite link** on the group page with whoever else should be in
   the group — they log in with Discord and land right in it.

### 4. Setting up the desktop app (each person)

The server's address is baked into the app at build time (`desktop-client/config.js`)
so people linking their device only ever have to enter a pairing code. Set it
before building:

```js
// desktop-client/config.js
module.exports = {
  SERVER_URL: 'https://your-server-or-tunnel-url',
};
```

```bash
cd desktop-client
npm install
npm start
```

First run shows a small **Link this device** window: just enter a pairing
code. Get the code from the group page on the dashboard (**Generate code**,
valid 10 minutes, one-time use). After linking, the window disappears and the
app becomes an invisible overlay that lights up whenever someone posts in
that group's channel.

- `Ctrl+Shift+Q` — quit
- `Ctrl+Shift+L` — re-open the link window (e.g. to switch to a different group)

#### Packaging for the group

Running via `npm start` works for testing, but auto-start-on-login only takes
effect once it's installed as a real app:

```bash
npm run build
```

Produces an installer in `desktop-client/dist/`, which the dashboard also
serves directly via a **Download desktop app** button on each group's page —
group members can grab it straight from the browser, no file-sharing needed.
If the server's address ever changes, update `config.js` and rebuild —
everyone will need the new installer.

## Known limitations

- **One channel per group.** If you want two different channels feeding the
  same set of people, that's currently two groups (invite the same people to
  both). Multi-channel-per-group is a schema change (`group_channels` would
  need to become one-to-many) if you want that later.
- **One group per screen at a time.** A desktop app can only be paired to one
  group; linking to a second group's code switches it over rather than
  showing both simultaneously.
- **Trust model**: whoever is logged into the dashboard and marked as a
  group's owner can see and pick from **every server the bot is currently
  in** — not just servers they personally belong to. Fine for a small trusted
  friend group; if this grows, that guild list should be filtered to servers
  where the requesting user also has admin permissions (needs storing their
  OAuth access token, which isn't done yet).
- **Primary display only** on the desktop app. Multi-monitor support is a
  small addition to `main.js` (loop over `screen.getAllDisplays()`).
- **Device tokens don't expire.** They're revocable only by deleting the row
  directly in the database for now — an "unlink device" button on the
  dashboard would be a good next addition.
- **Overlay can't show over true exclusive fullscreen games** (a Windows
  compositor limitation, not specific to this app — Discord's and Steam's
  overlays have the same restriction). Use borderless windowed mode, or make
  sure "fullscreen optimizations" isn't disabled for the game.
