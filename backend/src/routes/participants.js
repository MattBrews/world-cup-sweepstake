import { Router } from 'express';
import { getDb } from '../db/connection.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

function canManageSlug(req, slug) {
  if (req.session?.admin === 'master') return true;
  if (req.session?.admin === 'sweepstake' && req.session?.slug === slug) return true;
  return false;
}

router.get('/:slug/participants', (req, res) => {
  const db = getDb();
  const sweep = db.prepare('SELECT id FROM sweepstakes WHERE slug = ?').get(req.params.slug);
  if (!sweep) return res.status(404).json({ error: 'Not found' });
  const list = db.prepare(
    'SELECT id, name, team_id, team_name FROM participants WHERE sweepstake_id = ? ORDER BY name'
  ).all(sweep.id);
  res.json(list);
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
  const sweep = db.prepare('SELECT id FROM sweepstakes WHERE slug = ?').get(req.params.slug);
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
  const sweep = db.prepare('SELECT id FROM sweepstakes WHERE slug = ?').get(req.params.slug);
  if (!sweep) return res.status(404).json({ error: 'Not found' });

  db.prepare(
    'DELETE FROM participants WHERE id = ? AND sweepstake_id = ?'
  ).run(req.params.id, sweep.id);

  res.json({ ok: true });
});

export default router;
