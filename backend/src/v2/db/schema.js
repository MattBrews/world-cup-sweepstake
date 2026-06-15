import { getV2Db } from './connection.js';

export function runV2Migrations() {
  const db = getV2Db();

  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT NOT NULL UNIQUE,
      code           TEXT,
      logo_url       TEXT,
      parent_team_id INTEGER REFERENCES teams(id)
    );

    CREATE TABLE IF NOT EXISTS competitions (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      name   TEXT NOT NULL,
      slug   TEXT NOT NULL UNIQUE,
      sport  TEXT NOT NULL,
      season TEXT,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS competition_teams (
      competition_id INTEGER NOT NULL REFERENCES competitions(id),
      team_id        INTEGER NOT NULL REFERENCES teams(id),
      group_letter   TEXT,
      seed           INTEGER,
      PRIMARY KEY (competition_id, team_id)
    );

    CREATE TABLE IF NOT EXISTS competition_fixtures (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id   INTEGER NOT NULL REFERENCES competitions(id),
      round            TEXT,
      stage            TEXT,
      date             TEXT NOT NULL,
      venue            TEXT,
      home_team_id     INTEGER REFERENCES teams(id),
      away_team_id     INTEGER REFERENCES teams(id),
      home_placeholder TEXT,
      away_placeholder TEXT,
      tv_channel       TEXT
    );

    CREATE TABLE IF NOT EXISTS fixture_live (
      fixture_id     INTEGER PRIMARY KEY REFERENCES competition_fixtures(id),
      home_score     INTEGER,
      away_score     INTEGER,
      home_ht_score  INTEGER,
      away_ht_score  INTEGER,
      status         TEXT DEFAULT 'SCHEDULED',
      current_minute INTEGER,
      period         INTEGER,
      updated_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fixture_outcomes (
      fixture_id    INTEGER PRIMARY KEY REFERENCES competition_fixtures(id),
      home_score    INTEGER,
      away_score    INTEGER,
      home_ht_score INTEGER,
      away_ht_score INTEGER,
      status        TEXT DEFAULT 'SCHEDULED',
      updated_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fixture_details (
      fixture_id     INTEGER PRIMARY KEY REFERENCES competition_fixtures(id),
      home_formation TEXT,
      away_formation TEXT,
      attendance     INTEGER,
      referee        TEXT,
      updated_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS match_events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      fixture_id  INTEGER NOT NULL REFERENCES competition_fixtures(id),
      team_id     INTEGER,
      type        TEXT NOT NULL,
      minute      TEXT,
      period      INTEGER,
      player_name TEXT
    );

    CREATE TABLE IF NOT EXISTS goal_events (
      event_id      INTEGER PRIMARY KEY REFERENCES match_events(id),
      goal_type     TEXT NOT NULL,
      assist_player TEXT
    );

    CREATE TABLE IF NOT EXISTS booking_events (
      event_id  INTEGER PRIMARY KEY REFERENCES match_events(id),
      card_type TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS substitution_events (
      event_id   INTEGER PRIMARY KEY REFERENCES match_events(id),
      player_off TEXT NOT NULL,
      player_on  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS penalty_shootout_events (
      event_id INTEGER PRIMARY KEY REFERENCES match_events(id),
      scored   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS match_lineups (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      fixture_id   INTEGER NOT NULL REFERENCES competition_fixtures(id),
      team_id      INTEGER,
      player_name  TEXT,
      position     TEXT,
      shirt_number INTEGER,
      is_starter   INTEGER
    );

    CREATE TABLE IF NOT EXISTS sweepstakes (
      id             TEXT PRIMARY KEY,
      competition_id INTEGER NOT NULL REFERENCES competitions(id),
      name           TEXT NOT NULL,
      slug           TEXT NOT NULL UNIQUE,
      public_id      TEXT UNIQUE,
      admin_password TEXT,
      created_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS participants (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      sweepstake_id  TEXT NOT NULL REFERENCES sweepstakes(id) ON DELETE CASCADE,
      name           TEXT NOT NULL,
      team_id        INTEGER NOT NULL,
      team_name      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS team_name_aliases (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_name TEXT NOT NULL,
      name          TEXT NOT NULL,
      team_id       INTEGER REFERENCES teams(id),
      resolved      INTEGER DEFAULT 0,
      created_at    TEXT DEFAULT (datetime('now')),
      resolved_at   TEXT,
      UNIQUE(provider_name, name)
    );

    CREATE TABLE IF NOT EXISTS team_provider_ids (
      team_id       INTEGER NOT NULL REFERENCES teams(id),
      provider_name TEXT NOT NULL,
      provider_id   TEXT NOT NULL,
      PRIMARY KEY (team_id, provider_name)
    );

    CREATE TABLE IF NOT EXISTS fixture_provider_ids (
      fixture_id        INTEGER NOT NULL REFERENCES competition_fixtures(id),
      provider_name     TEXT NOT NULL,
      provider_match_id TEXT NOT NULL,
      PRIMARY KEY (fixture_id, provider_name)
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      provider    TEXT NOT NULL,
      operation   TEXT NOT NULL,
      status      TEXT NOT NULL,
      details     TEXT,
      items_count INTEGER,
      duration_ms INTEGER,
      created_at  TEXT DEFAULT (datetime('now'))
    );
  `);
}
