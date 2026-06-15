import { getDb } from '../../db/connection.js';
import { getV2Db } from '../db/connection.js';

export class DataComparator {
  constructor() {
    this.v1 = getDb();
    this.v2 = getV2Db();
  }

  async compare() {
    this.v2.prepare('DELETE FROM comparison_results').run();
    const results = [];

    const teamResults = this._compareTeams();
    results.push(...teamResults);

    const fixtureResults = this._compareFixtures();
    results.push(...fixtureResults);

    const scoreResults = this._compareScores();
    results.push(...scoreResults);

    const insert = this.v2.prepare(
      'INSERT INTO comparison_results (entity_type, diff_type, v1_data, v2_data) VALUES (?, ?, ?, ?)'
    );
    for (const r of results) {
      insert.run(r.entity_type, r.diff_type, r.v1_data ? JSON.stringify(r.v1_data) : null, r.v2_data ? JSON.stringify(r.v2_data) : null);
    }

    return {
      total: results.length,
      matches: results.filter(r => r.diff_type === 'MATCH').length,
      mismatches: results.filter(r => r.diff_type === 'MISMATCH').length,
      onlyV1: results.filter(r => r.diff_type === 'ONLY_V1').length,
      onlyV2: results.filter(r => r.diff_type === 'ONLY_V2').length,
    };
  }

  _compareTeams() {
    const v1Teams = this.v1.prepare('SELECT id, name, code, group_letter FROM cached_teams ORDER BY id').all();
    const v2Teams = this.v2.prepare('SELECT id, name, code FROM teams ORDER BY id').all();
    const results = [];

    const v1Map = {};
    for (const t of v1Teams) {
      const key = t.name.toLowerCase().replace(/[^a-z]/g, '');
      v1Map[key] = t;
    }

    const v2Map = {};
    for (const t of v2Teams) {
      const key = t.name.toLowerCase().replace(/[^a-z]/g, '');
      v2Map[key] = t;
    }

    for (const [key, v1t] of Object.entries(v1Map)) {
      const v2t = v2Map[key];
      if (!v2t) {
        results.push({ entity_type: 'team', diff_type: 'ONLY_V1', v1_data: v1t, v2_data: null });
      } else if (v1t.code !== v2t.code) {
        results.push({ entity_type: 'team', diff_type: 'MISMATCH', v1_data: v1t, v2_data: v2t });
      } else {
        results.push({ entity_type: 'team', diff_type: 'MATCH', v1_data: v1t, v2_data: v2t });
      }
    }

    for (const [key, v2t] of Object.entries(v2Map)) {
      if (!v1Map[key]) {
        results.push({ entity_type: 'team', diff_type: 'ONLY_V2', v1_data: null, v2_data: v2t });
      }
    }

    return results;
  }

  _compareFixtures() {
    const v1Fixtures = this.v1.prepare(
      'SELECT id, round, stage, date, home_team_id, away_team_id, home_score, away_score, status, venue FROM cached_fixtures ORDER BY id'
    ).all();
    const v2Fixtures = this.v2.prepare(`
      SELECT f.id, f.round, f.stage, f.date, f.home_team_id, f.away_team_id,
             fo.home_score, fo.away_score, fo.status, f.venue
      FROM competition_fixtures f
      LEFT JOIN fixture_outcomes fo ON fo.fixture_id = f.id
      ORDER BY f.id
    `).all();
    const results = [];

    const v1Map = {};
    for (const f of v1Fixtures) {
      const key = `${f.date}|${f.home_team_id}|${f.away_team_id}`;
      v1Map[key] = f;
    }

    const v2Map = {};
    for (const f of v2Fixtures) {
      const key = `${f.date}|${f.home_team_id}|${f.away_team_id}`;
      v2Map[key] = f;
    }

    for (const [key, v1f] of Object.entries(v1Map)) {
      const v2f = v2Map[key];
      if (!v2f) {
        results.push({ entity_type: 'fixture', diff_type: 'ONLY_V1', v1_data: v1f, v2_data: null });
        continue;
      }
      const scoreMatch = v1f.home_score === v2f.home_score && v1f.away_score === v2f.away_score;
      if (!scoreMatch) {
        results.push({ entity_type: 'fixture', diff_type: 'MISMATCH', v1_data: v1f, v2_data: v2f });
      } else {
        results.push({ entity_type: 'fixture', diff_type: 'MATCH', v1_data: v1f, v2_data: v2f });
      }
    }

    for (const [key, v2f] of Object.entries(v2Map)) {
      if (!v1Map[key]) {
        results.push({ entity_type: 'fixture', diff_type: 'ONLY_V2', v1_data: null, v2_data: v2f });
      }
    }

    return results;
  }

  _compareScores() {
    const results = [];
    const v1Fixtures = this.v1.prepare(
      'SELECT id, home_score, away_score, home_ht_score, away_ht_score, status, current_minute FROM cached_fixtures WHERE status IS NOT NULL ORDER BY id'
    ).all();

    for (const v1f of v1Fixtures) {
      const v2live = this.v2.prepare('SELECT * FROM fixture_live WHERE fixture_id = ?').get(v1f.id);
      if (!v2live) {
        results.push({ entity_type: 'score', diff_type: 'ONLY_V1', v1_data: v1f, v2_data: null });
        continue;
      }
      const scoreMatch = v1f.home_score === v2live.home_score && v1f.away_score === v2live.away_score;
      results.push({
        entity_type: 'score',
        diff_type: scoreMatch ? 'MATCH' : 'MISMATCH',
        v1_data: v1f,
        v2_data: v2live,
      });
    }

    return results;
  }
}
