// deploy-commands.js — registers /poll slash command with Discord

const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const { token, clientId, guildId } = require('./config');

const commands = [
  new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a voting poll')
    .addStringOption(o =>
      o.setName('question')
       .setDescription('The poll question')
       .setRequired(true)
       .setMaxLength(200)
    )
    .addStringOption(o =>
      o.setName('option1')
       .setDescription('Option 1')
       .setRequired(true)
       .setMaxLength(80)
    )
    .addStringOption(o =>
      o.setName('option2')
       .setDescription('Option 2')
       .setRequired(true)
       .setMaxLength(80)
    )
    .addStringOption(o => o.setName('option3').setDescription('Option 3').setMaxLength(80))
    .addStringOption(o => o.setName('option4').setDescription('Option 4').setMaxLength(80))
    .addStringOption(o => o.setName('option5').setDescription('Option 5').setMaxLength(80))
    .addStringOption(o => o.setName('option6').setDescription('Option 6').setMaxLength(80))
    .addStringOption(o => o.setName('option7').setDescription('Option 7').setMaxLength(80))
    .addStringOption(o => o.setName('option8').setDescription('Option 8').setMaxLength(80))
    .toJSON(),
];

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(token);
  try {
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );
    console.log(' Slash commands registered successfully.');
  } catch (err) {
    console.error(' Failed to register commands:', err);
  }
}

module.exports = { registerCommands };
