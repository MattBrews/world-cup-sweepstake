import fetch from 'node-fetch';
import { getDb } from '../db/connection.js';

const SEASON_ID = '285023';

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

export async function fetchCalendar() {
  const calRes = await fetch(
    `https://api.fifa.com/api/v3/calendar/matches?idSeason=${SEASON_ID}&count=500&language=en`
  );
  if (!calRes.ok) throw new Error(`FIFA calendar fetch error ${calRes.status}`);
  const calendar = await calRes.json();
  return calendar.Results || [];
}

export function matchTeamsFromCalendar(results) {
  const matchTeams = {};
  for (const m of results) {
    const home = m.Home?.TeamName?.[0]?.Description;
    const away = m.Away?.TeamName?.[0]?.Description;
    if (home && away) {
      matchTeams[m.IdMatch] = { homeTeam: home, awayTeam: away, date: m.Date };
    }
  }
  return matchTeams;
}

export async function syncApiMatchIds() {
  const db = getDb();
  const results = await fetchCalendar();
  const matchTeams = matchTeamsFromCalendar(results);

  // Build FIFA team ID → local team ID mapping
  db.prepare('DELETE FROM cached_team_mappings').run();
  const mapInsert = db.prepare(
    'INSERT OR IGNORE INTO cached_team_mappings (fifa_team_id, local_team_id) VALUES (?, ?)'
  );
  for (const m of results) {
    const homeFifaId = m.Home?.IdTeam ? parseInt(m.Home.IdTeam) : null;
    const awayFifaId = m.Away?.IdTeam ? parseInt(m.Away.IdTeam) : null;
    const homeName = m.Home?.TeamName?.[0]?.Description;
    const awayName = m.Away?.TeamName?.[0]?.Description;

    if (homeFifaId && homeName) {
      const local = db.prepare('SELECT id FROM cached_teams WHERE name = ?').get(ourName(homeName));
      if (!local) {
        const local2 = db.prepare('SELECT id FROM cached_teams WHERE name = ?').get(homeName);
        if (local2) mapInsert.run(homeFifaId, local2.id);
      } else {
        mapInsert.run(homeFifaId, local.id);
      }
    }
    if (awayFifaId && awayName) {
      const local = db.prepare('SELECT id FROM cached_teams WHERE name = ?').get(ourName(awayName));
      if (!local) {
        const local2 = db.prepare('SELECT id FROM cached_teams WHERE name = ?').get(awayName);
        if (local2) mapInsert.run(awayFifaId, local2.id);
      } else {
        mapInsert.run(awayFifaId, local.id);
      }
    }
  }

  const allFixtures = db.prepare(
    `SELECT f.id, f.date, t1.name as home_name, t2.name as away_name
     FROM cached_fixtures f
     LEFT JOIN cached_teams t1 ON t1.id = f.home_team_id
     LEFT JOIN cached_teams t2 ON t2.id = f.away_team_id
     WHERE f.api_match_id IS NULL`
  ).all();

  const update = db.prepare('UPDATE cached_fixtures SET api_match_id = ? WHERE id = ?');
  let updated = 0;

  for (const fixture of allFixtures) {
    if (!fixture.home_name || !fixture.away_name) continue;

    for (const [matchId, info] of Object.entries(matchTeams)) {
      if (namesMatch(fixture.home_name, info.homeTeam) &&
          namesMatch(fixture.away_name, info.awayTeam)) {
        update.run(matchId, fixture.id);
        updated++;
        break;
      }
    }
  }

  return { apiMatchIdsSynced: updated, totalInCalendar: Object.keys(matchTeams).length };
}

export { TEAM_NAME_MAP, fifaName, namesMatch };

// Reverse map: FIFA name → our name
const REVERSE_NAME_MAP = Object.fromEntries(
  Object.entries(TEAM_NAME_MAP).map(([our, fifa]) => [fifa, our])
);

function ourName(fifaName) {
  return REVERSE_NAME_MAP[fifaName] || fifaName;
}
