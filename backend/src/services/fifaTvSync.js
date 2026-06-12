import fetch from 'node-fetch';
import { getDb } from '../db/connection.js';

const SEASON_ID = '285023';
const COUNTRY = 'GBR';

export async function syncTvChannels() {
  const db = getDb();

  // 1. Fetch FIFA watch data (TV channels by country)
  const watchRes = await fetch(
    `https://api.fifa.com/api/v3/watch/season/${SEASON_ID}`
  );
  if (!watchRes.ok) throw new Error(`FIFA watch fetch error ${watchRes.status}`);
  const watch = await watchRes.json();

  const gbr = (watch.Results || []).find(r => r.IdCountry === COUNTRY);
  if (!gbr) {
    console.log(`[fifaTvSync] No data for country ${COUNTRY}`);
    return { channelsUpdated: 0 };
  }

  // Build match ID -> channel map (pick the main broadcast channel)
  const matchChannels = {};
  for (const m of gbr.Matches || []) {
    const sources = (m.Sources || []).map(s => s.Name).filter(Boolean);
    const main = sources.find(s => /BBC\s+(1|2)|ITV[1]?|ITV4/.test(s)) || sources[0];
    if (main) {
      matchChannels[m.IdMatch] = main;
    }
  }

  // 2. Match by api_match_id
  const fixtures = db.prepare(
    'SELECT id, api_match_id FROM cached_fixtures WHERE api_match_id IS NOT NULL'
  ).all();

  const update = db.prepare('UPDATE cached_fixtures SET tv_channel = ? WHERE id = ?');
  let updated = 0;

  for (const fixture of fixtures) {
    const channel = matchChannels[fixture.api_match_id];
    if (channel) {
      update.run(channel, fixture.id);
      updated++;
    }
  }

  if (updated > 0) {
    console.log(`[fifaTvSync] Updated ${updated} fixtures with TV channels`);
  }
  return { channelsUpdated: updated };
}
