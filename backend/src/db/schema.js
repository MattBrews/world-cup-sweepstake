import { randomBytes } from 'node:crypto';
import { getDb } from './connection.js';

export function runMigrations() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS sweepstakes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      public_id TEXT UNIQUE,
      admin_password TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sweepstake_id TEXT NOT NULL REFERENCES sweepstakes(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      team_id INTEGER NOT NULL,
      team_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cached_teams (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT,
      logo_url TEXT,
      group_letter TEXT
    );

    CREATE TABLE IF NOT EXISTS cached_fixtures (
      id INTEGER PRIMARY KEY,
      round TEXT,
      stage TEXT,
      date TEXT,
      home_team_id INTEGER,
      away_team_id INTEGER,
      home_score INTEGER,
      away_score INTEGER,
      status TEXT,
      venue TEXT,
      home_placeholder TEXT,
      away_placeholder TEXT
    );

    CREATE TABLE IF NOT EXISTS cached_standings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_letter TEXT NOT NULL,
      team_id INTEGER NOT NULL,
      rank INTEGER,
      points INTEGER,
      played INTEGER,
      win INTEGER,
      draw INTEGER,
      lose INTEGER,
      goals_for INTEGER,
      goals_against INTEGER,
      goal_diff INTEGER
    );

    CREATE TABLE IF NOT EXISTS cached_top_scorers (
      player_name TEXT,
      team_id INTEGER,
      goals INTEGER
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT,
      request_count INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Add tv_channel column if not exists
  try {
    db.exec("ALTER TABLE cached_fixtures ADD COLUMN tv_channel TEXT");
  } catch {
    // column already exists
  }

  const missing = db.prepare('SELECT id FROM sweepstakes WHERE public_id IS NULL').all();
  const update = db.prepare('UPDATE sweepstakes SET public_id = ? WHERE id = ?');
  for (const row of missing) {
    update.run(randomBytes(6).toString('hex'), row.id);
  }
}
