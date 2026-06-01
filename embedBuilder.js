// embedBuilder.js — builds the Discord embed + action rows for a poll

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { getTotalVotes } = require('./polls');
const MSG = require('./messages'); 

// Discord brand colors
const DISCORD_BLURPLE = 0x5865F2;
const DISCORD_GREEN   = 0x57F287;
const DISCORD_YELLOW  = 0xFEE75C;
const DISCORD_FUCHSIA = 0xEB459E;
const DISCORD_RED     = 0xED4245;
const FILLED_BLOCK    = '\u2588';
const UNFILLED_BLOCK  = '\u2591';

// Progress bar builder
function makeBar(pct, length = 15) {
  const filled = Math.round((pct / 100) * length);
  const empty  = length - filled;
  return FILLED_BLOCK.repeat(filled) + UNFILLED_BLOCK.repeat(empty);
}


// Format current time as "Today at 6:01 PM"
function getFormattedTime() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return MSG.DATE(hours, minutes, ampm);
}

// Build the main poll embed
function buildPollEmbed(poll) {
  const total = getTotalVotes(poll);

  const embed = new EmbedBuilder()
    .setColor(DISCORD_BLURPLE)
    .setTitle(`${poll.question}`)
    .setFooter({
      text: MSG.FOOTER(total, poll.creatorName, getFormattedTime())
    })


  // Build each option as a field
  poll.options.forEach((opt, i) => {
    const count = opt.voters.size;
    const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
    const bar   = makeBar(pct);
    const names = count > 0
      ? [...opt.voters.values()].join(', ')
      : MSG.NO_VOTES_YET;

    embed.addFields({
      name: MSG.ROW_OPTION_NAME(i, opt.label),
      value: MSG.ROW_OPTION_VALUE(bar, pct, count,names),
      inline: false,
    });
  });

  return embed;
}

// Build vote buttons (one per option, up to 5 per row, max 25 total)
// userId is passed so voted buttons are highlighted blurple with a checkmark
function buildVoteRows(poll, userId = null) {
  const rows = [];
  let currentRow = new ActionRowBuilder();
  let btnCount = 0;

  poll.options.forEach((opt, i) => {
    if (btnCount > 0 && btnCount % 5 === 0) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }

    const hasVoted = userId !== null && opt.voters.has(userId);

    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`vote__${poll.pollId}__${opt.id}`)
        .setLabel(`${opt.label.slice(0, 58)}`)
        .setStyle(hasVoted ? ButtonStyle.Success : ButtonStyle.Secondary)
    );
    btnCount++;
  });

  if (btnCount > 0) rows.push(currentRow);

  // Add option row: "Add option" + "End poll" button
  if (rows.length < 5) {
    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`addoption__${poll.pollId}`)
        .setLabel(MSG.BTN_ADD_OPTION)
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`endpoll__${poll.pollId}`)
        .setLabel(MSG.BTN_END_POLL)
        .setStyle(ButtonStyle.Danger)
    );
    rows.push(actionRow);
  }

  return rows;
}

// Build a compact result embed for ended polls
function buildResultEmbed(poll) {
  const total = getTotalVotes(poll);

  const maxVotes = Math.max(...poll.options.map(o => o.voters.size));
  const winners = poll.options.filter(o => o.voters.size === maxVotes);

  const embed = new EmbedBuilder()
    .setColor(DISCORD_GREEN)
    .setTitle(MSG.POLL_ENDED_TITLE(poll.question))
    .setDescription(
      total === 0
        ? MSG.NO_VOTES_CAST
        : MSG.RESULT_WINNERS(winners, maxVotes)
    )
    .setFooter({ 
      text: MSG.FOOTER(total, poll.creatorName, getFormattedTime())
    })

  poll.options.forEach((opt, i) => {
    const count = opt.voters.size;
    const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
    const bar   = makeBar(pct);
    const names = count > 0 ? [...opt.voters.values()].join(', ') : MSG.NO_VOTES;

    embed.addFields({
      name: MSG.ROW_OPTION_NAME(i, opt.label),
      value: MSG.ROW_OPTION_VALUE(bar, pct, count,names),
      inline: false,
    });
  });

  return embed;
}

module.exports = { buildPollEmbed, buildVoteRows, buildResultEmbed };
