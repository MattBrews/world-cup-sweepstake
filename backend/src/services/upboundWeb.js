import fetch from 'node-fetch';
import { getDb } from '../db/connection.js';

const DATA_URL = 'https://raw.githubusercontent.com/upbound-web/worldcup-live.json/master/2026/worldcup.json';

export async function fetchAndUpdateScores() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`upbound-web fetch error ${res.status}`);
  const data = await res.json();
  const matches = data.matches || [];

  const db = getDb();

  const teams = db.prepare('SELECT id, name FROM cached_teams').all();
  const teamMap = {};
  for (const t of teams) {
    teamMap[t.name] = t.id;
  }

  const fixtures = db.prepare('SELECT id, home_team_id, away_team_id, round FROM cached_fixtures').all();
  const fixtureByKey = {};
  for (const f of fixtures) {
    const key = `${f.home_team_id}|${f.away_team_id}|${f.round}`;
    fixtureByKey[key] = f.id;
  }

  const updateStmt = db.prepare(
    'UPDATE cached_fixtures SET home_score = ?, away_score = ?, home_ht_score = ?, away_ht_score = ?, status = ? WHERE id = ?'
  );

  let updated = 0;
  for (const m of matches) {
    if (!m.score?.ft) continue;

    const homeId = teamMap[m.team1];
    const awayId = teamMap[m.team2];
    if (!homeId || !awayId) continue;

    const key = `${homeId}|${awayId}|${m.round}`;
    const fixtureId = fixtureByKey[key];
    if (!fixtureId) continue;

    updateStmt.run(m.score.ft[0], m.score.ft[1], m.score.ht?.[0] ?? null, m.score.ht?.[1] ?? null, 'FT', fixtureId);
    updated++;
  }

  return { updated };
}
