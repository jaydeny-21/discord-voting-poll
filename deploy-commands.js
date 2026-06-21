// deploy-commands.js — registers /poll slash command with Discord

import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import * as config from './config.js';

const commands = [
  new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Let\'s make a poll')
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
    .addStringOption(o => o.setName('option3').setDescription('Option 3 (Add more later)').setMaxLength(80))
    .toJSON(),
];

export async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(config.token);
  try {
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands }
    );
    console.log(' Slash commands registered successfully.');
  } catch (err) {
    console.error(' Failed to register commands:', err);
  }
}


