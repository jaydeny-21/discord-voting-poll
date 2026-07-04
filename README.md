#  Discord Poll Bot

A fully-featured voting bot for Discord server. Members can create polls, vote for multiple options, add their own options, and remove votes anytime — all with live results shown as progress bars with voter names.

## Owners
Jayden Ly

## Features

- `/poll` slash command to create a poll with up to 3 options upfront
- Vote for **multiple options** at once
- **Remove your vote** by clicking the same button again
- **Add your own option** via the "Add option" button (opens a popup)
- See **voter names** listed under each option
- Live **progress bar** with percentage per option
- **End poll** button (only poll creator or mods can use it)
- Shows final results with winner highlighted when poll ends



## Setup (Step by Step)

### 1. Create Discord bot

1. Go to https://discord.com/developers/applications
2. Click **New Application** → give it a name (e.g. "Poll Bot")
3. Go to the **Bot** tab → click **Add Bot**
4. Under **Token**, click **Reset Token** and copy it — this is your `BOT_TOKEN`
5. Scroll down to **Privileged Gateway Intents** → enable:
   - `SERVER MEMBERS INTENT`
   - `MESSAGE CONTENT INTENT`
6. Go to the **OAuth2 → URL Generator** tab
   - Scopes: check `bot` and `applications.commands`
   - Bot Permissions: check `Send Messages`, `Use Slash Commands`, `Embed Links`
   - Copy the generated URL and open it to invite the bot to your server

### 2. Get your IDs

- **Client ID**: Found on the **General Information** tab -> **Application ID**
- **Guild ID**: Right-click your Discord server icon → **Copy Server ID**
  *(Enable Developer Mode in Discord Settings → Advanced if you don't see this)*
- Paste them into a `.env` file, along with a `DATABASE_URL` for PostgreSQL
  (see the [Database](#database-postgresql) section). All four are required:
  ```
  TOKEN=...
  CLIENT_ID=...
  GUILD_ID=...
  DATABASE_URL=postgres://user:password@localhost:5432/dbname
  ```


### 4. Install dependencies

```bash
npm install
```

### 5. Run the bot

```bash
node index.js
```

You should see:
```
....
 Poll Bot is ready!
```


## Usage

In any channel your bot has access to, type:

```
/poll question:Where should we eat after service? option1:Pho restaurant option2:Pizza place option3:Boba cafe
```

The bot will post a poll embed with buttons. Members click buttons to vote/unvote, and the embed updates live.



## Database (PostgreSQL)

Polls are stored in **PostgreSQL** so they survive bot restarts, crashes, and
redeploys (earlier versions kept polls in memory, so any restart wiped them).

- Connection is configured via the `DATABASE_URL` environment variable, e.g.
  `postgres://user:password@localhost:5432/dbname`
- The tables are created automatically on startup by `initDb()` in `db.js` — you
  never set them up by hand. Three tables:
  - `polls` — one row per poll (question, creator, channel, message id, created_at)
  - `options` — one row per option, linked to its poll
  - `votes` — one row per vote (option + user), which also enforces one vote per
    user per option

## Deployment (Oracle Cloud + 24/7)

The bot runs on a free **Oracle Cloud "Always Free"** VM as a **systemd service**,
so it starts on boot, restarts if it crashes, and keeps running after you log out.

### 1. Create the VM
1. In the Oracle Cloud console: **Compute → Instances → Create Instance**
2. Image: **Ubuntu 22.04**. Shape: `VM.Standard.E2.1.Micro` (AMD, Always Free) or
   `VM.Standard.A1.Flex` (ARM — more power, but often "out of capacity")
3. Assign a **public IP** and download the **SSH private key**
4. SSH in: `ssh -i your-key.key ubuntu@<PUBLIC_IP>`

### 2. Add swap (only needed on the 1 GB Micro shape)
Prevents out-of-memory lockups when Node + Postgres run together:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 3. Install Node.js and PostgreSQL
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql postgresql-contrib git
```

### 4. Create the database and a dedicated user
```bash
sudo -u postgres psql
```
Then, inside psql (use your own password):
```sql
CREATE DATABASE pollbot;
CREATE USER pollbot WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE pollbot TO pollbot;
\c pollbot
GRANT ALL ON SCHEMA public TO pollbot;
\q
```

### 5. Get the code and install
```bash
git clone https://github.com/jaydeny-21/discord-voting-poll.git
cd discord-voting-poll
git checkout main
npm install
```
> Never run `npm audit fix --force` — it can downgrade discord.js to an
> unsupported major version and break the bot. Ignore the audit warnings.

### 6. Create the `.env`
```bash
nano .env
```
```
TOKEN=your_discord_bot_token
CLIENT_ID=your_client_id
GUILD_ID=your_server_id
DATABASE_URL=postgres://pollbot:your_password@localhost:5432/pollbot
```

### 7. Run it as a systemd service
Create `/etc/systemd/system/pollbot.service`:
```ini
[Unit]
Description=Discord Church Poll Bot
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/discord-voting-poll
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
Enable and start it:
```bash
sudo systemctl daemon-reload
sudo systemctl enable pollbot    # start on boot
sudo systemctl start pollbot     # start now
sudo systemctl status pollbot    # check it's "active (running)"
```

> Only **one** process may run a given bot token at a time. If the bot also runs
> elsewhere (e.g. an old Railway deploy) on the same token, both will fight over
> interactions and throw "Interaction has already been acknowledged". Shut the
> other one down first.



## Deployment Workflow (updating the live bot)

Day-to-day flow when adding a feature and shipping it:

```bash
# --- On your local machine ---
git checkout main
git pull origin main                 # start from the latest code
git checkout -b feature/my-feature   # branch off for the new work
# ...make changes, test locally...
git add -A
git commit -m "feat: describe the change"
git push origin feature/my-feature

# Merge the feature into main (via a GitHub Pull Request, or locally):
git checkout main
git pull origin main
git merge feature/my-feature
git push origin main
```

```bash
# --- On the Oracle VM: pull the new code and restart ---
cd ~/discord-voting-poll
git checkout main
git pull origin main
npm install                          # only needed if dependencies changed
sudo systemctl restart pollbot       # apply the update
journalctl -u pollbot -f             # watch logs to confirm it started
```

### Handy service commands

| Task | Command |
|------|---------|
| Restart after an update | `sudo systemctl restart pollbot` |
| Stop the bot | `sudo systemctl stop pollbot` |
| Start the bot | `sudo systemctl start pollbot` |
| Check status | `sudo systemctl status pollbot` |
| View live logs | `journalctl -u pollbot -f` |

## File Structure

```
discord-poll-bot/
├── index.js              — Bot entry point (also runs initDb on startup)
├── config.js             — Loads env vars: token, IDs, DATABASE_URL
├── db.js                 — PostgreSQL connection pool + table setup
├── polls.js              — Poll data access (reads/writes PostgreSQL)
├── embedBuilder.js       — Builds Discord embeds and buttons
├── deploy-commands.js    — Registers /poll slash command
├── interactionHandler.js — Handles all button clicks and commands
├── messages.js           — Stores all text used across the bot
└── package.json
```

## Common Issues
### Common errors and fixes:
Error: Used disallowed intents

Go to Developer Portal → Bot → enable both Privileged Gateway Intents → Save

Slash command /poll not showing up

Wait 60 seconds after first run — Discord takes time to register commands
Make sure guildId in config.js matches your test server exactly

### Invalid token error

Your token in config.js has a typo or extra space — reset it and copy again carefully

### Buttons not responding / bot crashes on click

Check the logs (`journalctl -u pollbot -f`) for the error message — it will tell you exactly which line
If a poll stops responding, confirm the bot can reach PostgreSQL (check `DATABASE_URL` in `.env` and that the `postgresql` service is running: `sudo systemctl status postgresql`)

### Bot posts the embed but buttons do nothing

Make sure the bot has Embed Links and Read Message History permissions in that channel

### Missing Access error

The bot wasn't given permission to the channel — right-click the channel → Edit Channel → Permissions → add the bot role
