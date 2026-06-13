import { getDb } from '../db/connection.js';

const STAGE_ORDER = ['Group Stage', 'Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', '3rd Place', 'Final'];

const GROUP_RESULTS = {
  A: [[1,1,7,3,2,1,0,5,2,3],[3,2,5,3,1,2,0,4,3,1],[4,3,3,3,1,0,2,3,4,-1],[2,4,1,3,0,1,2,2,5,-3]],
  B: [[5,1,6,3,2,0,1,4,2,2],[8,2,5,3,1,2,0,3,2,1],[7,3,2,3,0,2,1,2,4,-2],[6,4,2,3,0,2,1,1,2,-1]],
  C: [[9,1,9,3,3,0,0,8,1,7],[10,2,4,3,1,1,1,3,4,-1],[12,3,4,3,1,1,1,3,4,-1],[11,4,0,3,0,0,3,1,6,-5]],
  D: [[13,1,7,3,2,1,0,6,2,4],[16,2,5,3,1,2,0,4,3,1],[15,3,3,3,1,0,2,3,5,-2],[14,4,1,3,0,1,2,2,5,-3]],
  E: [[17,1,7,3,2,1,0,6,2,4],[20,2,5,3,1,2,0,4,3,1],[19,3,3,3,1,0,2,3,5,-2],[18,4,1,3,0,1,2,2,5,-3]],
  F: [[21,1,7,3,2,1,0,5,1,4],[22,2,5,3,1,2,0,3,2,1],[23,3,4,3,1,1,1,4,3,1],[24,4,0,3,0,0,3,0,6,-6]],
  G: [[25,1,7,3,2,1,0,5,2,3],[26,2,5,3,1,2,0,3,2,1],[27,3,3,3,1,0,2,2,4,-2],[28,4,1,3,0,1,2,1,3,-2]],
  H: [[29,1,7,3,2,1,0,6,2,4],[32,2,5,3,1,2,0,4,3,1],[31,3,1,3,0,1,2,2,5,-3],[30,4,1,3,0,1,2,1,3,-2]],
  I: [[33,1,9,3,3,0,0,7,1,6],[34,2,4,3,1,1,1,3,4,-1],[36,3,4,3,1,1,1,3,4,-1],[35,4,0,3,0,0,3,1,5,-4]],
  J: [[37,1,9,3,3,0,0,7,1,6],[39,2,4,3,1,1,1,3,3,0],[38,3,2,3,0,2,1,2,4,-2],[40,4,1,3,0,1,2,1,5,-4]],
  K: [[41,1,7,3,2,1,0,5,2,3],[44,2,5,3,1,2,0,3,2,1],[42,3,2,3,0,2,1,2,4,-2],[43,4,1,3,0,1,2,1,3,-2]],
  L: [[45,1,9,3,3,0,0,8,1,7],[46,2,6,3,2,0,1,5,3,2],[47,3,1,3,0,1,2,1,5,-4],[48,4,1,3,0,1,2,1,6,-5]],
};

// [fixture_id, home_team_id, away_team_id, home_score, away_score, home_ht, away_ht]
const R32_MATCHUPS = [
  [73, 3,   8,   2, 1, 1, 0],
  [76, 9,   22,  3, 0, 1, 0],
  [74, 17,  23,  2, 1, 0, 1],
  [75, 21,  10,  1, 0, 0, 0],
  [78, 20,  34,  3, 2, 1, 1],
  [77, 33,  12,  4, 1, 2, 0],
  [79, 1,   36,  1, 2, 1, 1],
  [80, 45,  38,  3, 0, 2, 0],
  [81, 13,  19,  2, 0, 1, 0],
  [82, 25,  4,   3, 1, 2, 0],
  [84, 29,  39,  2, 1, 1, 0],
  [83, 44,  46,  2, 1, 0, 0],
  [85, 5,   27,  2, 0, 1, 0],
  [88, 16,  26,  1, 2, 1, 1],
  [86, 37,  32,  4, 0, 2, 0],
  [87, 41,  15,  3, 0, 2, 0],
];

export function seedMockData() {
  const db = getDb();

  db.transaction(() => {
    // 1. Group standings
    db.prepare('DELETE FROM cached_standings').run();
    const insSt = db.prepare(
      `INSERT INTO cached_standings (group_letter, team_id, rank, points, played, win, draw, lose, goals_for, goals_against, goal_diff)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const [letter, teams] of Object.entries(GROUP_RESULTS)) {
      for (const [tid, rank, pts, pl, w, d, l, gf, ga, gd] of teams) {
        insSt.run(letter, tid, rank, pts, pl, w, d, l, gf, ga, gd);
      }
    }

    // 2. Mark all group stage fixtures as FT
    const updGs = db.prepare("UPDATE cached_fixtures SET status = 'FT', lifecycle_state = 'FT' WHERE id = ?");
    for (let i = 1; i <= 72; i++) updGs.run(i);

    // 3. Set R32 team IDs, scores, status
    const updR32 = db.prepare(
      `UPDATE cached_fixtures
       SET home_team_id = ?, away_team_id = ?,
           home_score = ?, away_score = ?,
           home_ht_score = ?, away_ht_score = ?,
           status = 'FT', lifecycle_state = 'COMPLETE'
       WHERE id = ?`
    );
    for (const [fid, hId, aId, hs, as, hht, aht] of R32_MATCHUPS) {
      updR32.run(hId, aId, hs, as, hht, aht, fid);
    }
  })();

  const ftR32 = db.prepare("SELECT COUNT(*) as c FROM cached_fixtures WHERE round = 'Round of 32' AND status = 'FT'").get();
  const standCount = db.prepare('SELECT COUNT(*) as c FROM cached_standings').get();
  return { r32Completed: ftR32.c, standings: standCount.c };
}

export function isTeamEliminated(teamId, fixtures, standings) {
  const teamFixtures = fixtures.filter(f =>
    f.home_team_id === teamId || f.away_team_id === teamId
  );
  if (teamFixtures.length === 0) return false;

  const latestStageIdx = Math.max(...teamFixtures.map(f => {
    const i = STAGE_ORDER.indexOf(f.stage);
    return i === -1 ? 0 : i;
  }));
  const latestStageFixtures = teamFixtures.filter(f => {
    const i = STAGE_ORDER.indexOf(f.stage);
    return (i === -1 ? 0 : i) === latestStageIdx;
  });
  if (!latestStageFixtures.every(f => f.status === 'FT')) return false;

  if (latestStageIdx === 0) {
    const inKnockout = fixtures.some(f =>
      f.stage !== 'Group Stage' && (f.home_team_id === teamId || f.away_team_id === teamId)
    );
    return !inKnockout;
  }

  const lastMatch = latestStageFixtures.slice().sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  )[0];
  const isHome = lastMatch.home_team_id === teamId;
  const teamScore = isHome ? lastMatch.home_score : lastMatch.away_score;
  const oppScore = isHome ? lastMatch.away_score : lastMatch.home_score;

  return teamScore < oppScore;
}
