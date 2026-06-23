import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { token } from './config.js';
import { handleInteraction } from './interactionHandler.js';
import { registerCommands } from './deploy-commands.js';

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

client.login(token);
