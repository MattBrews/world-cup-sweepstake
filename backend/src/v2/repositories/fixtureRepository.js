import { getV2Db } from '../db/connection.js';

export class FixtureRepository {
  constructor() {
    this.db = getV2Db();
  }

  findByComposite(competitionId, homeTeamId, awayTeamId, date, round) {
    return this.db.prepare(
      `SELECT * FROM competition_fixtures
       WHERE competition_id = ? AND home_team_id = ? AND away_team_id = ?
       AND date = ? AND round = ?`
    ).get(competitionId, homeTeamId, awayTeamId, date, round || null);
  }

  findById(id) {
    return this.db.prepare('SELECT * FROM competition_fixtures WHERE id = ?').get(id);
  }

  upsert(fixture, competitionId) {
    const { round, stage, date, venue, home_team_id, away_team_id, home_placeholder, away_placeholder, tv_channel } = fixture;
    const existing = this.findByComposite(competitionId, home_team_id, away_team_id, date, round);
    if (existing) {
      this.db.prepare(`
        UPDATE competition_fixtures SET
          stage = COALESCE(?, stage),
          venue = COALESCE(?, venue),
          home_placeholder = COALESCE(?, home_placeholder),
          away_placeholder = COALESCE(?, away_placeholder),
          tv_channel = COALESCE(?, tv_channel)
        WHERE id = ?
      `).run(stage || null, venue || null, home_placeholder || null, away_placeholder || null, tv_channel || null, existing.id);
      return existing.id;
    }
    const info = this.db.prepare(`
      INSERT INTO competition_fixtures
        (competition_id, round, stage, date, venue, home_team_id, away_team_id, home_placeholder, away_placeholder, tv_channel)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(competitionId, round || null, stage || null, date, venue || null, home_team_id, away_team_id, home_placeholder || null, away_placeholder || null, tv_channel || null);
    return info.lastInsertRowid;
  }

  updateTvChannel(fixtureId, tvChannel) {
    this.db.prepare('UPDATE competition_fixtures SET tv_channel = ? WHERE id = ?').run(tvChannel, fixtureId);
  }

  storeProviderId(fixtureId, providerName, providerMatchId) {
    this.db.prepare(
      'INSERT OR REPLACE INTO fixture_provider_ids (fixture_id, provider_name, provider_match_id) VALUES (?, ?, ?)'
    ).run(fixtureId, providerName, String(providerMatchId));
  }

  findFixtureByProviderId(providerName, providerMatchId) {
    const row = this.db.prepare(
      'SELECT fixture_id FROM fixture_provider_ids WHERE provider_name = ? AND provider_match_id = ?'
    ).get(providerName, String(providerMatchId));
    return row ? this.findById(row.fixture_id) : null;
  }

  findAwaitingOrLive() {
    return this.db.prepare(`
      SELECT f.*, COALESCE(fl.status, 'SCHEDULED') AS live_status, fl.current_minute, fl.period
      FROM competition_fixtures f
      LEFT JOIN fixture_live fl ON fl.fixture_id = f.id
      WHERE fl.status IN ('AWAITING', 'LIVE')
         OR (fl.status IS NULL AND f.date <= datetime('now', '+30 minutes'))
    `).all();
  }

  findFtWithoutDetails(cooldownMinutes = 30) {
    return this.db.prepare(`
      SELECT f.* FROM competition_fixtures f
      JOIN fixture_outcomes fo ON fo.fixture_id = f.id
      LEFT JOIN fixture_details fd ON fd.fixture_id = f.id
      WHERE fo.status = 'FT'
      AND fd.fixture_id IS NULL
      AND (fo.updated_at IS NULL OR datetime(fo.updated_at, '+${cooldownMinutes} minutes') <= datetime('now'))
    `).all();
  }

  getAll() {
    return this.db.prepare('SELECT * FROM competition_fixtures ORDER BY date').all();
  }
}
