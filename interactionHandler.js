// handlers/interactionHandler.js

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { createPoll, getPoll, setMessageId, toggleVote, addOption } = require('./polls');
const { buildPollEmbed, buildVoteRows, buildResultEmbed } = require('./embedBuilder');
const MSG = require('./messages'); 
const NUM_OPTIONS_UPFRONT = 3; // user can create up to 3 options upfront

// Repost poll to the bottom of conversation
async function repostPoll(interaction, poll, isEnded = false) {
  const channel = interaction.channel;

  const embed = isEnded ? buildResultEmbed(poll) : buildPollEmbed(poll);
  const rows  = isEnded ? [] : buildVoteRows(poll, interaction.user.id);

  // Fetch old message first, then delete + send new one in parallel
  const oldMessage = await channel.messages.fetch(poll.messageId).catch(() => null);
  const [newMessage] = await Promise.all([
    channel.send({ embeds: [embed], components: rows }),
    oldMessage ? oldMessage.delete().catch(() => null) : Promise.resolve(),
  ]);

  setMessageId(poll.pollId, newMessage.id);
}

async function handleInteraction(interaction) {
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
    const msg = { content: ' Something went wrong. Please try again 😔', ephemeral: true };
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
    return interaction.reply({ content: ' Could you provide at least **2 options** 😁?', ephemeral: true });
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
  const rows  = buildVoteRows(poll, interaction.user.id);

  const reply = await interaction.reply({
    embeds: [embed],
    components: rows,
    fetchReply: true,
  });

  setMessageId(poll.pollId, reply.id);
}

// Vote button 
async function handleVote(interaction, pollId, optionId) {
  const poll = getPoll(pollId);
  if (!poll) {
    return interaction.reply({ content: ' Sorry, I couldn\'t find the poll 😔', ephemeral: true });
  }

  const displayName = interaction.member?.displayName || interaction.user.username;
  const result = toggleVote(pollId, optionId, interaction.user.id, displayName);

  if (!result) {
    return interaction.reply({ content: ' Sorry, I couldn\'t find the option 😔', ephemeral: true });
  }

  // const embed = buildPollEmbed(poll);
  // const rows  = buildVoteRows(poll, interaction.user.id);
  // await interaction.update({ embeds: [embed], components: rows });

  // Why deferUpdate() before repostPoll() ?
  // When a user clicks a button, Discord expects an immediate response within 3 seconds
  // or it shows an error. deferUpdate() tells Discord "acknowledged, I'm working on it" 
  // while we do the delete + repost which can take a moment. Without it you'd get interaction failed errors.
  await interaction.deferUpdate();  
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
  const poll = getPoll(pollId);
  if (!poll) {
    return interaction.reply({ content: 'Sorry, I couldn\'t find the poll 😔', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId(`addoption_modal__${pollId}`)
    .setTitle('Add a new option');

  const input = new TextInputBuilder()
    .setCustomId('option_label')
    .setLabel('Tell us about your option 😃')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(80)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

// Add option — handle modal submit 
async function handleAddOptionSubmit(interaction, pollId) {
  const poll = getPoll(pollId);
  if (!poll) {
    return interaction.reply({ content: 'Sorry, I couldn\'t find the poll 😔', ephemeral: true });
  }

  const label = interaction.fields.getTextInputValue('option_label').trim();
  if (!label) {
    return interaction.reply({ content: 'My friend, option label cannot be empty 🙂', ephemeral: true });
  }

  const displayName = interaction.member?.displayName || interaction.user.username;
  const result = addOption(pollId, label, interaction.user.id, displayName);

  if (result === 'duplicate') {
    return interaction.reply({ content: `Wake up, option ***${label}*** already exists 😆`, ephemeral: true });
  }

  // Respond to Discord immediately to prevent "Something went wrong" 
  await interaction.reply({ content: 'Option added!', ephemeral: true });

  // Repost the poll, bring it to the bottom of convo
  await repostPoll(interaction, poll);
  await interaction.channel.send(MSG.REPLY_OPTION_ADDED(displayName, label));
}

// End poll 
async function handleEndPoll(interaction, pollId) {
  const poll = getPoll(pollId);
  if (!poll) {
    return interaction.reply({ content: ' Sorry, I couldn\'t find the poll 😔', ephemeral: true });
  }

  // Only the poll creator or admins can end it
  const isCreator = interaction.user.id === poll.creatorId;
  const isAdmin   = interaction.member?.permissions?.has('ManageMessages');

  if (!isCreator && !isAdmin) {
    return interaction.reply({
      content: ' Im sorry, but you can\'t end something you never created ...🙂‍↔️',
      ephemeral: true,
    });
  }

  await interaction.deferUpdate();
  await repostPoll(interaction, poll, true);
}

module.exports = { handleInteraction };
