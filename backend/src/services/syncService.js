import { getDb } from '../db/connection.js';
import { fetchAndSync } from './openFootball.js';

function logSync(status, detail = '') {
  const db = getDb();
  db.prepare(
    'INSERT INTO sync_log (endpoint, status, request_count) VALUES (?, ?, ?)'
  ).run('openfootball', `${status}${detail ? ': ' + detail : ''}`, 1);
}

export async function syncAll() {
  try {
    const result = await fetchAndSync();
    logSync('success');
    return result;
  } catch (err) {
    logSync('error', err.message);
    throw err;
  }
}
