import { getDb } from '../db/connection.js';

export function recalculateStandings() {
  const db = getDb();

  db.prepare('DELETE FROM cached_standings').run();

  const teams = db.prepare(
    'SELECT id, group_letter FROM cached_teams WHERE group_letter IS NOT NULL'
  ).all();

  const fixtures = db.prepare(
    `SELECT home_team_id, away_team_id, home_score, away_score, status
     FROM cached_fixtures
     WHERE home_team_id IS NOT NULL AND away_team_id IS NOT NULL
       AND home_score IS NOT NULL AND away_score IS NOT NULL`
  ).all();

  const teamGroups = {};
  for (const t of teams) {
    teamGroups[t.id] = t.group_letter;
  }

  const stats = {};
  for (const t of teams) {
    stats[t.id] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  }

  for (const f of fixtures) {
    const h = f.home_team_id;
    const a = f.away_team_id;
    if (!stats[h] || !stats[a]) continue;

    stats[h].gf += f.home_score;
    stats[h].ga += f.away_score;
    stats[a].gf += f.away_score;
    stats[a].ga += f.home_score;

    if (f.status === 'FT') {
      stats[h].p++;
      stats[a].p++;

      if (f.home_score > f.away_score) {
        stats[h].w++; stats[h].pts += 3; stats[a].l++;
      } else if (f.home_score < f.away_score) {
        stats[a].w++; stats[a].pts += 3; stats[h].l++;
      } else {
        stats[h].d++; stats[h].pts++; stats[a].d++; stats[a].pts++;
      }
    }
  }

  const groupMatches = {};
  for (const t of teams) {
    const gl = t.group_letter;
    if (!groupMatches[gl]) groupMatches[gl] = [];
    groupMatches[gl].push(t.id);
  }

  const ins = db.prepare(
    `INSERT INTO cached_standings
     (group_letter, team_id, rank, points, played, win, draw, lose, goals_for, goals_against, goal_diff)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let count = 0;
  for (const [gl, teamIds] of Object.entries(groupMatches)) {
    const sorted = teamIds
      .map(tid => ({ tid, ...stats[tid], gd: stats[tid].gf - stats[tid].ga }))
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

    sorted.forEach((s, i) => {
      ins.run(gl, s.tid, i + 1, s.pts, s.p, s.w, s.d, s.l, s.gf, s.ga, s.gd);
      count++;
    });
  }

  return count;
}

export function getBestThirdPlaces() {
  const db = getDb();

  const thirdPlaced = db.prepare(
    `SELECT cs.*, t.name as team_name, t.code, t.logo_url
     FROM cached_standings cs
     JOIN cached_teams t ON t.id = cs.team_id
     WHERE cs.rank = 3
     ORDER BY cs.group_letter`
  ).all();

  const sorted = [...thirdPlaced].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goal_diff !== a.goal_diff) return b.goal_diff - a.goal_diff;
    if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
    return a.group_letter.localeCompare(b.group_letter);
  });

  return sorted.map((t, i) => ({
    ...t,
    thirdPlaceRank: i + 1,
    advances: i < 8,
  }));
}
