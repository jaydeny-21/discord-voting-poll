// handlers/interactionHandler.js

import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import * as polls from './polls.js';
import * as embedBuilder from './embedBuilder.js';
import MSG from './messages.js';
const NUM_OPTIONS_UPFRONT = 3; // user can create up to 3 options upfront

// Repost poll to the bottom of conversation
async function repostPoll(interaction, poll, isEnded = false) {
  const channel = interaction.channel;

  const embed = isEnded ? embedBuilder.buildResultEmbed(poll) : embedBuilder.buildPollEmbed(poll);
  const rows  = isEnded ? [] : embedBuilder.buildVoteRows(poll);

  // Fetch old message first, then delete + send new one in parallel
  const oldMessage = await channel.messages.fetch(poll.messageId).catch(() => null);
  const [newMessage] = await Promise.all([
    channel.send({ embeds: [embed], components: rows }),
    oldMessage ? oldMessage.delete().catch(() => null) : Promise.resolve(),
  ]);

  polls.setMessageId(poll.pollId, newMessage.id);
}

export async function handleInteraction(interaction) {
  try {
    // Slash Commands 
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'poll') {
        await handlePollCommand(interaction);
      }
      return;
    }

    // Button Clicks
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

    // Modal Submissions
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('addoption_modal__')) {
        const pollId = interaction.customId.replace('addoption_modal__', '');
        await handleAddOptionSubmit(interaction, pollId);
      }
      return;
    }

  } catch (err) {
    console.error('Interaction error:', err);
    const msg = { content: MSG.REPLY_GENERIC_ERROR, ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg).catch(() => {});
    } else {
      await interaction.reply(msg).catch(() => {});
    }
  }
}

//  /poll command 
async function handlePollCommand(interaction) {
  const question = interaction.options.getString('question');

  // Collect options
  const options = [];
  for (let i = 1; i <= NUM_OPTIONS_UPFRONT; i++) {
    const val = interaction.options.getString(`option${i}`);
    if (val) options.push(val.trim());
  }

  if (options.length < 2) {
    return interaction.reply({ content: MSG.REPLY_MIN_OPTIONS, ephemeral: true });
  }

  const displayName = interaction.member?.displayName || interaction.user.username;

  const poll = polls.createPoll({
    question,
    options,
    creatorId:   interaction.user.id,
    creatorName: displayName,
    channelId:   interaction.channelId,
  });

  const embed = embedBuilder.buildPollEmbed(poll);
  const rows  = embedBuilder.buildVoteRows(poll);

  const reply = await interaction.reply({
    embeds: [embed],
    components: rows,
    fetchReply: true,
  });

  polls.setMessageId(poll.pollId, reply.id);
}

// Vote button 
async function handleVote(interaction, pollId, optionId) {
  // Acknowledge FIRST before any other logic
  await interaction.deferUpdate();
  
  const poll = polls.getPoll(pollId);
  if (!poll) {
    return interaction.followUp({ content: MSG.REPLY_POLL_NOT_FOUND, ephemeral: true });
  }

  const displayName = interaction.member?.displayName || interaction.user.username;
  const result = polls.toggleVote(pollId, optionId, interaction.user.id, displayName);

  if (!result) {
    return interaction.followUp({ content: MSG.REPLY_OPTION_NOT_FOUND, ephemeral: true });
  }

  // const embed = buildPollEmbed(poll);
  // const rows  = buildVoteRows(poll, interaction.user.id);
  // await interaction.update({ embeds: [embed], components: rows });

  // Why deferUpdate() before repostPoll() ?
  // When a user clicks a button, Discord expects an immediate response within 3 seconds
  // or it shows an error. deferUpdate() tells Discord "acknowledged, I'm working on it" 
  // while we do the delete + repost which can take a moment. Without it you'd get interaction failed errors.
  // await interaction.deferUpdate();  
  await repostPoll(interaction, poll);

  // Display message of who just added/removed a vote
  const opt = poll.options.find(o => o.id === optionId);
  await interaction.channel.send(
    result === 'added'
      ? MSG.REPLY_VOTE_ADDED(displayName, opt.label)
      : MSG.REPLY_VOTE_REMOVED(displayName, opt.label),
  );
}

// Add option — show modal 
async function handleAddOptionModal(interaction, pollId) {
  // Show modal FIRST before any poll lookup
  const modal = new ModalBuilder()
  .setCustomId(`addoption_modal__${pollId}`)
  .setTitle(MSG.MODAL_TITLE);
  
  const input = new TextInputBuilder()
  .setCustomId('option_label')
  .setLabel(MSG.MODAL_LABEL)
  .setStyle(TextInputStyle.Short)
  .setMaxLength(80)
  .setRequired(true);
  
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);

  // Poll lookup AFTER modal is shown
  const poll = polls.getPoll(pollId);
  if (!poll) return;
}

// Add option — handle modal submit 
async function handleAddOptionSubmit(interaction, pollId) {
  const poll = polls.getPoll(pollId);
  if (!poll) {
    return interaction.reply({ content: MSG.REPLY_POLL_NOT_FOUND, ephemeral: true });
  }

  const label = interaction.fields.getTextInputValue('option_label').trim();
  if (!label) {
    return interaction.reply({ content: MSG.REPLY_EMPTY_OPTION, ephemeral: true });
  }

  const displayName = interaction.member?.displayName || interaction.user.username;
  const result = polls.addOption(pollId, label, interaction.user.id, displayName);

  if (result === 'duplicate') {
    return interaction.reply({ content: MSG.REPLY_DUPLICATE(label), ephemeral: true });
  }

  // Respond to Discord immediately to prevent "Something went wrong" 
  await interaction.reply({ content: MSG.CONFIRM_OPTION_ADDED, ephemeral: true });

  // Repost the poll, bring it to the bottom of convo
  await repostPoll(interaction, poll);
  await interaction.channel.send(MSG.REPLY_OPTION_ADDED(displayName, label));
}

// End poll 
async function handleEndPoll(interaction, pollId) {
  await interaction.deferUpdate();

  const poll = polls.getPoll(pollId);
  if (!poll) {
    return interaction.followUp({ content: MSG.REPLY_POLL_NOT_FOUND, ephemeral: true });
  }

  // Only the poll creator or admins can end it
  const isCreator = interaction.user.id === poll.creatorId;
  const isAdmin   = interaction.member?.permissions?.has('ManageMessages');

  if (!isCreator && !isAdmin) {
    return interaction.followUp({
      content: MSG.REPLY_NOT_CREATOR,
      ephemeral: true,
    });
  }

  
  await repostPoll(interaction, poll, true);
}

