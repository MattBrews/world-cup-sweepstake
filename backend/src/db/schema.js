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

  // Add HT score columns if not exists
  try {
    db.exec("ALTER TABLE cached_fixtures ADD COLUMN home_ht_score INTEGER");
  } catch {
    // column already exists
  }
  try {
    db.exec("ALTER TABLE cached_fixtures ADD COLUMN away_ht_score INTEGER");
  } catch {
    // column already exists
  }

  // Add FIFA match ID, formations, attendance, referee
  try { db.exec("ALTER TABLE cached_fixtures ADD COLUMN api_match_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE cached_fixtures ADD COLUMN home_formation TEXT"); } catch {}
  try { db.exec("ALTER TABLE cached_fixtures ADD COLUMN away_formation TEXT"); } catch {}
  try { db.exec("ALTER TABLE cached_fixtures ADD COLUMN attendance INTEGER"); } catch {}
  try { db.exec("ALTER TABLE cached_fixtures ADD COLUMN referee TEXT"); } catch {}

  try { db.exec("ALTER TABLE cached_fixtures ADD COLUMN lifecycle_state TEXT DEFAULT 'SCHEDULED'"); } catch {}
  try { db.exec("ALTER TABLE cached_fixtures ADD COLUMN last_synced_at TEXT"); } catch {}
  try { db.exec("ALTER TABLE cached_fixtures ADD COLUMN data_sources TEXT"); } catch {}
  try { db.exec("ALTER TABLE cached_fixtures ADD COLUMN current_minute INTEGER"); } catch {}
  try { db.exec("ALTER TABLE cached_fixtures ADD COLUMN current_minute_display TEXT"); } catch {}
  try { db.exec("ALTER TABLE cached_fixtures ADD COLUMN period INTEGER"); } catch {}

  try { db.exec("ALTER TABLE cached_fixtures ADD COLUMN home_pen_score INTEGER"); } catch {}
  try { db.exec("ALTER TABLE cached_fixtures ADD COLUMN away_pen_score INTEGER"); } catch {}
  try { db.exec("ALTER TABLE cached_fixtures ADD COLUMN espn_game_id INTEGER"); } catch {}

  try { db.exec("ALTER TABLE cached_fixtures ADD COLUMN home_placeholder TEXT"); } catch {}
  try { db.exec("ALTER TABLE cached_fixtures ADD COLUMN away_placeholder TEXT"); } catch {}

  // FIFA ranking for tiebreakers
  try { db.exec("ALTER TABLE cached_teams ADD COLUMN fifa_ranking INTEGER DEFAULT 9999"); } catch {}

  // Match events (timeline)
  db.exec(`
    CREATE TABLE IF NOT EXISTS match_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER REFERENCES cached_fixtures(id),
      team_id INTEGER,
      type TEXT NOT NULL,
      minute TEXT,
      period INTEGER,
      player_name TEXT,
      additional_info TEXT
    )
  `);

  // Match line-ups
  db.exec(`
    CREATE TABLE IF NOT EXISTS match_lineups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER REFERENCES cached_fixtures(id),
      team_id INTEGER,
      player_name TEXT,
      position TEXT,
      shirt_number INTEGER,
      is_starter INTEGER
    )
  `);

  // Penalty shootout per-kick data (from ESPN)
  db.exec(`
    CREATE TABLE IF NOT EXISTS penalty_shootout_kicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER REFERENCES cached_fixtures(id),
      team_id INTEGER,
      player_name TEXT,
      shot_number INTEGER,
      did_score INTEGER,
      espn_player_id INTEGER
    )
  `);

  // FIFA team ID to local team ID mapping
  db.exec(`
    CREATE TABLE IF NOT EXISTS cached_team_mappings (
      fifa_team_id INTEGER PRIMARY KEY,
      local_team_id INTEGER NOT NULL
    )
  `);

  // Top scorers (with PK for ON CONFLICT)
  db.exec(`
    CREATE TABLE IF NOT EXISTS cached_top_scorers (
      player_name TEXT,
      team_id INTEGER,
      goals INTEGER,
      PRIMARY KEY (player_name, team_id)
    )
  `);

  // Fix cached_top_scorers table if it doesn't have the composite PK
  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='cached_top_scorers'").get();
    if (tableInfo && !tableInfo.sql.includes('PRIMARY KEY')) {
      db.exec('DROP TABLE cached_top_scorers');
      db.exec(`
        CREATE TABLE cached_top_scorers (
          player_name TEXT,
          team_id INTEGER,
          goals INTEGER,
          PRIMARY KEY (player_name, team_id)
        )
      `);
    }
  } catch {}

  const missing = db.prepare('SELECT id FROM sweepstakes WHERE public_id IS NULL').all();
  const update = db.prepare('UPDATE sweepstakes SET public_id = ? WHERE id = ?');
  for (const row of missing) {
    update.run(randomBytes(6).toString('hex'), row.id);
  }
}
