import { getDb } from '../db/connection.js';
import { getRecords } from './recordCalculator.js';
import { determineQualificationStatus } from './qualificationEngine.js';

const STAGE_ORDER = ['Group Stage', 'Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', '3rd Place', 'Final'];

function detectCurrentStage(fixtures) {
  const stages = ['Group Stage', 'Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', '3rd Place', 'Final'];
  const lastUnplayed = fixtures
    .filter(f => f.status !== 'FT' && f.status !== 'AWAITING')
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  if (!lastUnplayed) return stages[stages.length - 1];
  return lastUnplayed.stage || 'Group Stage';
}

function getTeamStatus(teamId, engineResults, fixtures, standings) {
  const ko = fixtures.filter(f =>
    f.stage && f.stage !== 'Group Stage' && (f.home_team_id === teamId || f.away_team_id === teamId)
  );
  if (ko.length > 0) {
    const ftKo = ko.filter(f => f.status === 'FT');
    if (ftKo.length > 0) {
      const last = ftKo.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      const h = last.home_team_id === teamId;
      if ((h ? last.home_score : last.away_score) < (h ? last.away_score : last.home_score)) return 'eliminated';
      return 'qualified';
    }
    // No completed knockout fixtures — fall through to engine
  }
  const status = engineResults[teamId];
  if (status === 'QUALIFIED') return 'qualified';
  if (status === 'ELIMINATED') return 'eliminated';
  return 'atRisk';
}

function computeDisciplinaryPoints(db) {
  const cards = db.prepare(`
    SELECT me.team_id,
           json_extract(me.additional_info, '$.card') as card_type,
           COUNT(*) as count
    FROM match_events me
    WHERE me.type = 'BOOKING'
      AND me.additional_info IS NOT NULL
    GROUP BY me.team_id, json_extract(me.additional_info, '$.card')
  `).all();

  const points = {};
  for (const c of cards) {
    if (!points[c.team_id]) points[c.team_id] = 0;
    switch (c.card_type) {
      case 'YELLOW':       points[c.team_id] += -1 * c.count; break;
      case 'SECOND_YELLOW': points[c.team_id] += -3 * c.count; break;
      case 'RED':          points[c.team_id] += -4 * c.count; break;
      default:             points[c.team_id] += -1 * c.count; break;
    }
  }
  return points;
}

export function generateMonthlyReport(sweepstakeRef) {
  const db = getDb();

  let sweep = db.prepare('SELECT id, name, slug, public_id FROM sweepstakes WHERE public_id = ?').get(sweepstakeRef);
  if (!sweep) sweep = db.prepare('SELECT id, name, slug, public_id FROM sweepstakes WHERE slug = ?').get(sweepstakeRef);
  if (!sweep) return null;

  const participants = db.prepare(
    'SELECT id, name, team_id, team_name FROM participants WHERE sweepstake_id = ?'
  ).all(sweep.id);

  const standings = db.prepare('SELECT * FROM cached_standings ORDER BY group_letter, rank').all();
  const fixtures = db.prepare('SELECT * FROM cached_fixtures ORDER BY date').all();
  const teams = db.prepare('SELECT * FROM cached_teams ORDER BY name').all();

  const teamMap = {};
  for (const t of teams) teamMap[t.id] = t;

  // Compute disciplinary points from match events
  const disciplinaryPoints = computeDisciplinaryPoints(db);

  // Run the qualification simulation engine
  const engineTeams = teams.filter(t => t.group_letter).map(t => ({
    id: t.id,
    group_letter: t.group_letter,
    disciplinary_points: disciplinaryPoints[t.id] || 0,
    fifa_ranking: t.fifa_ranking || 9999,
  }));

  const engineResults = determineQualificationStatus(engineTeams, fixtures);

  const currentStage = detectCurrentStage(fixtures);
  const isKnockout = STAGE_ORDER.indexOf(currentStage) > 0;

  const stageProgress = {};
  for (const stage of STAGE_ORDER) {
    const stageFixtures = fixtures.filter(f => (f.stage || 'Group Stage') === stage);
    const total = stageFixtures.length;
    const completed = stageFixtures.filter(f => f.status === 'FT').length;
    if (total > 0) {
      stageProgress[stage] = { total, completed };
    }
  }

  // Participant standings
  const participantMap = {};
  for (const p of participants) {
    if (!participantMap[p.name]) {
      participantMap[p.name] = { name: p.name, totalPoints: 0, totalTeams: 0, teams: [] };
    }
    const standing = standings.find(s => s.team_id === p.team_id);
    const pts = standing ? standing.points : 0;
    participantMap[p.name].totalPoints += pts;
    participantMap[p.name].totalTeams++;
    participantMap[p.name].teams.push({
      team_id: p.team_id,
      team_name: p.team_name,
      points: pts,
      group_letter: teamMap[p.team_id]?.group_letter || null,
      logo_url: teamMap[p.team_id]?.logo_url || null,
      rank: standing ? standing.rank : null,
    });
  }
  const participantStandings = Object.values(participantMap)
    .sort((a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name))
    .map((p, i) => ({ ...p, rank: i + 1 }));

  // Team status — split people across columns per-team
  const personTeams = {};
  for (const p of participants) {
    if (!personTeams[p.name]) personTeams[p.name] = [];
    const status = getTeamStatus(p.team_id, engineResults, fixtures, standings);
    personTeams[p.name].push({
      team_id: p.team_id,
      team_name: p.team_name,
      logo_url: teamMap[p.team_id]?.logo_url || null,
      group_letter: teamMap[p.team_id]?.group_letter || null,
      status,
    });
  }

  const byStatus = { qualified: [], atRisk: [], eliminated: [] };
  for (const [name, teams] of Object.entries(personTeams)) {
    for (const status of ['qualified', 'atRisk', 'eliminated']) {
      const matching = teams.filter(t => t.status === status);
      if (matching.length > 0) {
        byStatus[status].push({ name, teams: matching });
      }
    }
  }

  // Group snapshot
  const groupSnapshot = [];
  const groupLetters = [...new Set(standings.map(s => s.group_letter))].sort();
  for (const gl of groupLetters) {
    const groupStandings = standings.filter(s => s.group_letter === gl).sort((a, b) => a.rank - b.rank);
    const groupTeams = groupStandings.map(s => ({
      rank: s.rank,
      team_id: s.team_id,
      team_name: teamMap[s.team_id]?.name || `Team #${s.team_id}`,
      logo_url: teamMap[s.team_id]?.logo_url || null,
      points: s.points,
      played: s.played,
      win: s.win,
      draw: s.draw,
      lose: s.lose,
      goal_diff: s.goal_diff,
      goals_for: s.goals_for,
      goals_against: s.goals_against,
      participants: participants.filter(p => p.team_id === s.team_id).map(p => p.name),
      status: getTeamStatus(s.team_id, engineResults, fixtures, standings),
    }));
    groupSnapshot.push({ group: gl, teams: groupTeams });
  }

  // Biggest wins
  const biggestWins = db.prepare(`
    SELECT f.id, f.home_team_id, f.away_team_id, f.home_score, f.away_score,
           ht.name as home_team_name, at.name as away_team_name,
           ht.logo_url as home_logo, at.logo_url as away_logo,
           ABS(f.home_score - f.away_score) as margin, f.stage, f.date
    FROM cached_fixtures f
    JOIN cached_teams ht ON f.home_team_id = ht.id
    JOIN cached_teams at ON f.away_team_id = at.id
    WHERE f.status = 'FT' AND f.home_score IS NOT NULL AND f.away_score IS NOT NULL
    ORDER BY margin DESC, f.date DESC
    LIMIT 5
  `).all();

  for (const win of biggestWins) {
    win.home_participants = participants.filter(p => p.team_id === win.home_team_id).map(p => p.name);
    win.away_participants = participants.filter(p => p.team_id === win.away_team_id).map(p => p.name);
  }

  // Top scorers
  const topScorers = db.prepare(`
    SELECT cs.player_name, cs.team_id, t.name as team_name, t.logo_url, cs.goals
    FROM cached_top_scorers cs
    JOIN cached_teams t ON t.id = cs.team_id
    ORDER BY cs.goals DESC, cs.player_name ASC
    LIMIT 5
  `).all();

  for (const scorer of topScorers) {
    scorer.participants = participants.filter(p => p.team_id === scorer.team_id).map(p => p.name);
  }

  // Card leaders
  const cardLeaders = db.prepare(`
    SELECT t.id as team_id, t.name, t.logo_url,
           COALESCE(SUM(CASE WHEN json_extract(me.additional_info, '$.card') = 'YELLOW' THEN 1 ELSE 0 END), 0) as yellow,
           COALESCE(SUM(CASE WHEN json_extract(me.additional_info, '$.card') IN ('RED', 'SECOND_YELLOW') THEN 1 ELSE 0 END), 0) as red,
           COALESCE(COUNT(me.id), 0) as total
    FROM cached_teams t
    LEFT JOIN match_events me ON t.id = me.team_id AND me.type = 'BOOKING'
    GROUP BY t.id
    ORDER BY total DESC, t.name ASC
    LIMIT 5
  `).all();

  for (const card of cardLeaders) {
    card.participants = participants.filter(p => p.team_id === card.team_id).map(p => p.name);
  }

  // Upcoming matches (involving participants' teams)
  const participantTeamIds = participants.map(p => p.team_id);
  let upcomingMatches = [];
  if (participantTeamIds.length > 0) {
    const placeholders = participantTeamIds.map(() => '?').join(',');
    upcomingMatches = db.prepare(`
      SELECT f.*, ht.name as home_team_name, at.name as away_team_name,
             ht.logo_url as home_logo, at.logo_url as away_logo
      FROM cached_fixtures f
      JOIN cached_teams ht ON f.home_team_id = ht.id
      JOIN cached_teams at ON f.away_team_id = at.id
      WHERE (f.home_team_id IN (${placeholders}) OR f.away_team_id IN (${placeholders}))
        AND (f.status IS NULL OR f.status NOT IN ('FT', 'AWAITING'))
      ORDER BY f.date ASC
      LIMIT 5
    `).all(...participantTeamIds, ...participantTeamIds);
  }

  for (const match of upcomingMatches) {
    match.home_participants = participants.filter(p => p.team_id === match.home_team_id).map(p => p.name);
    match.away_participants = participants.filter(p => p.team_id === match.away_team_id).map(p => p.name);
  }

  // Recent results
  let recentResults = [];
  if (participantTeamIds.length > 0) {
    const placeholders = participantTeamIds.map(() => '?').join(',');
    recentResults = db.prepare(`
      SELECT f.*, ht.name as home_team_name, at.name as away_team_name,
             ht.logo_url as home_logo, at.logo_url as away_logo
      FROM cached_fixtures f
      JOIN cached_teams ht ON f.home_team_id = ht.id
      JOIN cached_teams at ON f.away_team_id = at.id
      WHERE f.status = 'FT'
        AND (f.home_team_id IN (${placeholders}) OR f.away_team_id IN (${placeholders}))
      ORDER BY f.date DESC
      LIMIT 5
    `).all(...participantTeamIds, ...participantTeamIds);
  }

  for (const match of recentResults) {
    match.home_participants = participants.filter(p => p.team_id === match.home_team_id).map(p => p.name);
    match.away_participants = participants.filter(p => p.team_id === match.away_team_id).map(p => p.name);
  }

  // Records
  const records = getRecords();

  // Stats
  const participantNames = [...new Set(participants.map(p => p.name))];
  const participantStatusCounts = {};
  for (const p of participants) {
    if (!participantStatusCounts[p.name]) participantStatusCounts[p.name] = [];
    const status = getTeamStatus(p.team_id, engineResults, fixtures, standings);
    participantStatusCounts[p.name].push(status);
  }
  const stillAlive = participantNames.filter(
    name => participantStatusCounts[name].some(s => s === 'qualified' || s === 'atRisk')
  ).length;
  const eliminated = participantNames.length - stillAlive;

  // Knockout round progress
  let knockoutProgress = null;
  if (isKnockout) {
    const koFixtures = fixtures.filter(f => STAGE_ORDER.indexOf(f.stage || 'Group Stage') > 0);
    const koByRound = {};
    for (const f of koFixtures) {
      if (!koByRound[f.stage]) koByRound[f.stage] = { total: 0, completed: 0 };
      koByRound[f.stage].total++;
      if (f.status === 'FT') koByRound[f.stage].completed++;
    }
    knockoutProgress = koByRound;
  }

  return {
    sweepstake: { name: sweep.name, slug: sweep.slug, public_id: sweep.public_id },
    generatedAt: new Date().toISOString(),
    currentStage,
    isKnockout,
    stageProgress,
    knockoutProgress,
    participantStandings,
    teamStatusByPerson: byStatus,
    groupSnapshot,
    biggestWins,
    topScorers,
    cardLeaders,
    upcomingMatches,
    recentResults,
    records,
    stats: {
      totalParticipants: participantNames.length,
      stillAlive,
      eliminated,
    },
  };
}
