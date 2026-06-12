import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cron from 'node-cron';
import { config } from './config.js';
import { getDb } from './db/connection.js';
import { runMigrations } from './db/schema.js';
import { syncAll, fullRefresh, getSyncStatus } from './services/syncEngine.js';

import authRoutes from './routes/auth.js';
import sweepstakesRoutes from './routes/sweepstakes.js';
import participantsRoutes from './routes/participants.js';
import dashboardRoutes from './routes/dashboard.js';
import configRoutes from './routes/config.js';

const app = express();

app.use(express.json());

app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

runMigrations();

app.use('/api/auth', authRoutes);
app.use('/api/sweepstakes', sweepstakesRoutes);
app.use('/api/sweepstakes', participantsRoutes);
app.use('/api/sweepstakes', dashboardRoutes);
app.use('/api', configRoutes);

app.post('/api/sync', async (req, res) => {
  try {
    const results = await syncAll();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sync/full', async (req, res) => {
  try {
    const results = await fullRefresh();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sync/status', (req, res) => {
  try {
    const status = getSyncStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
app.use(express.static(frontendDir));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendDir, 'index.html'));
  }
});

const dbPath = path.join(config.dataDir, 'sweepstakes.db');
console.log(`Database: ${dbPath}`);
console.log(`Sync interval: every ${config.syncIntervalMinutes} minutes`);

const intervalMin = config.syncIntervalMinutes;
const cronExpr = intervalMin < 60 ? `*/${intervalMin} * * * *` : `0 */${Math.round(intervalMin / 60)} * * *`;
cron.schedule(cronExpr, async () => {
  console.log('[sync] Starting scheduled sync...');
  try {
    const results = await syncAll();
    console.log(`[sync] Complete: ${results.teams} teams, ${results.fixtures} fixtures, ${results.standings} standings`);
  } catch (err) {
    console.error('[sync] Error:', err.message);
  }
});

syncAll()
  .then(r => console.log(`[init] Initial sync: ${r.teams} teams, ${r.fixtures} fixtures`))
  .catch(e => console.error('[init] Sync error:', e.message));

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
