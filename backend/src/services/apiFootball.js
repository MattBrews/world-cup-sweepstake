// Deprecated — replaced by openFootball.js (openfootball/worldcup.json)
// Kept to avoid breaking imports during transition. Will remove after verifying stability.

import { getDb } from '../db/connection.js';

export function setApiKey(key) {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('api_football_key', key);
}

export function hasApiKey() {
  return false;
}
