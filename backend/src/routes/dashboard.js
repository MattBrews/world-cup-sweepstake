import { Router } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

router.get('/:slug/dashboard', (req, res) => {
  const db = getDb();

  const sweep = db.prepare('SELECT id, name, slug FROM sweepstakes WHERE slug = ?')
    .get(req.params.slug);
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
  const now = new Date();

  const stages = ['Group Stage', 'Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', '3rd Place', 'Final'];

  const lastUnplayed = fixtures
    .filter(f => f.status !== 'FT' && f.status !== 'AET' && f.status !== 'PEN')
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

  if (!lastUnplayed) return stages[stages.length - 1];

  const round = lastUnplayed.round || '';
  if (round.toLowerCase().includes('group')) return 'Group Stage';
  if (round.toLowerCase().includes('round of 32')) return 'Round of 32';
  if (round.toLowerCase().includes('round of 16')) return 'Round of 16';
  if (round.toLowerCase().includes('quarter')) return 'Quarter-finals';
  if (round.toLowerCase().includes('semi')) return 'Semi-finals';
  if (round.toLowerCase().includes('3rd')) return '3rd Place';
  if (round.toLowerCase().includes('final')) return 'Final';

  return 'Group Stage';
}

router.get('/:slug/fixtures', (req, res) => {
  const db = getDb();
  const { round, stage, status } = req.query;

  const sweep = db.prepare('SELECT id FROM sweepstakes WHERE slug = ?')
    .get(req.params.slug);
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

router.get('/:slug/standings', (req, res) => {
  const db = getDb();
  const sweep = db.prepare('SELECT id FROM sweepstakes WHERE slug = ?')
    .get(req.params.slug);
  if (!sweep) return res.status(404).json({ error: 'Not found' });

  const standings = db.prepare(
    'SELECT * FROM cached_standings ORDER BY group_letter, rank'
  ).all();
  res.json(standings);
});

router.get('/:slug/rounds', (req, res) => {
  const db = getDb();
  const rounds = db.prepare(
    'SELECT DISTINCT round FROM cached_fixtures WHERE round IS NOT NULL AND round != "" ORDER BY date'
  ).all();
  res.json(rounds.map(r => r.round));
});

export default router;
