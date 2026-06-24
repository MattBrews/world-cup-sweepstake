import { Router } from 'express';
import { getDb } from '../db/connection.js';
import { requireAdmin } from '../middleware/auth.js';
import { determineQualificationStatus } from '../services/qualificationEngine.js';

const router = Router();

function lookupSweep(ref) {
  const db = getDb();
  let s = db.prepare('SELECT id, name, slug, public_id FROM sweepstakes WHERE public_id = ?').get(ref);
  if (!s) s = db.prepare('SELECT id, name, slug, public_id FROM sweepstakes WHERE slug = ?').get(ref);
  return s;
}

function canManageSlug(req, slug) {
  if (req.session?.admin === 'master') return true;
  if (req.session?.admin === 'sweepstake' && req.session?.slug === slug) return true;
  return false;
}

function getTeamQualificationStatus(teamId, engineResults, fixtures) {
  const engineStatus = engineResults[teamId];
  if (engineStatus) return engineStatus;

  // Knockout teams
  const ko = fixtures.filter(f =>
    f.stage && f.stage !== 'Group Stage' && (f.home_team_id === teamId || f.away_team_id === teamId)
  );
  if (ko.length > 0) {
    const ftKo = ko.filter(f => f.status === 'FT');
    if (ftKo.length > 0) {
      const last = ftKo.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      const h = last.home_team_id === teamId;
      return (h ? last.home_score : last.away_score) < (h ? last.away_score : last.home_score)
        ? 'ELIMINATED' : 'QUALIFIED';
    }
    return 'QUALIFIED';
  }
  return 'QUALIFIED';
}

router.get('/:ref/participants', (req, res) => {
  const db = getDb();
  const sweep = lookupSweep(req.params.ref);
  if (!sweep) return res.status(404).json({ error: 'Not found' });

  const fixtures = db.prepare('SELECT * FROM cached_fixtures').all();
  const standings = db.prepare('SELECT * FROM cached_standings').all();
  const teams = db.prepare('SELECT * FROM cached_teams ORDER BY name').all();

  const engineTeams = teams.filter(t => t.group_letter).map(t => ({
    id: t.id,
    group_letter: t.group_letter,
    disciplinary_points: 0,
    fifa_ranking: t.fifa_ranking || 9999,
  }));
  const engineResults = determineQualificationStatus(engineTeams, fixtures);

  const list = db.prepare(
    `SELECT p.id, p.name, p.team_id, p.team_name, t.group_letter
     FROM participants p
     LEFT JOIN cached_teams t ON t.id = p.team_id
     WHERE p.sweepstake_id = ?
     ORDER BY p.name`
  ).all(sweep.id);

  const result = list.map(p => ({
    ...p,
    status: getTeamQualificationStatus(p.team_id, engineResults, fixtures),
  }));

  res.json(result);
});

router.post('/:slug/participants', requireAdmin, (req, res) => {
  const { name, teamId, teamName } = req.body;
  if (!name || !teamId || !teamName) {
    return res.status(400).json({ error: 'Name, teamId, and teamName required' });
  }

  if (!canManageSlug(req, req.params.slug)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const db = getDb();
  const sweep = db.prepare('SELECT id, slug FROM sweepstakes WHERE slug = ?').get(req.params.slug);
  if (!sweep) return res.status(404).json({ error: 'Not found' });

  const existing = db.prepare(
    'SELECT id FROM participants WHERE sweepstake_id = ? AND team_id = ?'
  ).get(sweep.id, teamId);
  if (existing) {
    return res.status(409).json({ error: 'Team already assigned in this sweepstake' });
  }

  const result = db.prepare(
    'INSERT INTO participants (sweepstake_id, name, team_id, team_name) VALUES (?, ?, ?, ?)'
  ).run(sweep.id, name, teamId, teamName);

  res.status(201).json({ id: result.lastInsertRowid, name, team_id: teamId, team_name: teamName });
});

router.delete('/:slug/participants/:id', requireAdmin, (req, res) => {
  if (!canManageSlug(req, req.params.slug)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const db = getDb();
  const sweep = db.prepare('SELECT id, slug FROM sweepstakes WHERE slug = ?').get(req.params.slug);
  if (!sweep) return res.status(404).json({ error: 'Not found' });

  db.prepare(
    'DELETE FROM participants WHERE id = ? AND sweepstake_id = ?'
  ).run(req.params.id, sweep.id);

  res.json({ ok: true });
});

export default router;
