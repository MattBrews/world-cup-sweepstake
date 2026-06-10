import { Router } from 'express';

const router = Router();

router.get('/config', (req, res) => {
  res.json({ dataSource: 'openfootball' });
});

export default router;
