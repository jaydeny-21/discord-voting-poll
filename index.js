const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { token } = require('./config');
const { handleInteraction } = require('./interactionHandler');
const { registerCommands } = require('./deploy-commands');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

client.once('ready', async () => {
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
