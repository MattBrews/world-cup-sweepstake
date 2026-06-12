import { Router } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

function lookupSweep(ref) {
  const db = getDb();
  let s = db.prepare('SELECT id, name, slug, public_id FROM sweepstakes WHERE public_id = ?').get(ref);
  if (!s) s = db.prepare('SELECT id, name, slug, public_id FROM sweepstakes WHERE slug = ?').get(ref);
  return s;
}

router.get('/:ref/dashboard', (req, res) => {
  const db = getDb();
  const sweep = lookupSweep(req.params.ref);
  if (!sweep) return res.status(404).json({ error: 'Not found' });

  const participants = db.prepare(
    'SELECT id, name, team_id, team_name FROM participants WHERE sweepstake_id = ?'
  ).all(sweep.id);

  const standings = db.prepare(
    'SELECT * FROM cached_standings ORDER BY group_letter, rank'
  ).all();

  const fixtures = db.prepare(
    'SELECT * FROM cached_fixtures ORDER BY date'
  ).all();

  const teams = db.prepare(
    'SELECT * FROM cached_teams ORDER BY name'
  ).all();

  const participantTeamIds = new Set(participants.map(p => p.team_id));

  const currentStage = detectCurrentStage(fixtures);

  res.json({
    sweepstake: sweep,
    participants,
    participantTeamIds: [...participantTeamIds],
    standings,
    fixtures,
    teams,
    currentStage,
  });
});

function detectCurrentStage(fixtures) {
  const stages = ['Group Stage', 'Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', '3rd Place', 'Final'];

  const lastUnplayed = fixtures
    .filter(f => f.status !== 'FT' && f.status !== 'AWAITING')
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

  if (!lastUnplayed) return stages[stages.length - 1];

  return lastUnplayed.stage || 'Group Stage';
}

router.get('/:ref/fixtures', (req, res) => {
  const db = getDb();
  const { round, stage, status } = req.query;

  const sweep = lookupSweep(req.params.ref);
  if (!sweep) return res.status(404).json({ error: 'Not found' });

  let sql = 'SELECT * FROM cached_fixtures WHERE 1=1';
  const params = [];

  if (round) { sql += ' AND round = ?'; params.push(round); }
  if (stage) { sql += ' AND stage = ?'; params.push(stage); }
  if (status) { sql += ' AND status = ?'; params.push(status); }

  sql += ' ORDER BY date';

  const fixtures = db.prepare(sql).all(...params);
  res.json(fixtures);
});

router.get('/:ref/standings', (req, res) => {
  const db = getDb();
  const sweep = lookupSweep(req.params.ref);
  if (!sweep) return res.status(404).json({ error: 'Not found' });

  const standings = db.prepare(
    'SELECT * FROM cached_standings ORDER BY group_letter, rank'
  ).all();
  res.json(standings);
});

router.get('/:ref/recent-results', (req, res) => {
  const db = getDb();
  const sweep = lookupSweep(req.params.ref);
  if (!sweep) return res.status(404).json({ error: 'Not found' });

  const fixtures = db.prepare(
    "SELECT * FROM cached_fixtures WHERE status = 'FT' ORDER BY date DESC"
  ).all();

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = fixtures.filter(f => new Date(f.date) >= cutoff);

  res.json(recent);
});

router.get('/:ref/rounds', (req, res) => {
  const db = getDb();
  const rounds = db.prepare(
    "SELECT round, MIN(date) as first_date FROM cached_fixtures WHERE round IS NOT NULL AND round != '' GROUP BY round ORDER BY first_date"
  ).all();
  res.json(rounds.map(r => r.round));
});

router.get('/:ref/match-details/:matchId', (req, res) => {
  const db = getDb();

  const fixture = db.prepare('SELECT * FROM cached_fixtures WHERE id = ?').get(req.params.matchId);
  if (!fixture) return res.status(404).json({ error: 'Match not found' });

  const events = db.prepare(
    'SELECT * FROM match_events WHERE match_id = ? ORDER BY period, id'
  ).all(req.params.matchId);

  const lineups = db.prepare(
    'SELECT * FROM match_lineups WHERE match_id = ? ORDER BY is_starter DESC, shirt_number'
  ).all(req.params.matchId);

  const homeLineup = lineups.filter(l => l.team_id === fixture.home_team_id);
  const awayLineup = lineups.filter(l => l.team_id === fixture.away_team_id);

  const homeTeam = db.prepare('SELECT * FROM cached_teams WHERE id = ?').get(fixture.home_team_id);
  const awayTeam = db.prepare('SELECT * FROM cached_teams WHERE id = ?').get(fixture.away_team_id);

  res.json({
    fixture,
    homeTeam,
    awayTeam,
    events,
    lineups: { home: homeLineup, away: awayLineup },
  });
});

router.get('/:ref/stats', (req, res) => {
  const db = getDb();
  const { type } = req.query;
  const sweep = lookupSweep(req.params.ref);
  if (!sweep) return res.status(404).json({ error: 'Not found' });

  if (type === 'cards') {
    const data = db.prepare(`
      SELECT
        t.id as team_id, t.name, t.logo_url,
        SUM(CASE WHEN json_extract(me.additional_info, '$.card') = 'YELLOW' THEN 1 ELSE 0 END) as yellow,
        SUM(CASE WHEN json_extract(me.additional_info, '$.card') IN ('RED', 'SECOND_YELLOW') THEN 1 ELSE 0 END) as red,
        COUNT(*) as total
      FROM match_events me
      JOIN cached_teams t ON t.id = me.team_id
      WHERE me.type = 'BOOKING'
      GROUP BY me.team_id
      ORDER BY total DESC
    `).all();
    return res.json(data);
  }

  if (type === 'goals') {
    const data = db.prepare(`
      SELECT
        t.id as team_id, t.name, t.logo_url,
        COALESCE(s.goals_for, 0) as gf,
        COALESCE(s.goals_against, 0) as ga,
        COALESCE(s.goal_diff, 0) as gd
      FROM cached_standings s
      JOIN cached_teams t ON t.id = s.team_id
      GROUP BY s.team_id
      ORDER BY gf DESC
    `).all();
    return res.json(data);
  }

  if (type === 'scorers') {
    const data = db.prepare(`
      SELECT cs.player_name, cs.team_id, t.name as team_name, t.logo_url, cs.goals
      FROM cached_top_scorers cs
      JOIN cached_teams t ON t.id = cs.team_id
      ORDER BY cs.goals DESC, cs.player_name
    `).all();
    return res.json(data);
  }

  // Default: standings
  const standings = db.prepare(
    'SELECT * FROM cached_standings ORDER BY group_letter, rank'
  ).all();
  res.json(standings);
});

export default router;
