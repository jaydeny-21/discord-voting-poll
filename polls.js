// polls.js — in-memory poll storage
// Each poll is stored by a unique pollId
// Structure:
// {
//   pollId: string,
//   question: string,
//   creatorId: string,
//   creatorName: string,
//   channelId: string,
//   messageId: string,        // set after the message is sent
//   options: [
//     { id: string, label: string, voters: Map<userId, username> }
//   ]
// }

const polls = new Map();
let counter = 1;

export function createPoll({ question, options, creatorId, creatorName, channelId }) {
  const pollId = `poll_${counter++}`;
  const poll = {
    pollId,
    question,
    creatorId,
    creatorName,
    channelId,
    messageId: null,
    createdAt: new Date(),
    options: options.map((label, i) => ({
      id: `opt_${pollId}_${i}`,
      label,
      voters: new Map(), // userId -> displayName
    })),
  };
  polls.set(pollId, poll);
  return poll;
}

export function getPoll(pollId) {
  return polls.get(pollId) || null;
}

export function setMessageId(pollId, messageId) {
  const poll = polls.get(pollId);
  if (poll) poll.messageId = messageId;
}

export function toggleVote(pollId, optionId, userId, displayName) {
  const poll = polls.get(pollId);
  if (!poll) return null;

  const option = poll.options.find(o => o.id === optionId);
  if (!option) return null;

  if (option.voters.has(userId)) {
    option.voters.delete(userId);
    return 'removed';
  } else {
    option.voters.set(userId, displayName);
    return 'added';
  }
}

export function addOption(pollId, label, userId, displayName) {
  const poll = polls.get(pollId);
  if (!poll) return null;

  // Prevent duplicate options (case-insensitive)
  const exists = poll.options.some(o => o.label.toLowerCase() === label.toLowerCase());
  if (exists) return 'duplicate';

  const newOpt = {
    id: `opt_${pollId}_custom_${Date.now()}`,
    label,
    voters: new Map([[userId, displayName]]), // auto-vote for the person who added it
  };
  poll.options.push(newOpt);
  return newOpt;
}

export function editOption(pollId, optionId, newLabel) {
  const poll = polls.get(pollId);
  if (!poll) return null;

  const option = poll.options.find(o => o.id === optionId);
  if (!option) return 'not_found';

  // Prevent duplicate labels (case-insensitive), ignoring the option being edited
  const exists = poll.options.some(
    o => o.id !== optionId && o.label.toLowerCase() === newLabel.toLowerCase()
  );
  if (exists) return 'duplicate';

  option.label = newLabel;
  return option;
}

export function getTotalVotes(poll) {
  return poll.options.reduce((sum, o) => sum + o.voters.size, 0);
}


