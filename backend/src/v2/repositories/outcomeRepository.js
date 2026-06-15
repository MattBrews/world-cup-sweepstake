import { getV2Db } from '../db/connection.js';

export class OutcomeRepository {
  constructor() {
    this.db = getV2Db();
  }

  snapshot(fixtureId) {
    const live = this.db.prepare('SELECT * FROM fixture_live WHERE fixture_id = ?').get(fixtureId);
    if (!live) return;
    this.db.prepare(`
      INSERT INTO fixture_outcomes (fixture_id, home_score, away_score, home_ht_score, away_ht_score, status, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(fixture_id) DO UPDATE SET
        home_score = COALESCE(excluded.home_score, fixture_outcomes.home_score),
        away_score = COALESCE(excluded.away_score, fixture_outcomes.away_score),
        home_ht_score = COALESCE(excluded.home_ht_score, fixture_outcomes.home_ht_score),
        away_ht_score = COALESCE(excluded.away_ht_score, fixture_outcomes.away_ht_score),
        status = excluded.status,
        updated_at = datetime('now')
    `).run(fixtureId, live.home_score, live.away_score, live.home_ht_score, live.away_ht_score, live.status);
  }

  markComplete(fixtureId) {
    this.db.prepare(
      "UPDATE fixture_outcomes SET status = 'COMPLETE', updated_at = datetime('now') WHERE fixture_id = ?"
    ).run(fixtureId);
  }

  getByFixtureId(fixtureId) {
    return this.db.prepare('SELECT * FROM fixture_outcomes WHERE fixture_id = ?').get(fixtureId);
  }
}
