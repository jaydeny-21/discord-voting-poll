// handlers/interactionHandler.js

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { createPoll, getPoll, setMessageId, toggleVote, addOption } = require('./polls');
const { buildPollEmbed, buildVoteRows, buildResultEmbed } = require('./embedBuilder');

async function handleInteraction(interaction) {
  try {
    // ── Slash Commands ──────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'poll') {
        await handlePollCommand(interaction);
      }
      return;
    }

    // ── Button Clicks ───────────────────────────────────────
    if (interaction.isButton()) {
      const [action, pollId, optionId] = interaction.customId.split('__');

      if (action === 'vote') {
        await handleVote(interaction, pollId, optionId);
      } else if (action === 'addoption') {
        await handleAddOptionModal(interaction, pollId);
      } else if (action === 'endpoll') {
        await handleEndPoll(interaction, pollId);
      }
      return;
    }

    // ── Modal Submissions ───────────────────────────────────
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('addoption_modal__')) {
        const pollId = interaction.customId.replace('addoption_modal__', '');
        await handleAddOptionSubmit(interaction, pollId);
      }
      return;
    }

  } catch (err) {
    console.error('Interaction error:', err);
    const msg = { content: ' Something went wrong. Please try again.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg).catch(() => {});
    } else {
      await interaction.reply(msg).catch(() => {});
    }
  }
}

// ── /poll command ────────────────────────────────────────────
async function handlePollCommand(interaction) {
  const question = interaction.options.getString('question');

  // Collect up to 8 options
  const options = [];
  for (let i = 1; i <= 8; i++) {
    const val = interaction.options.getString(`option${i}`);
    if (val) options.push(val.trim());
  }

  if (options.length < 2) {
    return interaction.reply({ content: ' Please provide at least **2 options**.', ephemeral: true });
  }

  const displayName = interaction.member?.displayName || interaction.user.username;

  const poll = createPoll({
    question,
    options,
    creatorId:   interaction.user.id,
    creatorName: displayName,
    channelId:   interaction.channelId,
  });

  const embed = buildPollEmbed(poll);
  const rows  = buildVoteRows(poll);

  const reply = await interaction.reply({
    embeds: [embed],
    components: rows,
    fetchReply: true,
  });

  setMessageId(poll.pollId, reply.id);
}

// ── Vote button ──────────────────────────────────────────────
async function handleVote(interaction, pollId, optionId) {
  const poll = getPoll(pollId);
  if (!poll) {
    return interaction.reply({ content: ' Poll not found.', ephemeral: true });
  }

  const displayName = interaction.member?.displayName || interaction.user.username;
  const result = toggleVote(pollId, optionId, interaction.user.id, displayName);

  if (!result) {
    return interaction.reply({ content: ' Option not found.', ephemeral: true });
  }

  const embed = buildPollEmbed(poll);
  const rows  = buildVoteRows(poll);

  await interaction.update({ embeds: [embed], components: rows });
}

// ── Add option — show modal ──────────────────────────────────
async function handleAddOptionModal(interaction, pollId) {
  const poll = getPoll(pollId);
  if (!poll) {
    return interaction.reply({ content: ' Poll not found.', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId(`addoption_modal__${pollId}`)
    .setTitle('Add a new option');

  const input = new TextInputBuilder()
    .setCustomId('option_label')
    .setLabel('Option text')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. Boba cafe on Main St')
    .setMaxLength(80)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

// ── Add option — handle modal submit ────────────────────────
async function handleAddOptionSubmit(interaction, pollId) {
  const poll = getPoll(pollId);
  if (!poll) {
    return interaction.reply({ content: ' Poll not found.', ephemeral: true });
  }

  const label = interaction.fields.getTextInputValue('option_label').trim();
  if (!label) {
    return interaction.reply({ content: ' Option label cannot be empty.', ephemeral: true });
  }

  const displayName = interaction.member?.displayName || interaction.user.username;
  const result = addOption(pollId, label, interaction.user.id, displayName);

  if (result === 'duplicate') {
    return interaction.reply({ content: ` The option **${label}** already exists.`, ephemeral: true });
  }

  const embed = buildPollEmbed(poll);
  const rows  = buildVoteRows(poll);

  // Update the original poll message
  const channel = interaction.channel;
  const message = await channel.messages.fetch(poll.messageId).catch(() => null);

  if (message) {
    await message.edit({ embeds: [embed], components: rows });
  }

  await interaction.reply({
    content: ` Added **${label}** to the poll — and your vote has been counted!`,
    ephemeral: true,
  });
}

// ── End poll ─────────────────────────────────────────────────
async function handleEndPoll(interaction, pollId) {
  const poll = getPoll(pollId);
  if (!poll) {
    return interaction.reply({ content: ' Poll not found.', ephemeral: true });
  }

  // Only the poll creator or admins can end it
  const isCreator = interaction.user.id === poll.creatorId;
  const isAdmin   = interaction.member?.permissions?.has('ManageMessages');

  if (!isCreator && !isAdmin) {
    return interaction.reply({
      content: ' Only the poll creator or a moderator can end this poll.',
      ephemeral: true,
    });
  }

  const resultEmbed = buildResultEmbed(poll);

  // Remove all buttons
  await interaction.update({ embeds: [resultEmbed], components: [] });
}

module.exports = { handleInteraction };
