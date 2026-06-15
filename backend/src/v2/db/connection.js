import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { config } from '../../config.js';

let v2Db;

export function getV2Db() {
  if (!v2Db) {
    const dbDir = config.dataDir;
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    v2Db = new Database(path.join(dbDir, 'sweepstakes_v2.db'));
    v2Db.pragma('journal_mode = WAL');
    v2Db.pragma('foreign_keys = ON');
  }
  return v2Db;
}
