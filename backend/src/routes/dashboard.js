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

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Get completed matches from last 24 hours
  const completed = db.prepare(
    "SELECT * FROM cached_fixtures WHERE status = 'FT' AND date >= ? ORDER BY date DESC"
  ).all(cutoff.toISOString());

  // Get awaiting/in-progress matches (started but no result yet)
  const awaiting = db.prepare(
    "SELECT * FROM cached_fixtures WHERE status = 'AWAITING' ORDER BY date DESC"
  ).all();

  // Combine and sort by date descending
  const combined = [...completed, ...awaiting].sort((a, b) => new Date(b.date) - new Date(a.date));

  res.json(combined);
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

  const sweep = db.prepare('SELECT id FROM sweepstakes WHERE public_id = ?').get(req.params.ref);

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

  const participants = sweep
    ? db.prepare('SELECT id, name, team_id, team_name FROM participants WHERE sweepstake_id = ?').all(sweep.id)
    : [];

  res.json({
    fixture,
    homeTeam,
    awayTeam,
    events,
    lineups: { home: homeLineup, away: awayLineup },
    participants,
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
        COALESCE(SUM(CASE WHEN json_extract(me.additional_info, '$.card') = 'YELLOW' THEN 1 ELSE 0 END), 0) as yellow,
        COALESCE(SUM(CASE WHEN json_extract(me.additional_info, '$.card') IN ('RED', 'SECOND_YELLOW') THEN 1 ELSE 0 END), 0) as red,
        COALESCE(COUNT(me.id), 0) as total
      FROM cached_teams t
      LEFT JOIN match_events me ON t.id = me.team_id AND me.type = 'BOOKING'
      GROUP BY t.id
      ORDER BY total DESC, t.name ASC
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
      FROM cached_teams t
      LEFT JOIN cached_standings s ON t.id = s.team_id
      ORDER BY gf DESC, t.name ASC
    `).all();
    return res.json(data);
  }

  if (type === 'scorers') {
    const data = db.prepare(`
      SELECT cs.player_name, cs.team_id, t.name as team_name, t.logo_url, cs.goals
      FROM cached_top_scorers cs
      JOIN cached_teams t ON t.id = cs.team_id
      ORDER BY cs.goals DESC, cs.player_name ASC
    `).all();
    return res.json(data);
  }

  if (type === 'records') {
    const minuteExpr = `CAST(me.minute AS INTEGER) + CASE WHEN INSTR(me.minute, '+') > 0 THEN CAST(SUBSTR(me.minute, INSTR(me.minute, '+') + 1) AS INTEGER) ELSE 0 END`;

    // Earliest and latest goals
    const earliestGoal = db.prepare(`
      SELECT t.id as team_id, t.name, t.logo_url, MIN(${minuteExpr}) as minute
      FROM match_events me
      JOIN cached_fixtures f ON me.match_id = f.id
      JOIN cached_teams t ON me.team_id = t.id
      WHERE me.type = 'GOAL'
      GROUP BY me.id
      ORDER BY minute ASC
      LIMIT 1
    `).get();

    const latestGoal = db.prepare(`
      SELECT t.id as team_id, t.name, t.logo_url, MAX(${minuteExpr}) as minute
      FROM match_events me
      JOIN cached_fixtures f ON me.match_id = f.id
      JOIN cached_teams t ON me.team_id = t.id
      WHERE me.type = 'GOAL'
      GROUP BY me.id
      ORDER BY minute DESC
      LIMIT 1
    `).get();

    // Earliest and latest yellow cards
    const earliestYellow = db.prepare(`
      SELECT t.id as team_id, t.name, t.logo_url, MIN(${minuteExpr}) as minute
      FROM match_events me
      JOIN cached_fixtures f ON me.match_id = f.id
      JOIN cached_teams t ON me.team_id = t.id
      WHERE me.type = 'BOOKING' AND json_extract(me.additional_info, '$.card') = 'YELLOW'
      GROUP BY me.id
      ORDER BY minute ASC
      LIMIT 1
    `).get();

    const latestYellow = db.prepare(`
      SELECT t.id as team_id, t.name, t.logo_url, MAX(${minuteExpr}) as minute
      FROM match_events me
      JOIN cached_fixtures f ON me.match_id = f.id
      JOIN cached_teams t ON me.team_id = t.id
      WHERE me.type = 'BOOKING' AND json_extract(me.additional_info, '$.card') = 'YELLOW'
      GROUP BY me.id
      ORDER BY minute DESC
      LIMIT 1
    `).get();

    // Earliest and latest red cards
    const earliestRed = db.prepare(`
      SELECT t.id as team_id, t.name, t.logo_url, MIN(${minuteExpr}) as minute
      FROM match_events me
      JOIN cached_fixtures f ON me.match_id = f.id
      JOIN cached_teams t ON me.team_id = t.id
      WHERE me.type = 'BOOKING' AND json_extract(me.additional_info, '$.card') IN ('RED', 'SECOND_YELLOW')
      GROUP BY me.id
      ORDER BY minute ASC
      LIMIT 1
    `).get();

    const latestRed = db.prepare(`
      SELECT t.id as team_id, t.name, t.logo_url, MAX(${minuteExpr}) as minute
      FROM match_events me
      JOIN cached_fixtures f ON me.match_id = f.id
      JOIN cached_teams t ON me.team_id = t.id
      WHERE me.type = 'BOOKING' AND json_extract(me.additional_info, '$.card') IN ('RED', 'SECOND_YELLOW')
      GROUP BY me.id
      ORDER BY minute DESC
      LIMIT 1
    `).get();

    // Most goals in first half (minute <= 45)
    const mostGoalsFirstHalf = db.prepare(`
      SELECT t.id as team_id, t.name, t.logo_url, COUNT(*) as goals
      FROM match_events me
      JOIN cached_teams t ON me.team_id = t.id
      WHERE me.type = 'GOAL' AND ${minuteExpr} <= 45
      GROUP BY me.team_id
      ORDER BY goals DESC, t.name ASC
      LIMIT 1
    `).get();

    // Most goals in second half (minute > 45)
    const mostGoalsSecondHalf = db.prepare(`
      SELECT t.id as team_id, t.name, t.logo_url, COUNT(*) as goals
      FROM match_events me
      JOIN cached_teams t ON me.team_id = t.id
      WHERE me.type = 'GOAL' AND ${minuteExpr} > 45
      GROUP BY me.team_id
      ORDER BY goals DESC, t.name ASC
      LIMIT 1
    `).get();

    // Most goals by a team in a single match
    const mostGoalsSingleGame = db.prepare(`
      SELECT t.id as team_id, t.name, t.logo_url, MAX(goals) as goals
      FROM (
        SELECT f.home_team_id as team_id, f.home_score as goals FROM cached_fixtures f WHERE f.status = 'FT' AND f.home_score IS NOT NULL
        UNION ALL
        SELECT f.away_team_id as team_id, f.away_score as goals FROM cached_fixtures f WHERE f.status = 'FT' AND f.away_score IS NOT NULL
      ) team_scores
      JOIN cached_teams t ON t.id = team_scores.team_id
      GROUP BY t.id
      ORDER BY goals DESC, t.name ASC
      LIMIT 1
    `).get();

    // Most goals by a player in a single match
    const mostPlayerGoalsSingleGame = db.prepare(`
      SELECT me.player_name, me.team_id, t.name as team_name, t.logo_url, COUNT(*) as goals
      FROM match_events me
      JOIN cached_teams t ON me.team_id = t.id
      WHERE me.type = 'GOAL' AND me.player_name IS NOT NULL
      GROUP BY me.match_id, me.player_name
      ORDER BY goals DESC, me.player_name ASC
      LIMIT 1
    `).get();

    // Most goals by a player in the first half (across all matches)
    const mostPlayerGoalsFirstHalf = db.prepare(`
      SELECT me.player_name, me.team_id, t.name as team_name, t.logo_url, COUNT(*) as goals
      FROM match_events me
      JOIN cached_teams t ON me.team_id = t.id
      WHERE me.type = 'GOAL' AND me.player_name IS NOT NULL AND ${minuteExpr} <= 45
      GROUP BY me.player_name, me.team_id
      ORDER BY goals DESC, me.player_name ASC
      LIMIT 1
    `).get();

    // Most goals by a player in the second half (across all matches)
    const mostPlayerGoalsSecondHalf = db.prepare(`
      SELECT me.player_name, me.team_id, t.name as team_name, t.logo_url, COUNT(*) as goals
      FROM match_events me
      JOIN cached_teams t ON me.team_id = t.id
      WHERE me.type = 'GOAL' AND me.player_name IS NOT NULL AND ${minuteExpr} > 45
      GROUP BY me.player_name, me.team_id
      ORDER BY goals DESC, me.player_name ASC
      LIMIT 1
    `).get();

    // Most clean sheets
    const mostCleanSheets = db.prepare(`
      SELECT t.id as team_id, t.name, t.logo_url, COUNT(*) as goals
      FROM cached_fixtures f
      JOIN cached_teams t ON (f.home_team_id = t.id OR f.away_team_id = t.id)
      WHERE f.status = 'FT'
        AND ((f.home_team_id = t.id AND f.away_score = 0) OR (f.away_team_id = t.id AND f.home_score = 0))
      GROUP BY t.id
      ORDER BY goals DESC, t.name ASC
      LIMIT 1
    `).get();

    return res.json({
      earliestGoal,
      latestGoal,
      earliestYellow,
      latestYellow,
      earliestRed,
      latestRed,
      mostGoalsFirstHalf,
      mostGoalsSecondHalf,
      mostGoalsSingleGame,
      mostPlayerGoalsSingleGame,
      mostPlayerGoalsFirstHalf,
      mostPlayerGoalsSecondHalf,
      mostCleanSheets,
    });
  }

  // Default: standings
  const standings = db.prepare(
    'SELECT * FROM cached_standings ORDER BY group_letter, rank'
  ).all();
  res.json(standings);
});

export default router;
