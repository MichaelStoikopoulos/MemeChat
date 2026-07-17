# Meme Relay v2

A dashboard + Discord bot + desktop overlay app, so any number of independent
**groups** can each watch their own Discord channel and get memes popped up on
every group member's screen.

## How it fits together

```
Dashboard (web) ──┐
                   ├── one Node service (Express + Socket.IO + discord.js)
Discord bot   ─────┘         │
                              │  SQLite (users, groups, channels, tokens)
                              ▼
                    Desktop app (Electron) on each person's screen
```

- **Dashboard**: log in with Discord, create/join groups, pick which server +
  channel each group watches, invite others, generate pairing codes for the
  desktop app.
- **Bot**: one bot, can be in many servers at once. For every message with an
  attachment, it checks "is this channel watched by a group?" and if so,
  broadcasts to that group only.
- **Desktop app**: paired to exactly one group via a one-time code. Sits
  invisible on someone's screen until a drop comes in for their group.

## 1. Create the Discord application

1. https://discord.com/developers/applications → **New Application**.
2. **OAuth2** tab: note the **Client ID** and **Client Secret**.
3. **OAuth2 → Redirects**: add `http://<your-domain-or-ip>:3000/auth/callback`
   (must exactly match `DISCORD_REDIRECT_URI` in `.env`).
4. **Bot** tab → **Add Bot** → copy the **Token**.
5. Under **Privileged Gateway Intents**, enable **Message Content Intent**.

You do **not** need to manually invite the bot to every server — the dashboard
generates an invite link per group when someone sets up a channel.

## 2. Run the server

```bash
npm install
cp .env.example .env
nano .env   # fill in DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_BOT_TOKEN,
            # DISCORD_REDIRECT_URI, and generate a SESSION_SECRET
npm start
```

This starts everything on one port (default `3000`): the dashboard, the API,
the Socket.IO server, and the bot. SQLite data lives in `data.sqlite` next to
the project — back that file up if you care about not losing groups.

Keep it alive with `pm2`:

```bash
npm install -g pm2
pm2 start src/index.js --name meme-relay
pm2 save && pm2 startup
```

Open the port in your VPS firewall, and set `DISCORD_REDIRECT_URI` /
`PUBLIC_URL` in `.env` to use your real public IP or domain (not `localhost`)
once it's not just running on your own machine.

## 3. Using the dashboard

1. Visit `http://<your-server>:3000` and **Login with Discord**.
2. **Create a group** — this makes you the owner.
3. Under the group page, if the bot isn't in your server yet, click the
   **Invite the bot** link, then refresh the page.
4. Pick the **server** and **channel** you want watched, save.
5. Share the **invite link** on the group page with whoever else should be in
   the group — they log in with Discord and land right in it.

## 4. Setting up the desktop app (each person)

```bash
cd desktop-client
npm install
npm start
```

First run shows a small **Link this device** window: enter the server URL and
a pairing code. Get the code from the group page on the dashboard (**Generate
code**, valid 10 minutes, one-time use). After linking, the window disappears
and the app becomes an invisible overlay that lights up whenever someone posts
in that group's channel.

- `Ctrl+Shift+Q` — quit
- `Ctrl+Shift+L` — re-open the link window (e.g. to switch to a different group)

### Packaging for the group

Running via `npm start` works for testing, but auto-start-on-login only takes
effect once it's installed as a real app:

```bash
npm run build
```

Produces an installer in `desktop-client/dist/` (`.exe` / `.dmg` /
`.AppImage`). Send that to each group member — after install, they run it
once, link with their code, and it auto-starts from then on.

## Notes / things to know

- **One channel per group.** If you want two different channels feeding the
  same set of people, that's currently two groups (invite the same people to
  both). Multi-channel-per-group is a schema change (`group_channels` would
  need to become one-to-many) if you want that later.
- **Trust model**: whoever is logged into the dashboard and marked as a
  group's owner can see and pick from **every server the bot is currently
  in** — not just servers they personally belong to. Fine for a small trusted
  friend group; if this grows, that guild list should be filtered to servers
  where the requesting user also has admin permissions (needs storing their
  OAuth access token, which isn't done yet).
- **Primary display only** on the desktop app. Multi-monitor support is a
  small addition to `main.js` (loop over `screen.getAllDisplays()`).
- **Device tokens don't expire.** They're revocable only by deleting the row
  directly in `data.sqlite` for now — an "unlink device" button on the
  dashboard would be a good next addition.
