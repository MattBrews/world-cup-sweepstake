import { getDb } from '../db/connection.js';
import { fetchAndSync } from './openFootball.js';
import { fetchAndUpdateScores } from './upboundWeb.js';
import { syncApiMatchIds } from './fifaCalendar.js';
import { syncTvChannels } from './fifaTvSync.js';
import { syncMatchDetails } from './fifaMatchDetails.js';

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
    const upbound = await fetchAndUpdateScores();
    result.upboundScores = upbound.updated;
    logSync('upbound-web', 'success', `${upbound.updated} scores updated`);
  } catch (err) {
    logSync('upbound-web', 'error', err.message);
  }

  try {
    const db = getDb();
    const now = new Date();
    const { changes } = db.prepare(
      "UPDATE cached_fixtures SET status = 'AWAITING' WHERE status = 'SCHEDULED' AND date < ?"
    ).run(now.toISOString());
    if (changes > 0) {
      result.awaiting = changes;
      logSync('awaiting-marker', 'info', `${changes} matches marked awaiting`);
    }
  } catch (err) {
    logSync('awaiting-marker', 'error', err.message);
  }

  try {
    const cal = await syncApiMatchIds();
    result.apiMatchIds = cal.apiMatchIdsSynced;
    logSync('fifaCalendar', 'success', `${cal.apiMatchIdsSynced} IDs synced`);
  } catch (err) {
    logSync('fifaCalendar', 'error', err.message);
  }

  try {
    const tv = await syncTvChannels();
    result.tvChannels = tv.channelsUpdated;
    logSync('fifaTvSync', 'success', `${tv.channelsUpdated} channels`);
  } catch (err) {
    logSync('fifaTvSync', 'error', err.message);
  }

  try {
    const details = await syncMatchDetails();
    result.matchDetails = details.matchesUpdated;
    logSync('fifaMatchDetails', 'success', `${details.matchesUpdated} matches, ${details.events} events`);
  } catch (err) {
    logSync('fifaMatchDetails', 'error', err.message);
  }

  return result;
}
