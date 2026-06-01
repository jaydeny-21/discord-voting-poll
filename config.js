const dotenv = require('dotenv')

// Load .env file into process.env
dotenv.config()

// Helper to enforce required env variables
function getEnv(key) {
  const value = process.env[key]
  if (!value) {
    throw new Error (`Missing required environment variable: ${key}`)
  }
  return value
}

const config = {
  // Your bot token from Discord Developer Portal
  token: getEnv('TOKEN'),

  // Your application/client ID from Discord Developer Portal
  clientId: getEnv('CLIENT_ID'),

  // Your Discord server (guild) ID — right-click your server icon → Copy Server ID
  guildId: getEnv('GUILD_ID'),
};

module.exports =  config
