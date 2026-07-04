import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { token } from './config.js';
import { handleInteraction } from './interactionHandler.js';
import { registerCommands } from './deploy-commands.js';
import { initDb } from './db.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

client.once('clientReady', async () => {
  console.log(` Logged in as ${client.user.tag}`);
  console.log(` Registering slash commands...`);
  
  try {
    await registerCommands();
    console.log(`Poll Bot is ready!`);
  } catch (error) {
    console.error('Failed to register slash commands:', error);
    process.exit(1);
  }

});

client.on('interactionCreate', handleInteraction);

// Create tables if needed, then connect to Discord. If the DB is unreachable
// we crash early with a clear error instead of running a broken bot.
await initDb();
client.login(token);
