import { getDb } from '../db/connection.js';

export function getRecords() {
  const db = getDb();

  const minuteExpr = `CAST(me.minute AS INTEGER) + CASE WHEN INSTR(me.minute, '+') > 0 THEN CAST(SUBSTR(me.minute, INSTR(me.minute, '+') + 1) AS INTEGER) ELSE 0 END`;

  const earliestGoal = db.prepare(`
    SELECT t.id as team_id, t.name, t.logo_url, MIN(${minuteExpr}) as minute
    FROM match_events me
    JOIN cached_fixtures f ON me.match_id = f.id
    JOIN cached_teams t ON me.team_id = t.id
    WHERE me.type = 'GOAL'
    GROUP BY me.id
    ORDER BY minute ASC
    LIMIT 1
  `).get();

  const latestGoal = db.prepare(`
    SELECT t.id as team_id, t.name, t.logo_url, MAX(${minuteExpr}) as minute
    FROM match_events me
    JOIN cached_fixtures f ON me.match_id = f.id
    JOIN cached_teams t ON me.team_id = t.id
    WHERE me.type = 'GOAL'
    GROUP BY me.id
    ORDER BY minute DESC
    LIMIT 1
  `).get();

  const earliestYellow = db.prepare(`
    SELECT t.id as team_id, t.name, t.logo_url, MIN(${minuteExpr}) as minute
    FROM match_events me
    JOIN cached_fixtures f ON me.match_id = f.id
    JOIN cached_teams t ON me.team_id = t.id
    WHERE me.type = 'BOOKING' AND json_extract(me.additional_info, '$.card') = 'YELLOW'
    GROUP BY me.id
    ORDER BY minute ASC
    LIMIT 1
  `).get();

  const latestYellow = db.prepare(`
    SELECT t.id as team_id, t.name, t.logo_url, MAX(${minuteExpr}) as minute
    FROM match_events me
    JOIN cached_fixtures f ON me.match_id = f.id
    JOIN cached_teams t ON me.team_id = t.id
    WHERE me.type = 'BOOKING' AND json_extract(me.additional_info, '$.card') = 'YELLOW'
    GROUP BY me.id
    ORDER BY minute DESC
    LIMIT 1
  `).get();

  const earliestRed = db.prepare(`
    SELECT t.id as team_id, t.name, t.logo_url, MIN(${minuteExpr}) as minute
    FROM match_events me
    JOIN cached_fixtures f ON me.match_id = f.id
    JOIN cached_teams t ON me.team_id = t.id
    WHERE me.type = 'BOOKING' AND json_extract(me.additional_info, '$.card') IN ('RED', 'SECOND_YELLOW')
    GROUP BY me.id
    ORDER BY minute ASC
    LIMIT 1
  `).get();

  const latestRed = db.prepare(`
    SELECT t.id as team_id, t.name, t.logo_url, MAX(${minuteExpr}) as minute
    FROM match_events me
    JOIN cached_fixtures f ON me.match_id = f.id
    JOIN cached_teams t ON me.team_id = t.id
    WHERE me.type = 'BOOKING' AND json_extract(me.additional_info, '$.card') IN ('RED', 'SECOND_YELLOW')
    GROUP BY me.id
    ORDER BY minute DESC
    LIMIT 1
  `).get();

  const mostGoalsFirstHalf = db.prepare(`
    SELECT t.id as team_id, t.name, t.logo_url, COUNT(*) as goals
    FROM match_events me
    JOIN cached_teams t ON me.team_id = t.id
    WHERE me.type = 'GOAL' AND ${minuteExpr} <= 45
    GROUP BY me.team_id
    ORDER BY goals DESC, t.name ASC
    LIMIT 1
  `).get();

  const mostGoalsSecondHalf = db.prepare(`
    SELECT t.id as team_id, t.name, t.logo_url, COUNT(*) as goals
    FROM match_events me
    JOIN cached_teams t ON me.team_id = t.id
    WHERE me.type = 'GOAL' AND ${minuteExpr} > 45
    GROUP BY me.team_id
    ORDER BY goals DESC, t.name ASC
    LIMIT 1
  `).get();

  const mostGoalsSingleGame = db.prepare(`
    SELECT t.id as team_id, t.name, t.logo_url, MAX(goals) as goals
    FROM (
      SELECT f.home_team_id as team_id, f.home_score as goals FROM cached_fixtures f WHERE f.status = 'FT' AND f.home_score IS NOT NULL
      UNION ALL
      SELECT f.away_team_id as team_id, f.away_score as goals FROM cached_fixtures f WHERE f.status = 'FT' AND f.away_score IS NOT NULL
    ) team_scores
    JOIN cached_teams t ON t.id = team_scores.team_id
    GROUP BY t.id
    ORDER BY goals DESC, t.name ASC
    LIMIT 1
  `).get();

  const mostPlayerGoalsSingleGame = db.prepare(`
    SELECT me.player_name, me.team_id, t.name as team_name, t.logo_url, COUNT(*) as goals
    FROM match_events me
    JOIN cached_teams t ON me.team_id = t.id
    WHERE me.type = 'GOAL' AND me.player_name IS NOT NULL
      AND (json_extract(me.additional_info, '$.goalType') IS NULL OR json_extract(me.additional_info, '$.goalType') != 3)
    GROUP BY me.match_id, me.player_name
    ORDER BY goals DESC, me.player_name ASC
    LIMIT 1
  `).get();

  const mostPlayerGoalsFirstHalf = db.prepare(`
    SELECT me.player_name, me.team_id, t.name as team_name, t.logo_url, COUNT(*) as goals
    FROM match_events me
    JOIN cached_teams t ON me.team_id = t.id
    WHERE me.type = 'GOAL' AND me.player_name IS NOT NULL AND ${minuteExpr} <= 45
      AND (json_extract(me.additional_info, '$.goalType') IS NULL OR json_extract(me.additional_info, '$.goalType') != 3)
    GROUP BY me.player_name, me.team_id
    ORDER BY goals DESC, me.player_name ASC
    LIMIT 1
  `).get();

  const mostPlayerGoalsSecondHalf = db.prepare(`
    SELECT me.player_name, me.team_id, t.name as team_name, t.logo_url, COUNT(*) as goals
    FROM match_events me
    JOIN cached_teams t ON me.team_id = t.id
    WHERE me.type = 'GOAL' AND me.player_name IS NOT NULL AND ${minuteExpr} > 45
      AND (json_extract(me.additional_info, '$.goalType') IS NULL OR json_extract(me.additional_info, '$.goalType') != 3)
    GROUP BY me.player_name, me.team_id
    ORDER BY goals DESC, me.player_name ASC
    LIMIT 1
  `).get();

  const mostCleanSheets = db.prepare(`
    SELECT t.id as team_id, t.name, t.logo_url, COUNT(*) as goals
    FROM cached_fixtures f
    JOIN cached_teams t ON (f.home_team_id = t.id OR f.away_team_id = t.id)
    WHERE f.status = 'FT'
      AND ((f.home_team_id = t.id AND f.away_score = 0) OR (f.away_team_id = t.id AND f.home_score = 0))
    GROUP BY t.id
    ORDER BY goals DESC, t.name ASC
    LIMIT 1
  `).get();

  const mostOwnGoalsPlayer = db.prepare(`
    SELECT me.player_name,
           CASE WHEN me.team_id = f.home_team_id THEN f.away_team_id ELSE f.home_team_id END as team_id,
           t.name as team_name, t.logo_url,
           COUNT(*) as own_goals
    FROM match_events me
    JOIN cached_fixtures f ON me.match_id = f.id
    JOIN cached_teams t ON t.id = CASE WHEN me.team_id = f.home_team_id THEN f.away_team_id ELSE f.home_team_id END
    WHERE me.type = 'GOAL' AND me.player_name IS NOT NULL AND json_extract(me.additional_info, '$.goalType') = 3
    GROUP BY me.player_name, team_id
    ORDER BY own_goals DESC, me.player_name ASC
    LIMIT 1
  `).get();

  const mostOwnGoalsTeam = db.prepare(`
    SELECT t.id as team_id, t.name, t.logo_url, COUNT(*) as own_goals
    FROM match_events me
    JOIN cached_fixtures f ON me.match_id = f.id
    JOIN cached_teams t ON t.id = CASE WHEN me.team_id = f.home_team_id THEN f.away_team_id ELSE f.home_team_id END
    WHERE me.type = 'GOAL' AND json_extract(me.additional_info, '$.goalType') = 3
    GROUP BY t.id
    ORDER BY own_goals DESC, t.name ASC
    LIMIT 1
  `).get();

  return {
    earliestGoal,
    latestGoal,
    earliestYellow,
    latestYellow,
    earliestRed,
    latestRed,
    mostGoalsFirstHalf,
    mostGoalsSecondHalf,
    mostGoalsSingleGame,
    mostPlayerGoalsSingleGame,
    mostPlayerGoalsFirstHalf,
    mostPlayerGoalsSecondHalf,
    mostCleanSheets,
    mostOwnGoalsPlayer,
    mostOwnGoalsTeam,
  };
}
