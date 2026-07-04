// polls.js — poll storage backed by PostgreSQL
// Each function returns/accepts the same shapes as before, so the rest of the
// bot is unchanged. A hydrated poll looks like:
// {
//   pollId, question, creatorId, creatorName, channelId, messageId, createdAt,
//   options: [ { id, label, voters: Map<userId, displayName> } ]
// }

import { pool } from './db.js';

export async function createPoll({ question, options, creatorId, creatorName, channelId }) {
  const client = await pool.connect();
  try {
    // Wrap in a transaction so a poll is never saved without its options
    await client.query('BEGIN');

    const { rows } = await client.query(`SELECT nextval('poll_counter') AS n`);
    const pollId = `poll_${rows[0].n}`;

    await client.query(
      `INSERT INTO polls (poll_id, question, creator_id, creator_name, channel_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [pollId, question, creatorId, creatorName, channelId]
    );

    for (let i = 0; i < options.length; i++) {
      await client.query(
        `INSERT INTO options (id, poll_id, label, position) VALUES ($1, $2, $3, $4)`,
        [`opt_${pollId}_${i}`, pollId, options[i], i]
      );
    }

    await client.query('COMMIT');
    return getPoll(pollId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Fetch a poll and rebuild the full object shape (options + voters Map) the
// rest of the code expects. Returns null if the poll doesn't exist.
export async function getPoll(pollId) {
  const pollRes = await pool.query(
    `SELECT poll_id, question, creator_id, creator_name, channel_id, message_id, created_at
     FROM polls WHERE poll_id = $1`,
    [pollId]
  );
  if (pollRes.rowCount === 0) return null;
  const p = pollRes.rows[0];

  const optRes = await pool.query(
    `SELECT id, label FROM options WHERE poll_id = $1 ORDER BY position`,
    [pollId]
  );

  const voteRes = await pool.query(
    `SELECT v.option_id, v.user_id, v.display_name
     FROM votes v
     JOIN options o ON o.id = v.option_id
     WHERE o.poll_id = $1`,
    [pollId]
  );

  // Group votes by option into Maps of userId -> displayName
  const votersByOption = new Map();
  for (const row of voteRes.rows) {
    if (!votersByOption.has(row.option_id)) votersByOption.set(row.option_id, new Map());
    votersByOption.get(row.option_id).set(row.user_id, row.display_name);
  }

  return {
    pollId:      p.poll_id,
    question:    p.question,
    creatorId:   p.creator_id,
    creatorName: p.creator_name,
    channelId:   p.channel_id,
    messageId:   p.message_id,
    createdAt:   p.created_at,
    options: optRes.rows.map(o => ({
      id: o.id,
      label: o.label,
      voters: votersByOption.get(o.id) || new Map(),
    })),
  };
}

export async function setMessageId(pollId, messageId) {
  await pool.query(
    `UPDATE polls SET message_id = $1 WHERE poll_id = $2`,
    [messageId, pollId]
  );
}

export async function toggleVote(pollId, optionId, userId, displayName) {
  // Make sure the option belongs to this poll
  const opt = await pool.query(
    `SELECT id FROM options WHERE id = $1 AND poll_id = $2`,
    [optionId, pollId]
  );
  if (opt.rowCount === 0) return null;

  const existing = await pool.query(
    `SELECT 1 FROM votes WHERE option_id = $1 AND user_id = $2`,
    [optionId, userId]
  );

  if (existing.rowCount > 0) {
    await pool.query(
      `DELETE FROM votes WHERE option_id = $1 AND user_id = $2`,
      [optionId, userId]
    );
    return 'removed';
  }

  await pool.query(
    `INSERT INTO votes (option_id, user_id, display_name) VALUES ($1, $2, $3)`,
    [optionId, userId, displayName]
  );
  return 'added';
}

export async function addOption(pollId, label, userId, displayName) {
  const poll = await pool.query(`SELECT poll_id FROM polls WHERE poll_id = $1`, [pollId]);
  if (poll.rowCount === 0) return null;

  // Prevent duplicate options (case-insensitive)
  const dup = await pool.query(
    `SELECT 1 FROM options WHERE poll_id = $1 AND lower(label) = lower($2)`,
    [pollId, label]
  );
  if (dup.rowCount > 0) return 'duplicate';

  const id = `opt_${pollId}_${Date.now()}`;
  const posRes = await pool.query(
    `SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM options WHERE poll_id = $1`,
    [pollId]
  );
  const position = posRes.rows[0].pos;

  await pool.query(
    `INSERT INTO options (id, poll_id, label, position) VALUES ($1, $2, $3, $4)`,
    [id, pollId, label, position]
  );

  // Auto-vote for the person who added it
  await pool.query(
    `INSERT INTO votes (option_id, user_id, display_name) VALUES ($1, $2, $3)`,
    [id, userId, displayName]
  );

  return { id, label };
}

export async function editOption(pollId, optionId, newLabel) {
  const poll = await pool.query(`SELECT poll_id FROM polls WHERE poll_id = $1`, [pollId]);
  if (poll.rowCount === 0) return null;

  const opt = await pool.query(
    `SELECT id FROM options WHERE id = $1 AND poll_id = $2`,
    [optionId, pollId]
  );
  if (opt.rowCount === 0) return 'not_found';

  // Prevent duplicate labels (case-insensitive), ignoring the option being edited
  const dup = await pool.query(
    `SELECT 1 FROM options WHERE poll_id = $1 AND id <> $2 AND lower(label) = lower($3)`,
    [pollId, optionId, newLabel]
  );
  if (dup.rowCount > 0) return 'duplicate';

  await pool.query(`UPDATE options SET label = $1 WHERE id = $2`, [newLabel, optionId]);
  return { id: optionId, label: newLabel };
}

// --- Pure helpers: operate on an already-fetched poll object, so they stay
// --- synchronous and embedBuilder.js needs no changes.

export function getTotalVotes(poll) {
  return poll.options.reduce((sum, o) => sum + o.voters.size, 0);
}

// Options sorted by vote count (descending). Returns a copy, so poll.options
// keeps its original order. Ties keep creation order (stable sort).
export function rankedOptions(poll) {
  return [...poll.options].sort((a, b) => b.voters.size - a.voters.size);
}
