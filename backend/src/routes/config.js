import { Router } from 'express';

const router = Router();

router.get('/config', (req, res) => {
  res.json({
    sources: [
      {
        name: 'openfootball/worldcup.json',
        url: 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json',
        description: 'free, no API key required, updated daily',
      },
      {
        name: 'upbound-web/worldcup-live.json',
        url: 'https://raw.githubusercontent.com/upbound-web/worldcup-live.json/master/2026/worldcup.json',
        description: 'fast-updating fork, results within hours of full-time',
      },
    ],
  });
});

export default router;
