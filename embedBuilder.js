// embedBuilder.js — builds the Discord embed + action rows for a poll

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getTotalVotes } from './polls.js';
import MSG from './messages.js';

// Discord brand colors
const DISCORD_BLURPLE = 0x5865F2;
const DISCORD_GREEN   = 0x57F287;
const FILLED_BLOCK    = '\u2588';
const UNFILLED_BLOCK  = '\u2591';

// Progress bar builder
function makeBar(pct, length = 15) {
  const filled = Math.round((pct / 100) * length);
  const empty  = length - filled;
  return FILLED_BLOCK.repeat(filled) + UNFILLED_BLOCK.repeat(empty);
}

// Helper that ddd one field per option, ranked by vote count (descending) so the
// highest-voted options appear first. Sorts a copy so poll.options keeps
// its original order. `emptyLabel` is shown for options with no votes.
function addOptionFields(embed, poll, total, emptyLabel) {
  const ranked = [...poll.options].sort((a, b) => b.voters.size - a.voters.size);

  ranked.forEach((opt, i) => {
    const count = opt.voters.size;
    const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
    const bar   = makeBar(pct);
    const names = count > 0 ? [...opt.voters.values()].join(', ') : emptyLabel;

    embed.addFields({
      name: MSG.ROW_OPTION_NAME(i, opt.label),
      value: MSG.ROW_OPTION_VALUE(bar, pct, count, names),
      inline: false,
    });
  });
}

// Build the main poll embed
export function buildPollEmbed(poll) {
  const total = getTotalVotes(poll);

  const embed = new EmbedBuilder()
    .setColor(DISCORD_BLURPLE)
    .setTitle(`${poll.question}`)
    .setFooter({
      text: MSG.FOOTER(total, poll.creatorName, MSG.DATE(poll.createdAt))
    });

  addOptionFields(embed, poll, total, MSG.NO_VOTES_YET);

  return embed;
}

// Build vote buttons (one per option, up to 5 per row, max 25 total)
export function buildVoteRows(poll) {
  const rows = [];
  let currentRow = new ActionRowBuilder();
  let btnCount = 0;

  poll.options.forEach((opt) => {
    if (btnCount > 0 && btnCount % 5 === 0) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }

    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`vote__${poll.pollId}__${opt.id}`)
        .setLabel(`${opt.label.slice(0, 58)}`)
        .setStyle(ButtonStyle.Secondary)
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
        .setCustomId(`editoption__${poll.pollId}`)
        .setLabel(MSG.BTN_EDIT_OPTION)
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
export function buildResultEmbed(poll) {
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
      text: MSG.FOOTER(total, poll.creatorName, MSG.DATE(poll.createdAt))
    });

  addOptionFields(embed, poll, total, MSG.NO_VOTES);

  return embed;
}


