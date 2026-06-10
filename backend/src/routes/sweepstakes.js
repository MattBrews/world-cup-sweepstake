import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/connection.js';
import { requireAdmin, requireMasterAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', (req, res) => {
  const db = getDb();
  const list = db.prepare(
    'SELECT id, name, slug, public_id, created_at FROM sweepstakes ORDER BY created_at DESC'
  ).all();
  res.json(list);
});

router.get('/:ref', (req, res) => {
  const db = getDb();
  const { ref } = req.params;
  let sweep = db.prepare('SELECT id, name, slug, public_id, created_at FROM sweepstakes WHERE public_id = ?').get(ref);
  if (!sweep) sweep = db.prepare('SELECT id, name, slug, public_id, created_at FROM sweepstakes WHERE slug = ?').get(ref);
  if (!sweep) return res.status(404).json({ error: 'Not found' });
  res.json(sweep);
});

router.post('/', requireMasterAdmin, (req, res) => {
  const { name, slug, adminPassword } = req.body;
  if (!name || !slug) {
    return res.status(400).json({ error: 'Name and slug required' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM sweepstakes WHERE slug = ?').get(slug);
  if (existing) {
    return res.status(409).json({ error: 'Slug already taken' });
  }

  const id = uuidv4();
  const publicId = randomBytes(6).toString('hex');
  const adminHash = adminPassword ? bcrypt.hashSync(adminPassword, 10) : null;

  db.prepare(
    'INSERT INTO sweepstakes (id, name, slug, public_id, admin_password) VALUES (?, ?, ?, ?, ?)'
  ).run(id, name, slug, publicId, adminHash);

  res.status(201).json({ id, name, slug, public_id: publicId });
});

router.put('/:slug', requireMasterAdmin, (req, res) => {
  const { name, adminPassword } = req.body;
  const db = getDb();
  const sweep = db.prepare('SELECT id FROM sweepstakes WHERE slug = ?').get(req.params.slug);
  if (!sweep) return res.status(404).json({ error: 'Not found' });

  if (name !== undefined) {
    db.prepare('UPDATE sweepstakes SET name = ? WHERE id = ?').run(name, sweep.id);
  }
  if (adminPassword !== undefined) {
    const hash = adminPassword ? bcrypt.hashSync(adminPassword, 10) : null;
    db.prepare('UPDATE sweepstakes SET admin_password = ? WHERE id = ?').run(hash, sweep.id);
  }

  res.json({ ok: true });
});

router.delete('/:slug', requireMasterAdmin, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM sweepstakes WHERE slug = ?').run(req.params.slug);
  res.json({ ok: true });
});

export default router;
