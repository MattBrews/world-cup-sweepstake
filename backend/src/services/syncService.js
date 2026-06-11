import { getDb } from '../db/connection.js';
import { fetchAndSync } from './openFootball.js';
import { syncTvChannels } from './fifaTvSync.js';

function logSync(endpoint, status, detail = '') {
  const db = getDb();
  db.prepare(
    'INSERT INTO sync_log (endpoint, status, request_count) VALUES (?, ?, ?)'
  ).run(endpoint, `${status}${detail ? ': ' + detail : ''}`, 1);
}

export async function syncAll() {
  const result = {};

  try {
    const football = await fetchAndSync();
    Object.assign(result, football);
    logSync('openfootball', 'success');
  } catch (err) {
    logSync('openfootball', 'error', err.message);
    result.error = err.message;
  }

  try {
    const tv = await syncTvChannels();
    result.tvChannels = tv.channelsUpdated;
    logSync('fifaTvSync', 'success', `${tv.channelsUpdated} channels`);
  } catch (err) {
    logSync('fifaTvSync', 'error', err.message);
  }

  return result;
}
