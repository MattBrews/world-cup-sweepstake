import { getDb } from '../db/connection.js';
import * as api from './apiFootball.js';

function logSync(endpoint, status, count = 1) {
  const db = getDb();
  db.prepare(
    'INSERT INTO sync_log (endpoint, status, request_count) VALUES (?, ?, ?)'
  ).run(endpoint, status, count);
}

export async function syncTeams() {
  const db = getDb();
  try {
    const data = await api.getTeams();
    const teams = data.response || [];
    const upsert = db.prepare(
      `INSERT OR REPLACE INTO cached_teams (id, name, code, logo_url, group_letter)
       VALUES (?, ?, ?, ?, ?)`
    );
    const tx = db.transaction(() => {
      for (const t of teams) {
        const team = t.team;
        upsert.run(team.id, team.name, team.code, team.logo, null);
      }
    });
    tx();
    logSync('teams', 'success');
    return teams.length;
  } catch (err) {
    logSync('teams', `error: ${err.message}`);
    throw err;
  }
}

export async function syncFixtures() {
  const db = getDb();
  try {
    const data = await api.getAllFixtures();
    const fixtures = data.response || [];
    const upsert = db.prepare(
      `INSERT OR REPLACE INTO cached_fixtures
       (id, round, stage, date, home_team_id, away_team_id, home_score, away_score, status, venue)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const tx = db.transaction(() => {
      for (const f of fixtures) {
        const round = f.league?.round || '';
        const stage = round?.toLowerCase().includes('group') ? 'Group Stage' : 'Knockout';
        upsert.run(
          f.fixture.id,
          round,
          stage,
          f.fixture.date,
          f.teams.home.id,
          f.teams.away.id,
          f.goals.home,
          f.goals.away,
          f.fixture.status.short,
          f.fixture.venue?.name || null
        );
      }
    });
    tx();
    logSync('fixtures', 'success');
    return fixtures.length;
  } catch (err) {
    logSync('fixtures', `error: ${err.message}`);
    throw err;
  }
}

export async function syncStandings() {
  const db = getDb();
  try {
    const data = await api.getStandings();
    const leagues = data.response || [];
    const upsert = db.prepare(
      `INSERT OR REPLACE INTO cached_standings
       (id, group_letter, team_id, rank, points, played, win, draw, lose, goals_for, goals_against, goal_diff)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    let counter = 0;
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM cached_standings').run();
      for (const league of leagues) {
        const standings = league.league?.standings || [];
        for (const group of standings) {
          const groupName = group[0]?.group?.replace('Group ', '') || '';
          for (const entry of group) {
            counter++;
            upsert.run(
              counter,
              groupName,
              entry.team.id,
              entry.rank,
              entry.points,
              entry.all.played,
              entry.all.win,
              entry.all.draw,
              entry.all.lose,
              entry.all.goals.for,
              entry.all.goals.against,
              entry.goalsDiff
            );
          }
        }
      }
    });
    tx();
    logSync('standings', 'success');
    return counter;
  } catch (err) {
    logSync('standings', `error: ${err.message}`);
    throw err;
  }
}

export async function syncAll() {
  if (!api.hasApiKey()) {
    throw new Error('API-Football key not configured');
  }

  const results = {
    teams: await syncTeams(),
    fixtures: await syncFixtures(),
    standings: await syncStandings(),
  };

  return results;
}
