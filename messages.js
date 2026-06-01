// messages.js — all display text and reply messages used across the bot

module.exports = {

  //  Poll embed text 
  NO_VOTES_YET:     '_No votes yet_',
  NO_VOTES:         '_No votes_',
  POLL_ENDED_TITLE: (question) => `Poll Ended - ${question}`,
  NO_VOTES_CAST:    '*No votes were cast.*',
  WINNER:           (winner) => `***Winner*** **: ${winner.label}** with ${winner.voters.size} vote${winner.voters.size !== 1 ? 's' : ''}!`,

  //  Button labels 
  BTN_ADD_OPTION:   'Add option',
  BTN_END_POLL:     'End poll',

  //  Interaction replies 
  REPLY_MIN_OPTIONS:      'Could you provide at least **2 options** 😁?',
  REPLY_POLL_NOT_FOUND:   'Sorry, I couldn\'t find the poll 😔',
  REPLY_OPTION_NOT_FOUND: 'Sorry, I couldn\'t find the option 😔',
  REPLY_NOT_CREATOR:      'Im sorry, but you can\'t end something you never created ...🙂‍↔️',
  REPLY_EMPTY_OPTION:     'My friend, option label cannot be empty 🙂',
  REPLY_DUPLICATE:        (label) => `Wake up, option ***${label}*** already exists 😆`,
  REPLY_OPTION_ADDED:     (displayName, label) => `Look, **${displayName}** just added ***${label}*** to the poll 👀`,
  REPLY_VOTE_ADDED:       (displayName, label) => `✅ **${displayName}** voted for ***${label}***!`,
  REPLY_VOTE_REMOVED:     (displayName, label) => `🗑️ **${displayName}** removed your vote from **${label}**.`,
  REPLY_GENERIC_ERROR:    'Something went wrong. Please try again 😔',
  CONFIRM_OPTION_ADDED:   'Option added!',

  //  Modal text 
  MODAL_TITLE:            'Tell us about your option 😃',
  MODAL_LABEL:            'Option text',

  // Footer text
  FOOTER:                 (totalVote, creator, date) => `${totalVote} vote${totalVote !== 1 ? 's' : ''}\u2002•\u2002Poll by ${creator}\u2002•\u2002${date}`,
  
  // Poll Field text
  ROW_OPTION_NAME:        (i, label) => `${i + 1}. ${label}`,
  ROW_OPTION_VALUE:       (bar, pct, count, names) => `${bar}\u2002 **${pct}%**\u2002•\u2002(${count})\n*${names}*`,

  // Date   Today at 6:01 PM
  DATE:                   (hours, minutes, ampm) => `Today at ${hours}:${minutes} ${ampm}`
};