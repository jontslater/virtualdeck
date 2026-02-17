import { query } from '../db';

export async function initDb() {
  // Create tables if they don't exist. Simple schema based on docs.
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      twitch_user_id TEXT,
      twitch_login TEXT,
      display_name TEXT,
      access_token TEXT,
      refresh_token TEXT,
      token_expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      host_user_id TEXT,
      status TEXT,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS room_participants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id TEXT REFERENCES rooms(id),
      user_id TEXT,
      team TEXT,
      joined_at TIMESTAMP DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS battles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id TEXT REFERENCES rooms(id),
      status TEXT,
      started_at TIMESTAMP,
      ends_at TIMESTAMP,
      winner_team TEXT,
      hp_a INTEGER,
      hp_b INTEGER,
      team_a_name TEXT,
      team_b_name TEXT,
      last_action_text TEXT,
      last_action_amount INTEGER,
      last_action_team TEXT
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS battle_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      battle_id UUID REFERENCES battles(id),
      type TEXT,
      twitch_event_id TEXT UNIQUE,
      from_user TEXT,
      amount INTEGER,
      team TEXT,
      created_at TIMESTAMP DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS battle_invites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      from_user TEXT NOT NULL,
      to_user TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      room_id TEXT,
      created_at TIMESTAMP DEFAULT now()
    );
  `);
}

