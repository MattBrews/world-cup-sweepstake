import { Router } from 'express';
import { getDb } from '../db/connection.js';
import { calculatePoints } from '../services/pointsCalculator.js';

const router = Router();

function lookupSweep(ref) {
  const db = getDb();
  let s = db.prepare('SELECT id, name, slug, public_id, mode FROM sweepstakes WHERE public_id = ?').get(ref);
  if (!s) s = db.prepare('SELECT id, name, slug, public_id, mode FROM sweepstakes WHERE slug = ?').get(ref);
  return s;
}

function resolveParticipant(db, sweepId, token) {
  if (!token) return null;
  return db.prepare(
    'SELECT id, name FROM participants WHERE sweepstake_id = ? AND prediction_token = ?'
  ).get(sweepId, token);
}

router.get('/:ref/predictions', (req, res) => {
  const db = getDb();
  const sweep = lookupSweep(req.params.ref);
  if (!sweep) return res.status(404).json({ error: 'Not found' });

  const participant = resolveParticipant(db, sweep.id, req.query.token);

  const fixtures = db.prepare(
    'SELECT * FROM cached_fixtures ORDER BY date'
  ).all();

  const predictions = participant
    ? db.prepare('SELECT * FROM predictions WHERE participant_id = ?').all(participant.id)
    : [];

  const teams = db.prepare('SELECT * FROM cached_teams ORDER BY name').all();

  res.json({
    sweepstake: { name: sweep.name, public_id: sweep.public_id },
    participant,
    fixtures,
    predictions,
    teams,
  });
});

router.post('/:ref/predictions', (req, res) => {
  const { token, fixture_id, home_score, away_score } = req.body;
  if (!token || !fixture_id || home_score === undefined || away_score === undefined) {
    return res.status(400).json({ error: 'token, fixture_id, home_score, away_score required' });
  }

  const hs = parseInt(home_score, 10);
  const as = parseInt(away_score, 10);
  if (isNaN(hs) || isNaN(as) || hs < 0 || as < 0) {
    return res.status(400).json({ error: 'Scores must be non-negative integers' });
  }

  const db = getDb();
  const sweep = lookupSweep(req.params.ref);
  if (!sweep) return res.status(404).json({ error: 'Not found' });

  const participant = resolveParticipant(db, sweep.id, token);
  if (!participant) return res.status(401).json({ error: 'Invalid token' });

  const fixture = db.prepare(
    "SELECT * FROM cached_fixtures WHERE id = ? AND status = 'SCHEDULED'"
  ).get(fixture_id);
  if (!fixture) return res.status(400).json({ error: 'Fixture not found or match has already started' });

  const existing = db.prepare(
    'SELECT id FROM predictions WHERE fixture_id = ? AND participant_id = ?'
  ).get(fixture_id, participant.id);

  if (existing) {
    db.prepare(
      'UPDATE predictions SET home_score = ?, away_score = ?, updated_at = datetime(\'now\') WHERE fixture_id = ? AND participant_id = ?'
    ).run(hs, as, fixture_id, participant.id);
    res.json({ id: existing.id, fixture_id, home_score: hs, away_score: as, updated: true });
  } else {
    const result = db.prepare(
      'INSERT INTO predictions (fixture_id, participant_id, home_score, away_score) VALUES (?, ?, ?, ?)'
    ).run(fixture_id, participant.id, hs, as);
    res.status(201).json({ id: result.lastInsertRowid, fixture_id, home_score: hs, away_score: as });
  }
});

router.get('/:ref/predictions/leaderboard', (req, res) => {
  const db = getDb();
  const sweep = lookupSweep(req.params.ref);
  if (!sweep) return res.status(404).json({ error: 'Not found' });

  const leaderboard = db.prepare(`
    SELECT p.id, p.name,
      COALESCE(SUM(pr.points), 0) as total_points,
      COUNT(pr.id) as matches_played,
      COUNT(CASE WHEN pr.points IS NOT NULL THEN 1 END) as matches_scored
    FROM participants p
    LEFT JOIN predictions pr ON pr.participant_id = p.id
    WHERE p.sweepstake_id = ?
    GROUP BY p.id
    ORDER BY total_points DESC
  `).all(sweep.id);

  res.json(leaderboard);
});

router.get('/:ref/predictions/overview', (req, res) => {
  const db = getDb();
  const sweep = lookupSweep(req.params.ref);
  if (!sweep) return res.status(404).json({ error: 'Not found' });

  const participants = db.prepare(
    'SELECT id, name FROM participants WHERE sweepstake_id = ? ORDER BY name'
  ).all(sweep.id);

  const rows = db.prepare(`
    SELECT
      f.id as fixture_id, f.home_team_id, f.away_team_id,
      f.home_placeholder, f.away_placeholder,
      f.home_score, f.away_score, f.date, f.status, f.stage,
      f.tv_channel, f.venue,
      ht.name as home_team_name, ht.logo_url as home_logo,
      at.name as away_team_name, at.logo_url as away_logo,
      ht.group_letter as home_group_letter,
      pp.id as participant_id, pp.name as participant_name,
      pr.home_score as predicted_home, pr.away_score as predicted_away
    FROM cached_fixtures f
    LEFT JOIN cached_teams ht ON ht.id = f.home_team_id
    LEFT JOIN cached_teams at ON at.id = f.away_team_id
    CROSS JOIN participants pp
    LEFT JOIN predictions pr ON pr.fixture_id = f.id AND pr.participant_id = pp.id
    WHERE pp.sweepstake_id = ?
    ORDER BY f.date, pp.name
  `).all(sweep.id);

  const fixtures = {};
  for (const r of rows) {
    if (!fixtures[r.fixture_id]) {
      fixtures[r.fixture_id] = {
        id: r.fixture_id,
        home_team_id: r.home_team_id, away_team_id: r.away_team_id,
        home_team_name: r.home_team_name, away_team_name: r.away_team_name,
        home_placeholder: r.home_placeholder, away_placeholder: r.away_placeholder,
        home_logo: r.home_logo, away_logo: r.away_logo,
        home_score: r.home_score, away_score: r.away_score,
        date: r.date, status: r.status, stage: r.stage,
        tv_channel: r.tv_channel, venue: r.venue,
        group_letter: r.home_group_letter,
        participant_predictions: [],
      };
    }
    fixtures[r.fixture_id].participant_predictions.push({
      participant_id: r.participant_id,
      participant_name: r.participant_name,
      predicted_home: r.predicted_home,
      predicted_away: r.predicted_away,
    });
  }

  res.json({
    participants,
    fixtures: Object.values(fixtures).sort((a, b) => new Date(a.date) - new Date(b.date)),
  });
});

export default router;
