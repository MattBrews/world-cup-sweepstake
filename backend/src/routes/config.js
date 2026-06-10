import { Router } from 'express';
import { setApiKey, hasApiKey } from '../services/apiFootball.js';
import { syncAll } from '../services/syncService.js';
import { requireMasterAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/config', (req, res) => {
  res.json({ hasApiKey: hasApiKey() });
});

router.post('/config/api-key', requireMasterAdmin, async (req, res) => {
  const { key } = req.body;
  if (!key) {
    return res.status(400).json({ error: 'API key required' });
  }

  setApiKey(key);

  try {
    const results = await syncAll();
    res.json({ ok: true, results });
  } catch (err) {
    res.json({ ok: true, warning: 'Key saved but sync failed: ' + err.message });
  }
});

export default router;
