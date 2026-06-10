import { Router } from 'express';
import bcrypt from 'bcrypt';
import { getDb } from '../db/connection.js';
import { config } from '../config.js';

const router = Router();

router.post('/login', (req, res) => {
  const { password, slug } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  if (config.masterPassword && password === config.masterPassword) {
    req.session.admin = 'master';
    req.session.slug = null;
    return req.session.save(() => {
      res.json({ role: 'master' });
    });
  }

  if (slug) {
    const db = getDb();
    const sweep = db.prepare('SELECT * FROM sweepstakes WHERE slug = ?').get(slug);
    if (sweep?.admin_password) {
      const match = bcrypt.compareSync(password, sweep.admin_password);
      if (match) {
        req.session.admin = 'sweepstake';
        req.session.slug = slug;
        return req.session.save(() => {
          res.json({ role: 'sweepstake', slug });
        });
      }
    }
  }

  res.status(401).json({ error: 'Invalid password' });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get('/session', (req, res) => {
  if (req.session?.admin) {
    res.json({
      admin: req.session.admin,
      slug: req.session.slug || null,
    });
  } else {
    res.json({ admin: null });
  }
});

export default router;
