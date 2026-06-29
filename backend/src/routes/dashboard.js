import { Router } from 'express';
import { getDb } from '../db/connection.js';
import { getBestThirdPlaces } from '../services/standingsCalculator.js';
import { getRecords } from '../services/recordCalculator.js';
import { generateMonthlyReport } from '../services/monthlyReport.js';
import { determineQualificationStatus } from '../services/qualificationEngine.js';

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

  // Qualification status from the simulation engine
  const engineTeams = teams.filter(t => t.group_letter).map(t => ({
    id: t.id,
    group_letter: t.group_letter,
    disciplinary_points: 0,
    fifa_ranking: t.fifa_ranking || 9999,
  }));
  const engineResults = determineQualificationStatus(engineTeams, fixtures);
  const teamStatus = {};
  for (const t of teams) {
    // Knockout check takes priority — a knockout loss eliminates regardless of group status
    const ko = fixtures.filter(f =>
      f.stage && f.stage !== 'Group Stage' && (f.home_team_id === t.id || f.away_team_id === t.id)
    );
    if (ko.length > 0) {
      const ftKo = ko.filter(f => f.status === 'FT');
      if (ftKo.length > 0) {
        const last = ftKo.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        const h = last.home_team_id === t.id;
        const homeScore = last.home_score ?? 0;
        const awayScore = last.away_score ?? 0;
        if (homeScore === awayScore) {
          teamStatus[t.id] = 'PENDING';
        } else {
          teamStatus[t.id] = (h ? homeScore : awayScore) < (h ? awayScore : homeScore)
            ? 'ELIMINATED' : 'QUALIFIED';
        }
        continue;
      }
      // Team has knockout fixtures but none completed yet — fall through to engine
    }

    teamStatus[t.id] = engineResults[t.id] || 'PENDING';
  }

  res.json({
    sweepstake: sweep,
    participants,
    participantTeamIds: [...participantTeamIds],
    standings,
    fixtures,
    teams,
    currentStage,
    teamStatus,
  });
});

function detectCurrentStage(fixtures) {
  const stages = ['Group Stage', 'Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', '3rd Place', 'Final'];
  const now = new Date();

  const unplayed = fixtures
    .filter(f => f.status !== 'FT' && f.status !== 'AWAITING')
    .sort((a, b) => {
      if (a.status === 'IN_PROGRESS' && b.status !== 'IN_PROGRESS') return -1;
      if (a.status !== 'IN_PROGRESS' && b.status === 'IN_PROGRESS') return 1;
      return new Date(a.date) - new Date(b.date);
    });

  const current = unplayed.find(f => f.status === 'IN_PROGRESS' || new Date(f.date) > now) || unplayed[0];

  if (!current) return stages[stages.length - 1];

  return current.stage || 'Group Stage';
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

router.get('/:ref/advancement', (req, res) => {
  const db = getDb();
  const sweep = lookupSweep(req.params.ref);
  if (!sweep) return res.status(404).json({ error: 'Not found' });

  const standings = db.prepare(
    'SELECT * FROM cached_standings ORDER BY group_letter, rank'
  ).all();

  const autoQualifiers = standings.filter(s => s.rank <= 2);
  const thirdPlaces = getBestThirdPlaces();
  const qualified = [...autoQualifiers, ...thirdPlaces.filter(t => t.advances)];

  res.json({
    autoQualifiers,
    thirdPlaces,
    totalQualified: qualified.length,
    totalSpots: 32,
  });
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
    return res.json(getRecords());
  }

  // Default: standings
  const standings = db.prepare(
    'SELECT * FROM cached_standings ORDER BY group_letter, rank'
  ).all();
  res.json(standings);
});

router.get('/:ref/report', (req, res) => {
  const report = generateMonthlyReport(req.params.ref);
  if (!report) return res.status(404).json({ error: 'Not found' });
  res.json(report);
});

export default router;
