import { getV2Db } from '../db/connection.js';

export class LineupRepository {
  constructor() {
    this.db = getV2Db();
  }

  replaceLineups(fixtureId, lineups) {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM match_lineups WHERE fixture_id = ?').run(fixtureId);
      const insert = this.db.prepare(`
        INSERT INTO match_lineups (fixture_id, team_id, player_name, position, shirt_number, is_starter)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const l of lineups) {
        insert.run(fixtureId, l.team_id || null, l.player_name, l.position || null, l.shirt_number ?? null, l.is_starter ? 1 : 0);
      }
    })();
  }

  getByFixtureId(fixtureId) {
    return this.db.prepare('SELECT * FROM match_lineups WHERE fixture_id = ? ORDER BY is_starter DESC, position').all(fixtureId);
  }
}
