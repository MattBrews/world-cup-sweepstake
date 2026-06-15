import { getV2Db } from '../db/connection.js';

export class DetailsRepository {
  constructor() {
    this.db = getV2Db();
  }

  upsert(fixtureId, details) {
    const { home_formation, away_formation, attendance, referee } = details;
    this.db.prepare(`
      INSERT INTO fixture_details (fixture_id, home_formation, away_formation, attendance, referee, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(fixture_id) DO UPDATE SET
        home_formation = COALESCE(excluded.home_formation, fixture_details.home_formation),
        away_formation = COALESCE(excluded.away_formation, fixture_details.away_formation),
        attendance = COALESCE(excluded.attendance, fixture_details.attendance),
        referee = COALESCE(excluded.referee, fixture_details.referee),
        updated_at = datetime('now')
    `).run(fixtureId, home_formation || null, away_formation || null, attendance ?? null, referee || null);
  }

  getByFixtureId(fixtureId) {
    return this.db.prepare('SELECT * FROM fixture_details WHERE fixture_id = ?').get(fixtureId);
  }
}
