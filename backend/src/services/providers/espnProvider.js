import fetch from 'node-fetch';
import { getDb } from '../../db/connection.js';

const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const SUMMARY_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary';

function normalizeName(name) {
  return name?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
}

async function tryResolveByDate(dateStr, homeNorm, awayNorm) {
  const res = await fetch(`${SCOREBOARD_URL}?dates=${dateStr}&limit=200`);
  if (!res.ok) return null;

  const data = await res.json();
  for (const e of data.events || []) {
    const comp = e.competitions?.[0];
    if (!comp) continue;
    const names = (comp.competitors || []).map(c => normalizeName(c.team?.name || ''));
    if (names.includes(homeNorm) && names.includes(awayNorm)) {
      return parseInt(comp.id);
    }
  }
  return null;
}

export async function resolveEspnGameId(matchDate, homeTeamName, awayTeamName) {
  const d = new Date(matchDate);
  const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');

  const homeNorm = normalizeName(homeTeamName);
  const awayNorm = normalizeName(awayTeamName);

  // Try the UTC date first, then the day before (ESPN uses local US time)
  const dateStrs = [dateStr];
  const prev = new Date(d);
  prev.setDate(prev.getDate() - 1);
  dateStrs.push(prev.toISOString().slice(0, 10).replace(/-/g, ''));

  for (const ds of dateStrs) {
    const id = await tryResolveByDate(ds, homeNorm, awayNorm);
    if (id) return id;
  }
  return null;
}

export async function fetchPenaltyShootout(espnGameId) {
  const res = await fetch(`${SUMMARY_URL}?event=${espnGameId}`);
  if (!res.ok) return null;

  const data = await res.json();
  return data.shootout || null;
}

export async function storePenaltyShootout(matchId, shootoutData) {
  const db = getDb();
  const teams = db.prepare(
    `SELECT id, name FROM cached_teams`
  ).all();

  const insert = db.prepare(
    `INSERT INTO penalty_shootout_kicks (match_id, team_id, player_name, shot_number, did_score, espn_player_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  let count = 0;
  for (const teamEntry of shootoutData) {
    const team = teams.find(t => normalizeName(t.name) === normalizeName(teamEntry.team));
    if (!team) continue;

    for (const shot of teamEntry.shots || []) {
      insert.run(
        matchId,
        team.id,
        shot.player || null,
        shot.shotNumber || 0,
        shot.didScore ? 1 : 0,
        shot.playerId || null
      );
      count++;
    }
  }
  return count;
}

export async function syncPenaltyShootout(matchId, matchDate, homeTeamName, awayTeamName) {
  const db = getDb();

  const existing = db.prepare(
    'SELECT COUNT(*) as cnt FROM penalty_shootout_kicks WHERE match_id = ?'
  ).get(matchId);

  if (existing && existing.cnt > 0) return 0;

  let espnGameId = db.prepare(
    'SELECT espn_game_id FROM cached_fixtures WHERE id = ?'
  ).get(matchId)?.espn_game_id;

  if (!espnGameId) {
    espnGameId = await resolveEspnGameId(matchDate, homeTeamName, awayTeamName);
    if (espnGameId) {
      db.prepare('UPDATE cached_fixtures SET espn_game_id = ? WHERE id = ?').run(espnGameId, matchId);
    }
  }

  if (!espnGameId) {
    console.log(`[espn] Could not resolve ESPN game ID for match ${matchId}`);
    return 0;
  }

  const shootoutData = await fetchPenaltyShootout(espnGameId);
  if (!shootoutData || shootoutData.length === 0) {
    console.log(`[espn] No shootout data for match ${matchId} (gameId ${espnGameId})`);
    return 0;
  }

  const count = await storePenaltyShootout(matchId, shootoutData);
  console.log(`[espn] Stored ${count} penalty kicks for match ${matchId}`);
  return count;
}
