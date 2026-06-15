import { Router } from 'express';
import { getV2Db } from '../v2/db/connection.js';

const router = Router();

router.get('/v2/data', (req, res) => {
  try {
    const db = getV2Db();

    const teams = db.prepare(`
      SELECT t.id, t.name, t.code, t.logo_url, t.parent_team_id,
             pt.name AS parent_team_name
      FROM teams t
      LEFT JOIN teams pt ON pt.id = t.parent_team_id
      ORDER BY t.name
    `).all();

    const aliases = db.prepare('SELECT * FROM team_name_aliases ORDER BY provider_name, name').all();

    const teamProviderIds = db.prepare('SELECT * FROM team_provider_ids ORDER BY provider_name, team_id').all();

    const fixtureProviderIds = db.prepare('SELECT * FROM fixture_provider_ids ORDER BY provider_name, fixture_id').all();

    const fixtures = db.prepare(`
      SELECT f.id, f.round, f.stage, f.date, f.venue, f.tv_channel,
             ht.name AS home_team, at.name AS away_team,
             f.home_placeholder, f.away_placeholder,
             fl.status AS live_status, fl.home_score, fl.away_score,
             fl.current_minute, fl.period,
             fo.status AS outcome_status, fo.home_score AS ft_home, fo.away_score AS ft_away
      FROM competition_fixtures f
      LEFT JOIN teams ht ON ht.id = f.home_team_id
      LEFT JOIN teams at ON at.id = f.away_team_id
      LEFT JOIN fixture_live fl ON fl.fixture_id = f.id
      LEFT JOIN fixture_outcomes fo ON fo.fixture_id = f.id
      ORDER BY f.date
    `).all();

    const syncLog = db.prepare('SELECT * FROM sync_log ORDER BY created_at DESC LIMIT 50').all();

    const comparisons = db.prepare(`
      SELECT * FROM comparison_results
      WHERE diff_type != 'MATCH'
      ORDER BY entity_type, created_at DESC
      LIMIT 50
    `).all();

    const counts = {
      teams: db.prepare('SELECT COUNT(*) AS c FROM teams').get().c,
      competitions: db.prepare('SELECT COUNT(*) AS c FROM competitions').get().c,
      fixtures: db.prepare('SELECT COUNT(*) AS c FROM competition_fixtures').get().c,
      live: db.prepare('SELECT COUNT(*) AS c FROM fixture_live').get().c,
      outcomes: db.prepare('SELECT COUNT(*) AS c FROM fixture_outcomes').get().c,
      details: db.prepare('SELECT COUNT(*) AS c FROM fixture_details').get().c,
      events: db.prepare('SELECT COUNT(*) AS c FROM match_events').get().c,
      lineups: db.prepare('SELECT COUNT(*) AS c FROM match_lineups').get().c,
      aliases: db.prepare('SELECT COUNT(*) AS c FROM team_name_aliases').get().c,
      comparisons: db.prepare('SELECT COUNT(*) AS c FROM comparison_results').get().c,
    };

    res.json({ teams, aliases, teamProviderIds, fixtureProviderIds, fixtures, syncLog, comparisons, counts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
