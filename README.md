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

- **Client ID**: Found on the **General Information** tab of your application
- **Guild ID**: Right-click your Discord server icon → **Copy Server ID**
  *(Enable Developer Mode in Discord Settings → Advanced if you don't see this)*


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



## Keeping the bot running 24/7

For a free option, use **Railway.app**:
1. Push this folder to a GitHub repo
2. Connect the repo to Railway
3. Set your environment variables (token, clientId, guildId) in Railway's dashboard
4. Deploy — it runs automatically



## File Structure

```
discord-poll-bot/
├── index.js              — Bot entry point
├── config.js             — Your tokens and IDs (keep private!)
├── polls.js              — In-memory poll data store
├── embedBuilder.js       — Builds Discord embeds and buttons
├── deploy-commands.js    — Registers /poll slash command
├── interactionHandler.js  — Handles all button clicks and commands
└── messages.js            — Store all texts used across the bot
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

Check your terminal for the error message — it will tell you exactly which line
Most common cause: the pollId stored in memory was lost because the bot restarted. Polls are stored in memory, so a bot restart wipes them. This is expected for now — a future upgrade would use a database

### Bot posts the embed but buttons do nothing

Make sure the bot has Embed Links and Read Message History permissions in that channel

### Missing Access error

The bot wasn't given permission to the channel — right-click the channel → Edit Channel → Permissions → add the bot role
