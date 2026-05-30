// embedBuilder.js — builds the Discord embed + action rows for a poll

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { getTotalVotes } = require('./polls');

// Discord brand colors
const DISCORD_BLURPLE = 0x5865F2;
const DISCORD_GREEN   = 0x57F287;
const DISCORD_YELLOW  = 0xFEE75C;
const DISCORD_FUCHSIA = 0xEB459E;
const DISCORD_RED     = 0xED4245;

// Progress bar builder
function makeBar(pct, length = 12) {
  const filled = Math.round((pct / 100) * length);
  const empty  = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}


// Format current time as "Today at 6:01 PM"
function getFormattedTime() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `Today at ${hours}:${minutes} ${ampm}`;
}

// Build the main poll embed
function buildPollEmbed(poll) {
  const total = getTotalVotes(poll);

  const embed = new EmbedBuilder()
    .setColor(DISCORD_BLURPLE)
    .setTitle(`${poll.question}`)
    .setFooter({
      text: `${total} vote${total !== 1 ? 's' : ''}\u2002•\u2002Poll by ${poll.creatorName}\u2002•\u2002${(getFormattedTime())}`
    })


  // Build each option as a field
  poll.options.forEach((opt, i) => {
    const count = opt.voters.size;
    const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
    const bar   = makeBar(pct);
    const names = count > 0
      ? [...opt.voters.values()].join(', ')
      : '*No votes yet*';

    embed.addFields({
      name: `${i + 1}. ${opt.label}`,
      value: `${bar}  **${pct}%** (${count} vote${count !== 1 ? 's' : ''})\n${names}`,
      inline: false,
    });
  });

  return embed;
}

// Build vote buttons (one per option, up to 5 per row, max 25 total)
function buildVoteRows(poll) {
  const rows = [];
  let currentRow = new ActionRowBuilder();
  let btnCount = 0;

  poll.options.forEach((opt, i) => {
    if (btnCount > 0 && btnCount % 5 === 0) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }

    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`vote__${poll.pollId}__${opt.id}`)
        .setLabel(`${i + 1}. ${opt.label.slice(0, 60)}`)
        .setStyle(ButtonStyle.Secondary)
    );
    btnCount++;
  });

  if (btnCount > 0) rows.push(currentRow);

  // Add option row: "Add option" button
  if (rows.length < 5) {
    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`addoption__${poll.pollId}`)
        .setLabel('+ Add option')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`endpoll__${poll.pollId}`)
        .setLabel('End poll')
        .setStyle(ButtonStyle.Danger)
    );
    rows.push(actionRow);
  }

  return rows;
}

// Build a compact result embed for ended polls
function buildResultEmbed(poll) {
  const total = getTotalVotes(poll);

  const sorted = [...poll.options].sort((a, b) => b.voters.size - a.voters.size);
  const winner = sorted[0];

  const embed = new EmbedBuilder()
    .setColor(DISCORD_GREEN)
    .setTitle(`  Poll Ended — ${poll.question}`)
    .setDescription(
      total === 0
        ? '*No votes were cast.*'
        : `**Winner: ${winner.label}** with ${winner.voters.size} vote${winner.voters.size !== 1 ? 's' : ''}!`
    )
    .setFooter({ text: `Poll by ${poll.creatorName}  •  ${total} total vote${total !== 1 ? 's' : ''}` })
    .setTimestamp();

  poll.options.forEach((opt, i) => {
    const count = opt.voters.size;
    const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
    const bar   = makeBar(pct);
    const names = count > 0 ? [...opt.voters.values()].join(', ') : '*No votes*';

    embed.addFields({
      name: `${i + 1}. ${opt.label}`,
      value: `${bar}  **${pct}%** (${count})\n${names}`,
      inline: false,
    });
  });

  return embed;
}

module.exports = { buildPollEmbed, buildVoteRows, buildResultEmbed };
