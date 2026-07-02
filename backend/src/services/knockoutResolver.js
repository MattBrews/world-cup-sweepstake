import { getDb } from '../db/connection.js';

export function resolveKnockoutPlaceholders() {
  const db = getDb();

  const fixtures = db.prepare(
    `SELECT id, home_team_id, away_team_id, home_placeholder, away_placeholder
     FROM cached_fixtures
     WHERE (home_team_id IS NULL AND home_placeholder IS NOT NULL AND home_placeholder != 'null')
        OR (away_team_id IS NULL AND away_placeholder IS NOT NULL AND away_placeholder != 'null')`
  ).all();

  let resolved = 0;

  for (const fixture of fixtures) {
    const updates = {};

    if (fixture.home_team_id === null && fixture.home_placeholder) {
      const teamId = resolveWl(fixture.home_placeholder);
      if (teamId != null) {
        updates.home_team_id = teamId;
      }
    }

    if (fixture.away_team_id === null && fixture.away_placeholder) {
      const teamId = resolveWl(fixture.away_placeholder);
      if (teamId != null) {
        updates.away_team_id = teamId;
      }
    }

    if (Object.keys(updates).length > 0) {
      const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      const values = Object.values(updates);
      db.prepare(`UPDATE cached_fixtures SET ${setClauses} WHERE id = ?`).run(...values, fixture.id);
      resolved++;
    }
  }

  if (resolved > 0) {
    console.log(`[knockoutResolver] Resolved ${resolved} fixtures`);
  }

  return resolved;
}

function resolveWl(placeholder) {
  if (!placeholder || placeholder === 'null') return null;

  const db = getDb();

  if (placeholder.startsWith('W')) {
    const fid = parseInt(placeholder.slice(1), 10);
    if (isNaN(fid)) return null;
    return getTeam(fid, 'winner');
  }

  if (placeholder.startsWith('L')) {
    const fid = parseInt(placeholder.slice(1), 10);
    if (isNaN(fid)) return null;
    return getTeam(fid, 'loser');
  }

  return null;
}

function getTeam(fixtureId, side) {
  const db = getDb();

  const fixture = db.prepare(
    `SELECT home_team_id, away_team_id, home_score, away_score,
            home_pen_score, away_pen_score, status
     FROM cached_fixtures WHERE id = ?`
  ).get(fixtureId);

  if (!fixture || fixture.status !== 'FT') return null;
  if (fixture.home_score == null || fixture.away_score == null) return null;

  const wantHome = side === 'winner'
    ? fixture.home_score > fixture.away_score
    : fixture.home_score < fixture.away_score;

  const wantAway = side === 'winner'
    ? fixture.away_score > fixture.home_score
    : fixture.away_score < fixture.home_score;

  if (wantHome) return fixture.home_team_id;
  if (wantAway) return fixture.away_team_id;

  if (fixture.home_pen_score != null && fixture.away_pen_score != null) {
    const penWantHome = side === 'winner'
      ? fixture.home_pen_score > fixture.away_pen_score
      : fixture.home_pen_score < fixture.away_pen_score;

    const penWantAway = side === 'winner'
      ? fixture.away_pen_score > fixture.home_pen_score
      : fixture.away_pen_score < fixture.home_pen_score;

    if (penWantHome) return fixture.home_team_id;
    if (penWantAway) return fixture.away_team_id;
  }

  return null;
}
