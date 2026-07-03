import dotenv from 'dotenv'

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


// Your bot token from Discord Developer Portal
export const token = getEnv('TOKEN');

// Your application/client ID from Discord Developer Portal
export const clientId = getEnv('CLIENT_ID');

// Your Discord server (guild) ID — right-click your server icon → Copy Server ID
export const guildId = getEnv('GUILD_ID');

// Postgres connection string, e.g. postgres://user:pass@localhost:5432/pollbot
export const databaseUrl = getEnv('DATABASE_URL');



