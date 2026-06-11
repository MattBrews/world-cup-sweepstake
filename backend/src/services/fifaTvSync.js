import fetch from 'node-fetch';
import { getDb } from '../db/connection.js';

const SEASON_ID = '285023';
const COUNTRY = 'GBR';

const TEAM_NAME_MAP = {
  'South Korea': 'Korea Republic',
  'Czech Republic': 'Czechia',
  'Bosnia & Herzegovina': 'Bosnia and Herzegovina',
  'Turkey': 'Türkiye',
  'Ivory Coast': `Côte d'Ivoire`,
  'Iran': 'IR Iran',
  'Cape Verde': 'Cabo Verde',
  'DR Congo': 'Congo DR',
  'USA': 'USA',
};

function fifaName(ourName) {
  return TEAM_NAME_MAP[ourName] || ourName;
}

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function namesMatch(our, fifa) {
  if (!our || !fifa) return false;
  return normalize(fifaName(our)) === normalize(fifa) ||
         normalize(our) === normalize(fifa);
}

export async function syncTvChannels() {
  const db = getDb();

  // Ensure column exists (idempotent migration)
  try {
    db.exec("ALTER TABLE cached_fixtures ADD COLUMN tv_channel TEXT");
  } catch {
    // column already exists
  }

  // 1. Fetch FIFA calendar (team names per match)
  const calRes = await fetch(
    `https://api.fifa.com/api/v3/calendar/matches?idSeason=${SEASON_ID}&count=500&language=en`
  );
  if (!calRes.ok) throw new Error(`FIFA calendar fetch error ${calRes.status}`);
  const calendar = await calRes.json();

  const matchTeams = {};
  for (const m of calendar.Results || []) {
    const home = m.Home?.TeamName?.[0]?.Description;
    const away = m.Away?.TeamName?.[0]?.Description;
    if (home && away) {
      matchTeams[m.IdMatch] = {
        homeTeam: home,
        awayTeam: away,
        date: m.Date,
      };
    }
  }

  // 2. Fetch FIFA watch data (TV channels by country)
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

  // 3. Build team name -> our fixtures lookup
  const allFixtures = db.prepare(
    'SELECT f.id, f.date, t1.name as home_name, t2.name as away_name FROM cached_fixtures f LEFT JOIN cached_teams t1 ON t1.id = f.home_team_id LEFT JOIN cached_teams t2 ON t2.id = f.away_team_id'
  ).all();

  const update = db.prepare('UPDATE cached_fixtures SET tv_channel = ? WHERE id = ?');
  let updated = 0;

  for (const fixture of allFixtures) {
    if (!fixture.home_name || !fixture.away_name) continue;

    for (const [matchId, info] of Object.entries(matchTeams)) {
      const channel = matchChannels[matchId];
      if (!channel) continue;

      if (namesMatch(fixture.home_name, info.homeTeam) &&
          namesMatch(fixture.away_name, info.awayTeam)) {
        update.run(channel, fixture.id);
        updated++;
        break;
      }
    }
  }

  if (updated > 0) {
    console.log(`[fifaTvSync] Updated ${updated} fixtures with TV channels`);
  }
  return { channelsUpdated: updated };
}
