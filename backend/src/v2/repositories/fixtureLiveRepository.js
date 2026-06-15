import { getV2Db } from '../db/connection.js';

export class FixtureLiveRepository {
  constructor() {
    this.db = getV2Db();
  }

  upsert(liveData) {
    const { fixture_id, home_score, away_score, home_ht_score, away_ht_score, status, current_minute, period } = liveData;
    const existing = this.db.prepare('SELECT id FROM fixture_live WHERE fixture_id = ?').get(fixture_id);
    if (existing) {
      this.db.prepare(`
        UPDATE fixture_live SET
          home_score = COALESCE(?, home_score),
          away_score = COALESCE(?, away_score),
          home_ht_score = COALESCE(?, home_ht_score),
          away_ht_score = COALESCE(?, away_ht_score),
          status = COALESCE(?, status),
          current_minute = COALESCE(?, current_minute),
          period = COALESCE(?, period),
          updated_at = datetime('now')
        WHERE fixture_id = ?
      `).run(home_score ?? null, away_score ?? null, home_ht_score ?? null, away_ht_score ?? null, status || null, current_minute ?? null, period ?? null, fixture_id);
    } else {
      this.db.prepare(`
        INSERT INTO fixture_live (fixture_id, home_score, away_score, home_ht_score, away_ht_score, status, current_minute, period)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(fixture_id, home_score ?? null, away_score ?? null, home_ht_score ?? null, away_ht_score ?? null, status || 'AWAITING', current_minute ?? null, period ?? null);
    }
  }

  getByFixtureId(fixtureId) {
    return this.db.prepare('SELECT * FROM fixture_live WHERE fixture_id = ?').get(fixtureId);
  }
}
