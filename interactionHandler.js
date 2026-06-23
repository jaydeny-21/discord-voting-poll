// handlers/interactionHandler.js

import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } from 'discord.js';
import * as polls from './polls.js';
import * as embedBuilder from './embedBuilder.js';
import MSG from './messages.js';
const NUM_OPTIONS_UPFRONT = 3; // user can create up to 3 options upfront

// Per-poll lock: tracks the latest in-flight repost for each poll so reposts
// on the SAME poll run one-at-a-time. This prevents the duplicate-message race
// when several people interact at the same instant. Different polls still run
// in parallel.
const repostQueues = new Map();

// Repost poll to the bottom of conversation.
// Chains this repost behind any repost already running for the same poll, so
// the next one only starts after the previous one has updated poll.messageId.
function repostPoll(interaction, poll, isEnded = false) {
  const previous = repostQueues.get(poll.pollId) || Promise.resolve();

  // .catch first so one failed repost doesn't block the rest of the queue
  const next = previous
    .catch(() => {})
    .then(() => doRepost(interaction, poll, isEnded));

  repostQueues.set(poll.pollId, next);

  // Drop the entry once this is the last repost in the chain (keeps the Map small)
  next.finally(() => {
    if (repostQueues.get(poll.pollId) === next) {
      repostQueues.delete(poll.pollId);
    }
  });

  return next;
}

// Does the actual delete-old + send-new work. Reads poll.messageId at call time,
// which is now always current because reposts are serialized by repostPoll().
async function doRepost(interaction, poll, isEnded = false) {
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

// Only the poll creator or a server admin (ManageMessages) may manage a poll
function canManagePoll(interaction, poll) {
  const isCreator = interaction.user.id === poll.creatorId;
  const isAdmin   = interaction.member?.permissions?.has('ManageMessages');
  return isCreator || isAdmin;
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
      } else if (action === 'editoption') {
        await handleEditOptionSelect(interaction, pollId);
      } else if (action === 'endpoll') {
        await handleEndPoll(interaction, pollId);
      }
      return;
    }

    // Select Menus
    if (interaction.isStringSelectMenu()) {
      const [action, pollId] = interaction.customId.split('__');
      if (action === 'editselect') {
        await handleEditOptionChosen(interaction, pollId);
      }
      return;
    }

    // Modal Submissions
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('addoption_modal__')) {
        const pollId = interaction.customId.replace('addoption_modal__', '');
        await handleAddOptionSubmit(interaction, pollId);
      } else if (interaction.customId.startsWith('editoption_modal__')) {
        const [, pollId, optionId] = interaction.customId.split('__');
        await handleEditOptionSubmit(interaction, pollId, optionId);
      }
      return;
    }

  } catch (err) {
    console.error('Interaction error:', err);
    const msg = { content: MSG.REPLY_GENERIC_ERROR, flags: MessageFlags.Ephemeral };
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

  // if (options.length < 2) {
  //   return interaction.reply({ content: MSG.REPLY_MIN_OPTIONS, flags: MessageFlags.Ephemeral });
  // }

  // Reject duplicate options (case-insensitive), same rule as the Add option button
  const seen = new Set();
  for (const opt of options) {
    const key = opt.toLowerCase();
    if (seen.has(key)) {
      return interaction.reply({ content: MSG.REPLY_INITIAL_DUPLICATE(opt), flags: MessageFlags.Ephemeral });
    }
    seen.add(key);
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

  const response = await interaction.reply({
    embeds: [embed],
    components: rows,
    withResponse: true,
  });

  polls.setMessageId(poll.pollId, response.resource.message.id);
}

// Vote button 
async function handleVote(interaction, pollId, optionId) {
  // Acknowledge FIRST before any other logic
  await interaction.deferUpdate();
  
  const poll = polls.getPoll(pollId);
  if (!poll) {
    return interaction.followUp({ content: MSG.REPLY_POLL_NOT_FOUND, flags: MessageFlags.Ephemeral });
  }

  const displayName = interaction.member?.displayName || interaction.user.username;
  const result = polls.toggleVote(pollId, optionId, interaction.user.id, displayName);

  if (!result) {
    return interaction.followUp({ content: MSG.REPLY_OPTION_NOT_FOUND, flags: MessageFlags.Ephemeral });
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
    return interaction.reply({ content: MSG.REPLY_POLL_NOT_FOUND, flags: MessageFlags.Ephemeral });
  }

  const label = interaction.fields.getTextInputValue('option_label').trim();
  if (!label) {
    return interaction.reply({ content: MSG.REPLY_EMPTY_OPTION, flags: MessageFlags.Ephemeral });
  }

  const displayName = interaction.member?.displayName || interaction.user.username;
  const result = polls.addOption(pollId, label, interaction.user.id, displayName);

  if (result === 'duplicate') {
    return interaction.reply({ content: MSG.REPLY_DUPLICATE(label), flags: MessageFlags.Ephemeral });
  }

  // Respond to Discord immediately to prevent "Something went wrong" 
  await interaction.reply({ content: MSG.CONFIRM_OPTION_ADDED, flags: MessageFlags.Ephemeral });

  // Repost the poll, bring it to the bottom of convo
  await repostPoll(interaction, poll);
  await interaction.channel.send(MSG.REPLY_OPTION_ADDED(displayName, label));
}

// End poll 
async function handleEndPoll(interaction, pollId) {
  await interaction.deferUpdate();

  const poll = polls.getPoll(pollId);
  if (!poll) {
    return interaction.followUp({ content: MSG.REPLY_POLL_NOT_FOUND, flags: MessageFlags.Ephemeral });
  }

  // Only the poll creator or admins can end it
  if (!canManagePoll(interaction, poll)) {
    return interaction.followUp({
      content: MSG.REPLY_NOT_CREATOR,
      flags: MessageFlags.Ephemeral,
    });
  }


  await repostPoll(interaction, poll, true);
}

// Edit option — show the list of current options to pick from
async function handleEditOptionSelect(interaction, pollId) {
  const poll = polls.getPoll(pollId);
  if (!poll) {
    return interaction.reply({ content: MSG.REPLY_POLL_NOT_FOUND, flags: MessageFlags.Ephemeral });
  }

  // Only the poll creator or admins can edit
  if (!canManagePoll(interaction, poll)) {
    return interaction.reply({ content: MSG.REPLY_NOT_ALLOWED_EDIT, flags: MessageFlags.Ephemeral });
  }

  // Match the poll's displayed order: ranked by vote count (descending).
  // Sort a copy so poll.options keeps its original order.
  const ranked = polls.rankedOptions(poll);

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`editselect__${pollId}`)
    .setPlaceholder(MSG.EDIT_SELECT_PLACEHOLDER)
    .addOptions(
      ranked.map(o => ({
        label: o.label.slice(0, 100), // Discord caps select labels at 100 chars
        value: o.id,
      }))
    );

  const row = new ActionRowBuilder().addComponents(menu);

  // Ephemeral so only the editor sees the picker
  await interaction.reply({
    content: MSG.REPLY_CHOOSE_OPTION,
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

// Edit option — an option was chosen, show a modal pre-filled with its current text
async function handleEditOptionChosen(interaction, pollId) {
  const optionId = interaction.values[0];

  const poll = polls.getPoll(pollId);
  if (!poll) {
    return interaction.reply({ content: MSG.REPLY_POLL_NOT_FOUND, flags: MessageFlags.Ephemeral });
  }

  const option = poll.options.find(o => o.id === optionId);
  if (!option) {
    return interaction.reply({ content: MSG.REPLY_OPTION_NOT_FOUND, flags: MessageFlags.Ephemeral });
  }

  const modal = new ModalBuilder()
    .setCustomId(`editoption_modal__${pollId}__${optionId}`)
    .setTitle(MSG.EDIT_MODAL_TITLE);

  const input = new TextInputBuilder()
    .setCustomId('new_label')
    .setLabel(MSG.EDIT_MODAL_LABEL)
    .setStyle(TextInputStyle.Short)
    .setMaxLength(80)
    .setRequired(true)
    .setValue(option.label); // pre-fill with the current text

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

// Edit option — handle modal submit, update the label and repost
async function handleEditOptionSubmit(interaction, pollId, optionId) {
  const poll = polls.getPoll(pollId);
  if (!poll) {
    return interaction.reply({ content: MSG.REPLY_POLL_NOT_FOUND, flags: MessageFlags.Ephemeral });
  }

  const option = poll.options.find(o => o.id === optionId);
  const oldLabel = option?.label;

  const newLabel = interaction.fields.getTextInputValue('new_label').trim();
  if (!newLabel) {
    return interaction.reply({ content: MSG.REPLY_EMPTY_OPTION, flags: MessageFlags.Ephemeral });
  }

  const result = polls.editOption(pollId, optionId, newLabel);
  if (result === 'not_found') {
    return interaction.reply({ content: MSG.REPLY_OPTION_NOT_FOUND, flags: MessageFlags.Ephemeral });
  }
  if (result === 'duplicate') {
    return interaction.reply({ content: MSG.REPLY_DUPLICATE(newLabel), flags: MessageFlags.Ephemeral });
  }

  const displayName = interaction.member?.displayName || interaction.user.username;

  // Respond to Discord immediately to prevent "Something went wrong"
  await interaction.reply({ content: MSG.CONFIRM_OPTION_EDITED, flags: MessageFlags.Ephemeral });

  // Repost the poll, bring it to the bottom of convo
  await repostPoll(interaction, poll);
  await interaction.channel.send(MSG.REPLY_OPTION_EDITED(displayName, oldLabel, newLabel));
}

