import { getDb } from '../db/connection.js';
import { OpenFootballProvider } from './providers/openFootballProvider.js';
import { UpboundWebProvider } from './providers/upboundWebProvider.js';
import { FifaCalendarProvider } from './providers/fifaCalendarProvider.js';
import { FifaTvProvider } from './providers/fifaTvProvider.js';
import { FifaLiveProvider } from './providers/fifaLiveProvider.js';
import { recalculateStandings } from './standingsCalculator.js';

const openFootball = new OpenFootballProvider();
const upboundWeb = new UpboundWebProvider();
const fifaCalendar = new FifaCalendarProvider();
const fifaTv = new FifaTvProvider();
const fifaLive = new FifaLiveProvider();

function logSync(endpoint, status, detail = '') {
  const db = getDb();
  db.prepare(
    'INSERT INTO sync_log (endpoint, status, request_count) VALUES (?, ?, ?)'
  ).run(endpoint, `${status}${detail ? ': ' + detail : ''}`, 1);
}

export async function syncLive() {
  const result = {};

  try {
    const db = getDb();
    const now = new Date();
    const { changes } = db.prepare(
      "UPDATE cached_fixtures SET lifecycle_state = 'AWAITING' WHERE lifecycle_state = 'SCHEDULED' AND date < ?"
    ).run(now.toISOString());
    if (changes > 0) {
      result.awaiting = changes;
      logSync('awaiting-marker', 'info', `${changes} matches marked awaiting`);
    }
  } catch (err) {
    logSync('awaiting-marker', 'error', err.message);
  }

  try {
    const live = await fifaLive.syncLiveMatches();
    result.liveUpdated = live.updated;
    if (live.updated > 0) {
      logSync('fifaLive', 'success', `${live.updated} live matches updated`);
      const standingsCount = recalculateStandings();
      result.standings = standingsCount;
    }
  } catch (err) {
    logSync('fifaLive', 'error', err.message);
  }

  try {
    const details = await fifaLive.syncMatchDetails();
    result.matchDetails = details.matchesUpdated;
    if (details.matchesUpdated > 0) {
      logSync('fifaMatchDetails', 'success', `${details.matchesUpdated} matches, ${details.events} events`);
      const standingsCount = recalculateStandings();
      result.standings = standingsCount;
    }
  } catch (err) {
    logSync('fifaMatchDetails', 'error', err.message);
  }

  const db = getDb();
  const lifecycleCounts = db.prepare(`
    SELECT lifecycle_state, COUNT(*) as count
    FROM cached_fixtures
    GROUP BY lifecycle_state
  `).all();
  result.lifecycle = {};
  for (const row of lifecycleCounts) {
    result.lifecycle[row.lifecycle_state] = row.count;
  }

  return result;
}

export async function syncAll() {
  const result = {};

  try {
    const football = await openFootball.syncFixtures();
    result.teams = football.teams;
    result.fixtures = football.fixtures;
    logSync('openfootball', 'success');
  } catch (err) {
    logSync('openfootball', 'error', err.message);
    result.error = err.message;
  }

  try {
    const upbound = await upboundWeb.syncScores();
    result.upboundScores = upbound.updated;
    logSync('upbound-web', 'success', `${upbound.updated} scores updated`);

    if (upbound.updated > 0) {
      const standingsCount = recalculateStandings();
      result.standings = standingsCount;
      logSync('standings', 'recalculated', `${standingsCount} entries`);
    }
  } catch (err) {
    logSync('upbound-web', 'error', err.message);
  }

  try {
    const db = getDb();
    const now = new Date();
    const { changes } = db.prepare(
      "UPDATE cached_fixtures SET lifecycle_state = 'AWAITING' WHERE lifecycle_state = 'SCHEDULED' AND date < ?"
    ).run(now.toISOString());
    if (changes > 0) {
      result.awaiting = changes;
      logSync('awaiting-marker', 'info', `${changes} matches marked awaiting`);
    }
  } catch (err) {
    logSync('awaiting-marker', 'error', err.message);
  }

  try {
    const cal = await fifaCalendar.syncApiMatchIds();
    result.apiMatchIds = cal.apiMatchIdsSynced;
    logSync('fifaCalendar', 'success', `${cal.apiMatchIdsSynced} IDs synced`);
  } catch (err) {
    logSync('fifaCalendar', 'error', err.message);
  }

  try {
    const tv = await fifaTv.syncTvChannels();
    result.tvChannels = tv.channelsUpdated;
    logSync('fifaTvSync', 'success', `${tv.channelsUpdated} channels`);
  } catch (err) {
    logSync('fifaTvSync', 'error', err.message);
  }

  const liveResult = await syncLive();
  Object.assign(result, liveResult);

  return result;
}

export async function fullRefresh() {
  const db = getDb();
  db.prepare(
    "UPDATE cached_fixtures SET lifecycle_state = 'AWAITING' WHERE lifecycle_state = 'COMPLETE'"
  ).run();

  return syncAll();
}

export function getSyncStatus() {
  const db = getDb();
  const lifecycleCounts = db.prepare(`
    SELECT lifecycle_state, COUNT(*) as count
    FROM cached_fixtures
    GROUP BY lifecycle_state
  `).all();

  const result = {};
  for (const row of lifecycleCounts) {
    result[row.lifecycle_state] = row.count;
  }
  return result;
}
