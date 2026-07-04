// db.js — PostgreSQL connection pool and schema setup

import pg from 'pg';
import { databaseUrl } from './config.js';

const { Pool } = pg;

// A pool reuses a small set of open connections instead of opening a new one
// per query. Every other file talks to the DB through this pool.
export const pool = new Pool({ connectionString: databaseUrl });

// Create the tables once on startup if they don't already exist. Safe to run
// every time the bot boots — "IF NOT EXISTS" makes it a no-op after the first run.
export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS polls (
      poll_id      TEXT PRIMARY KEY,
      question     TEXT NOT NULL,
      creator_id   TEXT NOT NULL,
      creator_name TEXT NOT NULL,
      channel_id   TEXT NOT NULL,
      message_id   TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS options (
      id       TEXT PRIMARY KEY,
      poll_id  TEXT NOT NULL REFERENCES polls(poll_id) ON DELETE CASCADE,
      label    TEXT NOT NULL,
      position INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS votes (
      option_id    TEXT NOT NULL REFERENCES options(id) ON DELETE CASCADE,
      user_id      TEXT NOT NULL,
      display_name TEXT NOT NULL,
      PRIMARY KEY (option_id, user_id)
    );

    -- Generates the sequential numbers for poll ids (poll_1, poll_2, ...).
    -- Lives in the DB so ids never collide across bot restarts.
    CREATE SEQUENCE IF NOT EXISTS poll_counter;
  `);
}
