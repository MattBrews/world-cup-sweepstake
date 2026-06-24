/**
 * Qualification Simulation Engine for 2026 FIFA World Cup
 *
 * Pure functions — no DB dependency. Takes raw team and fixture data,
 * evaluates all possible remaining-match permutations, and returns
 * status labels for every team.
 *
 * Tournament format (hardcoded):
 *  - 48 teams, 12 groups (A–L) of 4
 *  - Top 2 from each group → Round of 32 (24 teams)
 *  - Best 8 third-placed teams → Round of 32
 *  - Bottom 4 third-placed + all fourth-placed teams → eliminated
 */

// ---------------------------------------------------------------------------
// Types (JSDoc)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} TeamInfo
 * @property {number}  id
 * @property {string}  group_letter
 * @property {number}  [disciplinary_points]
 * @property {number}  [fifa_ranking]        1-based (lower is better)
 */

/**
 * @typedef {Object} MatchResult
 * @property {number}  home_team_id
 * @property {number}  away_team_id
 * @property {number}  [home_score]
 * @property {number}  [away_score]
 * @property {string}  [status]
 * @property {string}  [stage]
 */

/**
 * @typedef {Object} RankedTeam
 * @property {number}  team_id
 * @property {number}  rank
 * @property {number}  points
 * @property {number}  played
 * @property {number}  wins
 * @property {number}  draws
 * @property {number}  losses
 * @property {number}  goals_for
 * @property {number}  goals_against
 * @property {number}  goal_diff
 * @property {number}  disciplinary_points
 * @property {number}  fifa_ranking
 */

const GROUP_STAGE = 'Group Stage';

// ---------------------------------------------------------------------------
// Group-stage tiebreaker ordering (FIFA 2026)
// ---------------------------------------------------------------------------

const GROUP_TIEBREAKERS = [
  'h2h_points',
  'h2h_gd',
  'h2h_gs',
  'overall_gd',
  'overall_gs',
  'conduct',
  'ranking',
];

const CROSS_TIEBREAKERS = [
  'points',
  'gd',
  'gs',
  'conduct',
  'ranking',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rankComparator(tiebreakers) {
  return (a, b) => {
    for (const key of tiebreakers) {
      const diff = tiebreakerCompare(a, b, key);
      if (diff !== 0) return diff;
    }
    return 0;
  };
}

function tiebreakerCompare(a, b, key) {
  switch (key) {
    case 'h2h_points': return b.h2h_points - a.h2h_points;
    case 'h2h_gd':     return b.h2h_gd - a.h2h_gd;
    case 'h2h_gs':     return b.h2h_gs - a.h2h_gs;
    case 'overall_gd':
    case 'gd':         return b.goal_diff - a.goal_diff;
    case 'overall_gs':
    case 'gs':         return b.goals_for - a.goals_for;
    case 'points':     return b.points - a.points;
    case 'conduct':    return b.disciplinary_points - a.disciplinary_points;
    case 'ranking':    return a.fifa_ranking - b.fifa_ranking;
    default:           return 0;
  }
}

// ---------------------------------------------------------------------------
// Permutation generation
// ---------------------------------------------------------------------------

const OUTCOMES = [
  { home_pts: 3, away_pts: 0, home_scored: 1, away_scored: 0 },
  { home_pts: 1, away_pts: 1, home_scored: 0, away_scored: 0 },
  { home_pts: 0, away_pts: 3, home_scored: 0, away_scored: 1 },
];

/**
 * Generate all possible outcome arrays for a list of unplayed matches.
 * Each outcome encodes a synthetic 1-0 / 0-0 / 0-1 result so that
 * GD/GS tiebreakers still have signal even with simulated matches.
 *
 * @param {Object[]} matches
 * @returns {Object[][]} scenarios — each scenario is an array of
 *   { home_team_id, away_team_id, home_score, away_score } entries.
 */
export function generatePermutations(matches, outcomes = OUTCOMES) {
  if (matches.length === 0) return [[]];

  const [first, ...rest] = matches;
  const subPerms = generatePermutations(rest, outcomes);
  const results = [];

  for (const outcome of outcomes) {
    const resolved = {
      home_team_id: first.home_team_id,
      away_team_id: first.away_team_id,
      home_score: outcome.home_scored,
      away_score: outcome.away_scored,
    };
    for (const sp of subPerms) {
      results.push([resolved, ...sp]);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Group standings calculator (with full FIFA tiebreakers)
// ---------------------------------------------------------------------------

/**
 * Compute final group standings for a set of teams given a set of
 * completed match results.  Supports head-to-head sub-table resolution
 * for multi-team ties.
 *
 * @param {number[]}      teamIds
 * @param {Object[]}      matches  — completed match results
 * @param {Object<number,{disciplinary_points:number,fifa_ranking:number}>} [augments]
 *   Per-team discipline & ranking data keyed by team_id.
 * @returns {RankedTeam[]}
 */
export function calculateGroupStandings(teamIds, matches, augments = {}) {
  const stats = {};
  for (const tid of teamIds) {
    stats[tid] = {
      team_id: tid,
      points: 0, played: 0, wins: 0, draws: 0, losses: 0,
      goals_for: 0, goals_against: 0, goal_diff: 0,
      disciplinary_points: augments[tid]?.disciplinary_points ?? 0,
      fifa_ranking: augments[tid]?.fifa_ranking ?? 9999,
    };
  }

  for (const m of matches) {
    const h = stats[m.home_team_id];
    const a = stats[m.away_team_id];
    if (!h || !a) continue;

    h.played++;
    a.played++;
    h.goals_for += m.home_score;
    h.goals_against += m.away_score;
    a.goals_for += m.away_score;
    a.goals_against += m.home_score;

    if (m.home_score > m.away_score) {
      h.points += 3; h.wins++; a.losses++;
    } else if (m.home_score < m.away_score) {
      a.points += 3; a.wins++; h.losses++;
    } else {
      h.points += 1; h.draws++; a.points += 1; a.draws++;
    }
  }

  for (const s of Object.values(stats)) {
    s.goal_diff = s.goals_for - s.goals_against;
  }

  return rankWithTiebreakers(Object.values(stats), matches);
}

/**
 * Internal: sort teams and resolve ties with head-to-head sub-tables.
 *
 * Algorithm:
 * 1. Group teams by points (primary criterion).
 * 2. For each group of tied teams, compute head-to-head stats from
 *    matches that ONLY involve teams in that tie group, then sort
 *    using the full tiebreaker chain.
 */
function rankWithTiebreakers(teams, allMatches) {
  // Group by points
  const byPoints = {};
  for (const t of teams) {
    if (!byPoints[t.points]) byPoints[t.points] = [];
    byPoints[t.points].push(t);
  }

  const pointsSorted = Object.keys(byPoints)
    .map(Number)
    .sort((a, b) => b - a);

  const result = [];
  let rank = 1;

  for (const pts of pointsSorted) {
    const group = byPoints[pts];

    if (group.length === 1) {
      result.push({ ...group[0], rank: rank++ });
    } else {
      const resolved = resolveTiedGroup(group, allMatches);
      for (const rt of resolved) {
        result.push({ ...rt, rank: rank++ });
      }
    }
  }

  return result;
}

function resolveTiedGroup(tiedTeams, allMatches) {
  // Extract head-to-head matches among the tied teams
  const tiedIds = new Set(tiedTeams.map(t => t.team_id));

  const h2hMatches = allMatches.filter(
    m => tiedIds.has(m.home_team_id) && tiedIds.has(m.away_team_id)
  );

  // Compute h2h stats for each tied team
  const h2hStats = {};
  for (const tid of tiedIds) {
    h2hStats[tid] = {
      h2h_points: 0, h2h_gd: 0, h2h_gs: 0, played: 0,
    };
  }

  for (const m of h2hMatches) {
    const h = h2hStats[m.home_team_id];
    const a = h2hStats[m.away_team_id];
    if (!h || !a) continue;
    h.played++; a.played++;

    h.h2h_gs += m.home_score;
    a.h2h_gs += m.away_score;
    h.h2h_gd += m.home_score - m.away_score;
    a.h2h_gd += m.away_score - m.home_score;

    if (m.home_score > m.away_score) {
      h.h2h_points += 3;
    } else if (m.home_score < m.away_score) {
      a.h2h_points += 3;
    } else {
      h.h2h_points += 1;
      a.h2h_points += 1;
    }
  }

  // Merge h2h stats into base stats
  const merged = tiedTeams.map(t => ({
    ...t,
    h2h_points: h2hStats[t.team_id]?.h2h_points ?? 0,
    h2h_gd: h2hStats[t.team_id]?.h2h_gd ?? 0,
    h2h_gs: h2hStats[t.team_id]?.h2h_gs ?? 0,
  }));

  // Sort within the tied group using full tiebreaker chain
  merged.sort(rankComparator(GROUP_TIEBREAKERS));

  // If still tied after all 7 criteria, keep current order (arbitrary but stable)
  return merged;
}

// ---------------------------------------------------------------------------
// Cross-group 3rd-place table ranking
// ---------------------------------------------------------------------------

/**
 * Given 12 third-placed teams (one per group), rank them using
 * cross-group tiebreakers and return them with a rank + advances flag.
 *
 * @param {RankedTeam[]} thirdPlaceTeams
 * @returns {RankedTeam[]}
 */
export function rankThirdPlaces(thirdPlaceTeams) {
  const sorted = [...thirdPlaceTeams].sort(rankComparator(CROSS_TIEBREAKERS));
  return sorted.map((t, i) => ({
    ...t,
    third_place_rank: i + 1,
    advances: i < 8,
  }));
}

// ---------------------------------------------------------------------------
// Core engine: determine qualification status for all teams
// ---------------------------------------------------------------------------

/**
 * @param {TeamInfo[]}  allTeams     — 48 teams with group_letter
 * @param {Object[]}    allFixtures  — group-stage fixtures (both FT and SCHEDULED)
 * @returns {Object<number, 'QUALIFIED'|'ELIMINATED'|'PENDING'>}
 */
export function determineQualificationStatus(allTeams, allFixtures) {
  const groupStage = allFixtures.filter(
    f => (f.stage || GROUP_STAGE) === GROUP_STAGE
  );
  const completed = groupStage.filter(f => f.status === 'FT' && f.home_score != null);
  const unplayed = groupStage.filter(f => f.status !== 'FT' || f.home_score == null);

  // Organise teams by group
  const teamMap = {};
  const groupTeams = {};
  for (const t of allTeams) {
    teamMap[t.id] = t;
    if (!groupTeams[t.group_letter]) groupTeams[t.group_letter] = [];
    groupTeams[t.group_letter].push(t.id);
  }

  // Organise fixtures by group
  const completedByGroup = {};
  const unplayedByGroup = {};
  for (const f of completed) {
    const gl = teamMap[f.home_team_id]?.group_letter;
    if (!gl) continue;
    if (!completedByGroup[gl]) completedByGroup[gl] = [];
    completedByGroup[gl].push(f);
  }
  for (const f of unplayed) {
    const gl = teamMap[f.home_team_id]?.group_letter;
    if (!gl) continue;
    if (!unplayedByGroup[gl]) unplayedByGroup[gl] = [];
    unplayedByGroup[gl].push(f);
  }

  // Build augments map (discipline + ranking)
  const augments = {};
  for (const t of allTeams) {
    augments[t.id] = {
      disciplinary_points: t.disciplinary_points ?? 0,
      fifa_ranking: t.fifa_ranking ?? 9999,
    };
  }

  // For each group, pre-compute all possible final standings + 3rd-place ranges
  const groupStandingsScenarios = {};
  const bestThird = {};   // best possible 3rd-place stats per group
  const worstThird = {};  // worst possible 3rd-place stats per group

  const allGroupLetters = Object.keys(groupTeams);

  for (const gl of allGroupLetters) {
    const tids = groupTeams[gl];
    const remaining = unplayedByGroup[gl] || [];
    const perms = generatePermutations(remaining);
    const scenarios = [];

    let best = null;
    let worst = null;

    for (const perm of perms) {
      const allGroupMatches = [...(completedByGroup[gl] || []), ...perm];
      const standing = calculateGroupStandings(tids, allGroupMatches, augments);
      scenarios.push(standing);

      const third = standing.find(s => s.rank === 3);
      if (third) {
        // crossCompare(a, b) < 0  means a is better than b
        if (!best || crossCompare(third, best) < 0) best = third;
        if (!worst || crossCompare(third, worst) > 0) worst = third;
      }
    }

    groupStandingsScenarios[gl] = scenarios;
    bestThird[gl] = best;
    worstThird[gl] = worst;
  }

  // Pool per-group best/worst into a single lookup
  const thirdPlacePool = {};
  for (const gl of allGroupLetters) {
    thirdPlacePool[gl] = { best: bestThird[gl], worst: worstThird[gl] };
  }

  // Determine status for each team
  const results = {};

  for (const team of allTeams) {
    const gl = team.group_letter;
    if (!gl || !groupStandingsScenarios[gl]) {
      results[team.id] = 'PENDING';
      continue;
    }

    const scenarios = groupStandingsScenarios[gl];
    let everQualified = false;
    let everEliminated = false;

    for (const standing of scenarios) {
      const ts = standing.find(s => s.team_id === team.id);
      if (!ts) continue;

      if (ts.rank <= 2) {
        everQualified = true;
      } else if (ts.rank === 3) {
        if (canAdvanceAsThird(ts, gl, thirdPlacePool, allGroupLetters)) {
          everQualified = true;
        }
        if (canBeEliminatedAsThird(ts, gl, thirdPlacePool, allGroupLetters)) {
          everEliminated = true;
        }
      } else {
        everEliminated = true;
      }
    }

    if (everQualified && !everEliminated) {
      // Conservative check: scores have no upper bound, so if a team's
      // qualification depends on goal difference or goals scored (i.e. the
      // H2H sub-table was not decisive), the outcome is unknowable and the
      // team must be PENDING.
      if (teamHasRemainingMatches(team.id, unplayed)) {
        if (!checkScoreDependentTiebreakers(team.id, groupTeams[gl], completedByGroup[gl] || [], unplayedByGroup[gl] || [], augments, gl, thirdPlacePool, allGroupLetters)) {
          results[team.id] = 'PENDING';
        } else {
          results[team.id] = 'QUALIFIED';
        }
      } else {
        results[team.id] = 'QUALIFIED';
      }
    } else if (!everQualified && everEliminated) {
      results[team.id] = 'ELIMINATED';
    } else {
      results[team.id] = 'PENDING';
    }
  }

  return results;
}

/**
 * Does team `teamId` appear in any unplayed fixture?
 */
function teamHasRemainingMatches(teamId, unplayed) {
  return unplayed.some(f => f.home_team_id === teamId || f.away_team_id === teamId);
}

/**
 * There is no upper bound on match scores.  If a team's qualification
 * depends on goal difference or goals scored, the outcome is inherently
 * unknowable — a competitor could score an arbitrarily large number of
 * goals to flip the tiebreaker.
 *
 * This function checks whether the team's qualifying position depends on
 * a point-tie where the H2H sub-table was not decisive.  If so, the
 * tiebreaker falls through to overall GD/GS (unbounded) and the team
 * must be PENDING — *but only* if that uncertainty could actually drop
 * the team out of a qualifying spot.
 */
function checkScoreDependentTiebreakers(teamId, groupTeamIds, completedMatches, remainingMatches, augments, groupLetter, thirdPlacePool, allGroupLetters) {
  const perms = generatePermutations(remainingMatches);
  for (const perm of perms) {
    const allMatchData = [...completedMatches, ...perm];
    const standing = calculateGroupStandings(groupTeamIds, allMatchData, augments);
    const entry = standing.find(s => s.team_id === teamId);
    if (!entry) continue;

    if (entry.rank === 1 || entry.rank === 2) {
      if (tiebreakerCouldDropOut(standing, allMatchData, teamId)) {
        return false;
      }
    } else if (entry.rank === 3) {
      // The main loop says this team is guaranteed to advance (or we
      // wouldn't be here).  Check whether a score-dependent tiebreaker
      // could push them into a 3rd-place that *doesn't* advance.
      if (tiebreakerCouldDropOut(standing, allMatchData, teamId)
          && !canAdvanceAsThird(entry, groupLetter, thirdPlacePool, allGroupLetters)) {
        return false;
      }
    } else {
      // 4th place — can't advance
      return false;
    }
  }
  return true;
}

/**
 * A points-tie whose H2H sub-table leaves teams unresolved means the
 * tiebreaker falls to overall GD/GS, which is unbounded.  However, this
 * only matters when the tied opponent sits *outside* the qualification
 * zone — if both teams are already in qualifying spots the uncertainty
 * about their exact ordering is harmless.
 */
function tiebreakerCouldDropOut(standing, allMatches, teamId) {
  const entry = standing.find(s => s.team_id === teamId);
  const tied = standing.filter(s => s.points === entry.points);
  if (tied.length < 2) return false;

  const tiedIds = new Set(tied.map(t => t.team_id));
  const h2hMatches = allMatches.filter(
    m => tiedIds.has(m.home_team_id) && tiedIds.has(m.away_team_id)
  );

  const h2h = {};
  for (const tid of tiedIds) h2h[tid] = { pts: 0, gd: 0, gs: 0 };
  for (const m of h2hMatches) {
    const h = h2h[m.home_team_id];
    const a = h2h[m.away_team_id];
    h.gs += m.home_score; a.gs += m.away_score;
    h.gd += m.home_score - m.away_score;
    a.gd += m.away_score - m.home_score;
    if (m.home_score > m.away_score) { h.pts += 3; }
    else if (m.home_score < m.away_score) { a.pts += 3; }
    else { h.pts += 1; a.pts += 1; }
  }

  const target = h2h[teamId];
  return Object.entries(h2h).some(([tid, s]) => {
    if (Number(tid) === teamId) return false;
    if (s.pts !== target.pts || s.gd !== target.gd || s.gs !== target.gs) return false;

    // H2H not decisive → goes to overall GD.  Only flag this as
    // uncertain if the tied opponent is NOT in a qualifying spot
    // (rank 3 or 4), because then flipping the tiebreaker would
    // push our team into that non-qualifying position.
    const otherEntry = standing.find(st => st.team_id === Number(tid));
    return otherEntry ? otherEntry.rank > 2 : true;
  });
}

/**
 * Build a 3rd-place table using one endpoint per other group
 * ('best' or 'worst'), then locate the target team.
 * @param {'best'|'worst'} mode
 * @returns {{ team_id, advances, third_place_rank }|null}
 */
function evaluateThirdPlaceTable(teamStanding, groupLetter, mode, thirdPlacePool, allGroupLetters) {
  const table = [teamStanding];
  for (const gl of allGroupLetters) {
    if (gl === groupLetter) continue;
    const entry = thirdPlacePool[gl];
    if (!entry) continue;
    const candidate = entry[mode];
    if (candidate) table.push(candidate);
  }
  const ranked = rankThirdPlaces(table);
  return ranked.find(t => t.team_id === teamStanding.team_id) || null;
}

/**
 * Can this 3rd-place team advance in *some* configuration of other groups?
 * Uses the most favourable case (other groups at their worst).
 */
function canAdvanceAsThird(teamStanding, groupLetter, thirdPlacePool, allGroupLetters) {
  const result = evaluateThirdPlaceTable(teamStanding, groupLetter, 'worst', thirdPlacePool, allGroupLetters);
  return result ? result.advances : false;
}

/**
 * Can this 3rd-place team be eliminated in *some* configuration of other groups?
 *
 * Uses the least favourable case (other groups at their best) *and* applies
 * an unbounded-GD correction: since match scores have no upper limit, any
 * 3rd‑place team that can reach ≥ our points could also achieve arbitrarily
 * high goal difference, beating us on every score‑dependent tiebreaker.
 *
 * If 8+ other groups can match or exceed our points the team can be pushed
 * out of the top‑8 advancing spots.
 */
function canBeEliminatedAsThird(teamStanding, groupLetter, thirdPlacePool, allGroupLetters) {
  const result = evaluateThirdPlaceTable(teamStanding, groupLetter, 'best', thirdPlacePool, allGroupLetters);

  // Unbounded-GD correction
  let othersAtLeastOurPts = 0;
  for (const gl of allGroupLetters) {
    if (gl === groupLetter) continue;
    const best = thirdPlacePool[gl]?.best;
    if (best && best.points >= teamStanding.points) {
      othersAtLeastOurPts++;
    }
  }
  if (othersAtLeastOurPts >= 8) return true;

  return result ? !result.advances : true;
}

/**
 * Compare two teams by cross-group tiebreakers.
 * Returns >0 if a is better, <0 if b is better.
 */
function crossCompare(a, b) {
  const cmp = rankComparator(CROSS_TIEBREAKERS);
  return cmp(a, b);
}

// ---------------------------------------------------------------------------
// Convenience: get status for a single team
// ---------------------------------------------------------------------------

/**
 * @param {number} teamId
 * @param {TeamInfo[]} allTeams
 * @param {Object[]} allFixtures
 * @returns {'QUALIFIED'|'ELIMINATED'|'PENDING'}
 */
export function getTeamQualificationStatus(teamId, allTeams, allFixtures) {
  const results = determineQualificationStatus(allTeams, allFixtures);
  return results[teamId] || 'PENDING';
}
