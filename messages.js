// messages.js — all display text and reply messages used across the bot

const MSG = {

  //  Poll embed text 
  NO_VOTES_YET:     '_No votes yet_',
  NO_VOTES:         '_No votes_',
  POLL_ENDED_TITLE: (question) => `Poll Ended - ${question}`,
  NO_VOTES_CAST:    '*No votes were cast.*',
  RESULT_WINNERS:   (winners, maxVotes) => `**Winner **: ${winners.map(w => `***${w.label}***`).join(', ')} with ${maxVotes} vote${maxVotes !== 1 ? 's' : ''}!`,

  //  Button labels
  BTN_ADD_OPTION:   'Add option',
  BTN_EDIT_OPTION:  'Edit option ',
  BTN_END_POLL:     'End poll',

  //  Interaction replies 
  REPLY_MIN_OPTIONS:      'Could you provide at least **2 options** 😁?',
  REPLY_POLL_NOT_FOUND:   'Sorry, something went wrong with this poll 😔',
  REPLY_OPTION_NOT_FOUND: 'Sorry, I couldn\'t find the option 😔',
  REPLY_NOT_CREATOR:      'Im sorry, but you can\'t end something you never created ...🙂‍↔️',
  REPLY_EMPTY_OPTION:     'My friend, option label cannot be empty 🙂',
  REPLY_DUPLICATE:        (label) => `Wake up, option ***${label}*** already exists 😆`,
  REPLY_INITIAL_DUPLICATE:(label) => `Poll can't be created, some options are duplicated 🙂‍↔️: ***${label}***`,
  REPLY_OPTION_ADDED:     (displayName, label) => `📥 **${displayName}** added new option ***${label}***`,
  REPLY_VOTE_ADDED:       (displayName, label) => `✅ **${displayName}** voted for ***${label}***`,
  REPLY_VOTE_REMOVED:     (displayName, label) => `🗑️ **${displayName}** removed their vote from ***${label}***`,
  REPLY_OPTION_EDITED:    (displayName, oldLabel, newLabel) => `✏️ **${displayName}** renamed option ***${oldLabel}*** \u2002➡️\u2002 ***${newLabel}***`,
  REPLY_GENERIC_ERROR:    'Something went wrong. Please try again 😔',
  CONFIRM_OPTION_ADDED:   'Option added!',
  CONFIRM_OPTION_EDITED:  'Option updated!',
  REPLY_NOT_ALLOWED_EDIT: 'Only the poll creator or an admin can edit options 🙂',
  REPLY_CHOOSE_OPTION:    'Which option would you like to edit? ✏️',

  //  Modal text
  MODAL_TITLE:            'Tell us about your option 😃',
  MODAL_LABEL:            'Option text',
  EDIT_SELECT_PLACEHOLDER:'Choose an option to edit',
  EDIT_MODAL_TITLE:       'Edit the option ✏️',
  EDIT_MODAL_LABEL:       'New option text',

  // Footer text
  FOOTER:                 (totalVote, creator, date) => `${totalVote} vote${totalVote !== 1 ? 's' : ''}\u2002•\u2002Poll by ${creator}\u2002•\u2002${date}`,
  
  // Poll Field text
  ROW_OPTION_NAME:        (i, label) => `${i + 1}. ${label}`,
  ROW_OPTION_VALUE:       (bar, pct, count, names) => `${bar}\u2002 **${pct}%**\u2002•\u2002(${count})\n*${names}*`,

  // Creation date: Created on dd/mm/yy
  DATE:                   (date) => `Created on  ${date.getDate().toString().padStart(2,'0')}/${(date.getMonth()+1).toString().padStart(2,'0')}/${date.getFullYear().toString().slice(-2)}`
};

export default MSG;