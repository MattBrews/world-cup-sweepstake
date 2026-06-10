import { randomBytes } from 'node:crypto';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  apiFootballKey: process.env.API_FOOTBALL_KEY || '',
  masterPassword: process.env.MASTER_PASSWORD || '',
  sessionSecret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
  syncIntervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES || '120', 10),
  dataDir: process.env.DATA_DIR || './.data',
};
