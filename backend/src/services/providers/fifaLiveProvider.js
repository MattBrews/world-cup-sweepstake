import { DataService, MATCH_STATUS } from './dataService.js';
import fetch from 'node-fetch';
import { getDb } from '../../db/connection.js';
import { syncPenaltyShootout } from './espnProvider.js';

const DELAY_MS = 300;

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function cardType(card) {
  if (card === 1) return 'YELLOW';
  if (card === 2) return 'RED';
  if (card === 3) return 'SECOND_YELLOW';
  return 'YELLOW';
}

function resolveTeamId(fifaTeamId) {
  if (!fifaTeamId) return null;
  const db = getDb();
  const row = db.prepare('SELECT local_team_id FROM cached_team_mappings WHERE fifa_team_id = ?').get(parseInt(fifaTeamId));
  return row ? row.local_team_id : null;
}

function findPlayerName(data, teamId, playerId) {
  if (!teamId || !playerId) return null;
  for (const side of ['HomeTeam', 'AwayTeam']) {
    const team = data[side];
    if (!team || parseInt(team.IdTeam) !== parseInt(teamId)) continue;
    const player = (team.Players || []).find(p => parseInt(p.IdPlayer) === parseInt(playerId));
    if (player) return player.PlayerName?.[0]?.Description || player.ShortName?.[0]?.Description || null;
  }
  // Fallback: search both rosters (handles own goals where player is on opposing team)
  for (const side of ['HomeTeam', 'AwayTeam']) {
    const team = data[side];
    if (!team) continue;
    const player = (team.Players || []).find(p => parseInt(p.IdPlayer) === parseInt(playerId));
    if (player) return player.PlayerName?.[0]?.Description || player.ShortName?.[0]?.Description || null;
  }
  return null;
}

function positionLabel(pos) {
  const labels = {
    0: 'Goalkeeper', 1: 'Defender', 2: 'Midfielder', 3: 'Forward',
  };
  return labels[pos] || null;
}

export class FifaLiveProvider extends DataService {
  get name() { return 'fifa-live'; }

  async getLiveMatch(apiMatchId) {
    const res = await fetch(
      `https://api.fifa.com/api/v3/live/football/${apiMatchId}`
    );
    if (!res.ok) return null;
    return res.json();
  }

  async syncMatchDetails() {
    const db = getDb();

    const fixtures = db.prepare(
      `SELECT id, api_match_id, home_team_id, away_team_id, last_synced_at FROM cached_fixtures
       WHERE api_match_id IS NOT NULL
         AND lifecycle_state = 'FT'
         AND (last_synced_at IS NULL OR datetime(last_synced_at, '+30 minutes') < datetime('now'))`
    ).all();

    let updated = 0;
    let totalEvents = 0;
    let totalLineups = 0;

    for (const fixture of fixtures) {
      await delay(DELAY_MS);

      try {
        const data = await this.getLiveMatch(fixture.api_match_id);
        if (!data) {
          console.log(`[fifaLive] Skipping match ${fixture.id}: no data`);
          continue;
        }

        db.prepare('DELETE FROM match_events WHERE match_id = ?').run(fixture.id);
        db.prepare('DELETE FROM match_lineups WHERE match_id = ?').run(fixture.id);
        db.prepare('DELETE FROM penalty_shootout_kicks WHERE match_id = ?').run(fixture.id);

        const homeFormation = data.HomeTeam?.Tactics || null;
        const awayFormation = data.AwayTeam?.Tactics || null;
        const attendance = data.Attendance || null;
        const referee = (data.Officials || [])
          .filter(o => o.OfficialType === 1)
          .map(o => o.Name?.[0]?.Description)
          .filter(Boolean)[0] || null;

        const homePenScore = data.HomeTeamPenaltyScore ?? null;
        const awayPenScore = data.AwayTeamPenaltyScore ?? null;
        const homeScore = data.HomeTeam?.Score ?? null;
        const awayScore = data.AwayTeam?.Score ?? null;

        db.prepare(
          `UPDATE cached_fixtures
           SET home_formation = ?, away_formation = ?, attendance = ?, referee = ?,
               home_pen_score = ?, away_pen_score = ?,
               home_score = ?, away_score = ?,
               last_synced_at = datetime('now')
           WHERE id = ?`
        ).run(homeFormation, awayFormation, attendance, referee, homePenScore, awayPenScore, homeScore, awayScore, fixture.id);

        const goals = data.HomeTeam?.Goals || [];
        for (const g of data.AwayTeam?.Goals || []) goals.push(g);
        for (const g of goals) {
          const scorerName = findPlayerName(data, g.IdTeam, g.IdPlayer);
          const assistName = g.IdAssistPlayer ? findPlayerName(data, g.IdTeam, g.IdAssistPlayer) : null;
          db.prepare(
            `INSERT INTO match_events (match_id, team_id, type, minute, period, player_name, additional_info)
             VALUES (?, ?, 'GOAL', ?, ?, ?, ?)`
          ).run(
            fixture.id,
            resolveTeamId(g.IdTeam),
            g.Minute || null,
            g.Period || null,
            scorerName,
            JSON.stringify({ assist: assistName, goalType: g.Type })
          );
          totalEvents++;
        }

        const bookings = data.HomeTeam?.Bookings || [];
        for (const b of data.AwayTeam?.Bookings || []) bookings.push(b);
        const seenBookings = new Set();
        for (const b of bookings) {
          const key = b.IdPlayer
            ? `${resolveTeamId(b.IdTeam)}:${b.IdPlayer}`
            : `${resolveTeamId(b.IdTeam)}:${b.Minute || ''}:${b.Period || ''}`;
          if (seenBookings.has(key)) continue;
          seenBookings.add(key);
          const playerName = b.PlayerName?.[0]?.Description || b.Player?.Name || (b.IdPlayer && findPlayerName(data, b.IdTeam, b.IdPlayer)) || null;
          db.prepare(
            `INSERT INTO match_events (match_id, team_id, type, minute, period, player_name, additional_info)
             VALUES (?, ?, 'BOOKING', ?, ?, ?, ?)`
          ).run(
            fixture.id,
            resolveTeamId(b.IdTeam),
            b.Minute || null,
            b.Period || null,
            playerName,
            JSON.stringify({ card: cardType(b.Card) })
          );
          totalEvents++;
        }

        const subs = data.HomeTeam?.Substitutions || [];
        for (const s of data.AwayTeam?.Substitutions || []) subs.push(s);
        for (const s of subs) {
          const playerOffId = s.IdPlayerOff || s.PlayerOff?.IdPlayer || s.PlayerOff?.Id || null;
          const playerOnId = s.IdPlayerOn || s.PlayerOn?.IdPlayer || s.PlayerOn?.Id || null;
          const playerOff = s.PlayerOffName?.[0]?.Description || (playerOffId && findPlayerName(data, s.IdTeam, playerOffId)) || null;
          const playerOn = s.PlayerOnName?.[0]?.Description || (playerOnId && findPlayerName(data, s.IdTeam, playerOnId)) || null;
          db.prepare(
            `INSERT INTO match_events (match_id, team_id, type, minute, period, player_name, additional_info)
             VALUES (?, ?, 'SUB', ?, ?, ?, ?)`
          ).run(
            fixture.id,
            resolveTeamId(s.IdTeam),
            s.Minute || null,
            s.Period || null,
            `${playerOff} → ${playerOn}`,
            JSON.stringify({ playerOff, playerOn })
          );
          totalEvents++;
        }

        for (const side of ['HomeTeam', 'AwayTeam']) {
          const team = data[side];
          if (!team) continue;
          const teamId = resolveTeamId(team.IdTeam);

          for (const player of team.Players || []) {
            const isStarter = player.Status === 1 ? 1 : 0;
            db.prepare(
              `INSERT INTO match_lineups (match_id, team_id, player_name, position, shirt_number, is_starter)
               VALUES (?, ?, ?, ?, ?, ?)`
            ).run(
              fixture.id,
              teamId,
              player.PlayerName?.[0]?.Description || null,
              player.PositionName || positionLabel(player.Position),
              player.ShirtNumber || null,
              isStarter
            );
            totalLineups++;
          }
        }

        this._deriveScoresFromEvents(fixture.id, fixture.home_team_id, fixture.away_team_id);
        this._updatePenaltyScoresFromEvents(fixture.id, fixture.home_team_id, fixture.away_team_id);

        db.prepare(
          `UPDATE cached_fixtures SET lifecycle_state = 'COMPLETE' WHERE id = ?`
        ).run(fixture.id);

        const fixtureRow = db.prepare('SELECT home_pen_score, away_pen_score, date FROM cached_fixtures WHERE id = ?').get(fixture.id);
        if (fixtureRow?.home_pen_score != null && fixtureRow?.away_pen_score != null) {
          const homeTeamRow = db.prepare('SELECT name FROM cached_teams WHERE id = ?').get(fixture.home_team_id);
          const awayTeamRow = db.prepare('SELECT name FROM cached_teams WHERE id = ?').get(fixture.away_team_id);
          if (homeTeamRow && awayTeamRow) {
            await syncPenaltyShootout(fixture.id, fixtureRow.date, homeTeamRow.name, awayTeamRow.name);
          }
        }

        updated++;
      } catch (err) {
        console.log(`[fifaLive] Error match ${fixture.id}: ${err.message}`);
      }
    }

    console.log(`[fifaLive] Updated ${updated} matches (${totalEvents} events, ${totalLineups} lineups)`);

    this.backfillPenaltyScores();

    await this.backfillEspnShootoutKicks();

    this.recalculateTopScorers();

    return { matchesUpdated: updated, events: totalEvents, lineups: totalLineups };
  }

  async syncLiveMatches() {
    const db = getDb();

    const fixtures = db.prepare(
      `SELECT id, api_match_id, date, lifecycle_state, last_synced_at FROM cached_fixtures
       WHERE api_match_id IS NOT NULL
         AND lifecycle_state IN ('AWAITING', 'IN_PROGRESS')`
    ).all();

    const now = new Date();
    const intervals = {
      'AWAITING': 5 * 60 * 1000,
      'IN_PROGRESS': 1 * 60 * 1000,
    };

    const needsUpdate = fixtures.filter(f => {
      if (!f.last_synced_at) return true;
      const lastSync = new Date(f.last_synced_at + 'Z');
      const interval = intervals[f.lifecycle_state] || 5 * 60 * 1000;
      return (now - lastSync) >= interval;
    });

    let updated = 0;

    for (const fixture of needsUpdate) {
      await delay(DELAY_MS);

      try {
        const data = await this.getLiveMatch(fixture.api_match_id);
        if (!data) continue;

        const homeScore = data.HomeTeam?.Score ?? null;
        const awayScore = data.AwayTeam?.Score ?? null;
        const period = data.Period;

        // Derive current minute from API clock and event-based max, then take the higher
        const matchTimeRaw = data.MatchTime || data.MatchMinute || data.Minute || null;
        const matchTimeMinute = matchTimeRaw != null ? parseInt(String(matchTimeRaw)) ?? 0 : null;

        const allEvents = [
          ...(data.HomeTeam?.Goals || []).map(g => g.Minute),
          ...(data.AwayTeam?.Goals || []).map(g => g.Minute),
          ...(data.HomeTeam?.Bookings || []).map(b => b.Minute),
          ...(data.AwayTeam?.Bookings || []).map(b => b.Minute),
          ...(data.HomeTeam?.Substitutions || []).map(s => s.Minute),
          ...(data.AwayTeam?.Substitutions || []).map(s => s.Minute),
        ].filter(Boolean);
        const parsed = allEvents.map(m => {
          const str = String(m);
          const match = str.match(/^(\d+)(?:\+(\d+))?/);
          if (!match) return 0;
          return parseInt(match[1]) + (match[2] ? parseInt(match[2]) : 0);
        });
        const eventMaxMinute = parsed.length > 0 ? Math.max(...parsed) : null;

        let currentMinute = Math.max(
          matchTimeMinute ?? 0,
          eventMaxMinute ?? 0
        ) || null;

        // Fallback: if match is in 2nd half+ (period > 1) but minute is stuck at 45
        // because no events have occurred since first half, estimate from elapsed time
        if ((currentMinute == null || currentMinute <= 45) && period > 1) {
          const matchStart = fixture.date ? new Date(fixture.date) : null;
          if (matchStart && !isNaN(matchStart.getTime())) {
            const elapsedMin = (Date.now() - matchStart.getTime()) / 60000;
            if (elapsedMin > 60) { // past 45' first half + 15' halftime
              const estimated = Math.round(Math.max(45, elapsedMin - 15));
              if (estimated > (currentMinute || 0)) {
                currentMinute = estimated;
              }
            }
          }
        }

        // Derive display-formatted minute string
        let minuteDisplay = null;
        if (matchTimeRaw != null) {
          minuteDisplay = String(matchTimeRaw);
        } else if (eventMaxMinute != null && allEvents.length > 0) {
          const maxVal = Math.max(...parsed);
          for (let i = parsed.length - 1; i >= 0; i--) {
            if (parsed[i] === maxVal) {
              minuteDisplay = String(allEvents[i]);
              break;
            }
          }
        }
        if (minuteDisplay == null || (currentMinute != null && currentMinute > (parseInt(minuteDisplay) || 0))) {
          minuteDisplay = String(currentMinute);
        }

        let newState = fixture.lifecycle_state;
        let newStatus = null;

        if (period != null) {
          if (period >= 10) {
            newState = MATCH_STATUS.FT;
            newStatus = 'FT';
          } else if (period > 0) {
            newState = MATCH_STATUS.IN_PROGRESS;
            newStatus = 'IN_PROGRESS';
          }
        } else {
          const matchStatus = data.MatchStatus || null;
          if (matchStatus) {
            const statusUpper = String(matchStatus).toUpperCase();
            if (statusUpper === 'FT' || statusUpper === 'AET' || statusUpper === 'AP') {
              newState = MATCH_STATUS.FT;
              newStatus = 'FT';
            } else if (statusUpper.includes('LIVE') || statusUpper.includes('IN-PLAY') ||
                       statusUpper.includes('1ST') || statusUpper.includes('2ND') ||
                       statusUpper.includes('HALF') || statusUpper.includes('EXTRA')) {
              newState = MATCH_STATUS.IN_PROGRESS;
              newStatus = 'IN_PROGRESS';
            }
          }
        }

        const updateFields = ['lifecycle_state = ?'];
        const updateValues = [newState];

        if (homeScore !== null && awayScore !== null) {
          updateFields.push('home_score = ?', 'away_score = ?');
          updateValues.push(homeScore, awayScore);
        }

        const homePenScore = data.HomeTeamPenaltyScore ?? null;
        const awayPenScore = data.AwayTeamPenaltyScore ?? null;
        if (homePenScore !== null && awayPenScore !== null) {
          updateFields.push('home_pen_score = ?', 'away_pen_score = ?');
          updateValues.push(homePenScore, awayPenScore);
        }

        if (newStatus) {
          updateFields.push('status = ?');
          updateValues.push(newStatus);
        }

        if (currentMinute != null) {
          updateFields.push('current_minute = ?');
          updateValues.push(parseInt(currentMinute) || 0);
        }

        if (minuteDisplay != null) {
          updateFields.push('current_minute_display = ?');
          updateValues.push(minuteDisplay);
        }

        if (period != null) {
          updateFields.push('period = ?');
          updateValues.push(period);
        }

        updateFields.push("last_synced_at = datetime('now')");
        updateValues.push(fixture.id);

        db.prepare(
          `UPDATE cached_fixtures SET ${updateFields.join(', ')} WHERE id = ?`
        ).run(...updateValues);

        if (newState === MATCH_STATUS.IN_PROGRESS || newState === MATCH_STATUS.FT) {
          db.prepare('DELETE FROM match_events WHERE match_id = ?').run(fixture.id);
          db.prepare('DELETE FROM match_lineups WHERE match_id = ?').run(fixture.id);
          db.prepare('DELETE FROM penalty_shootout_kicks WHERE match_id = ?').run(fixture.id);

          const goals = data.HomeTeam?.Goals || [];
          for (const g of data.AwayTeam?.Goals || []) goals.push(g);
          for (const g of goals) {
            const scorerName = findPlayerName(data, g.IdTeam, g.IdPlayer);
            const assistName = g.IdAssistPlayer ? findPlayerName(data, g.IdTeam, g.IdAssistPlayer) : null;
            db.prepare(
              `INSERT INTO match_events (match_id, team_id, type, minute, period, player_name, additional_info)
               VALUES (?, ?, 'GOAL', ?, ?, ?, ?)`
            ).run(fixture.id, resolveTeamId(g.IdTeam), g.Minute || null, g.Period || null, scorerName, JSON.stringify({ assist: assistName, goalType: g.Type }));
          }

          const bookings = data.HomeTeam?.Bookings || [];
          for (const b of data.AwayTeam?.Bookings || []) bookings.push(b);
          const seenBookings = new Set();
          for (const b of bookings) {
            const key = b.IdPlayer
              ? `${resolveTeamId(b.IdTeam)}:${b.IdPlayer}`
              : `${resolveTeamId(b.IdTeam)}:${b.Minute || ''}:${b.Period || ''}`;
            if (seenBookings.has(key)) continue;
            seenBookings.add(key);
            const playerName = b.PlayerName?.[0]?.Description || b.Player?.Name || (b.IdPlayer && findPlayerName(data, b.IdTeam, b.IdPlayer)) || null;
            db.prepare(
              `INSERT INTO match_events (match_id, team_id, type, minute, period, player_name, additional_info)
               VALUES (?, ?, 'BOOKING', ?, ?, ?, ?)`
            ).run(fixture.id, resolveTeamId(b.IdTeam), b.Minute || null, b.Period || null, playerName, JSON.stringify({ card: cardType(b.Card) }));
          }

          const subs = data.HomeTeam?.Substitutions || [];
          for (const s of data.AwayTeam?.Substitutions || []) subs.push(s);
          for (const s of subs) {
            const playerOffId = s.IdPlayerOff || s.PlayerOff?.IdPlayer || s.PlayerOff?.Id || null;
            const playerOnId = s.IdPlayerOn || s.PlayerOn?.IdPlayer || s.PlayerOn?.Id || null;
            const playerOff = s.PlayerOffName?.[0]?.Description || (playerOffId && findPlayerName(data, s.IdTeam, playerOffId)) || null;
            const playerOn = s.PlayerOnName?.[0]?.Description || (playerOnId && findPlayerName(data, s.IdTeam, playerOnId)) || null;
            db.prepare(
              `INSERT INTO match_events (match_id, team_id, type, minute, period, player_name, additional_info)
               VALUES (?, ?, 'SUB', ?, ?, ?, ?)`
            ).run(fixture.id, resolveTeamId(s.IdTeam), s.Minute || null, s.Period || null, `${playerOff} → ${playerOn}`, JSON.stringify({ playerOff, playerOn }));
          }

          for (const side of ['HomeTeam', 'AwayTeam']) {
            const team = data[side];
            if (!team) continue;
            const teamId = resolveTeamId(team.IdTeam);
            for (const player of team.Players || []) {
              db.prepare(
                `INSERT INTO match_lineups (match_id, team_id, player_name, position, shirt_number, is_starter)
                 VALUES (?, ?, ?, ?, ?, ?)`
              ).run(fixture.id, teamId, player.PlayerName?.[0]?.Description || null, player.PositionName || positionLabel(player.Position), player.ShirtNumber || null, player.Status === 1 ? 1 : 0);
            }
          }
        }

        this._updatePenaltyScoresFromEvents(fixture.id, fixture.home_team_id, fixture.away_team_id);

        const liveFixtureRow = db.prepare('SELECT home_pen_score, away_pen_score, date FROM cached_fixtures WHERE id = ?').get(fixture.id);
        if (liveFixtureRow?.home_pen_score != null && liveFixtureRow?.away_pen_score != null) {
          const homeTeamRow = db.prepare('SELECT name FROM cached_teams WHERE id = ?').get(fixture.home_team_id);
          const awayTeamRow = db.prepare('SELECT name FROM cached_teams WHERE id = ?').get(fixture.away_team_id);
          if (homeTeamRow && awayTeamRow) {
            await syncPenaltyShootout(fixture.id, liveFixtureRow.date, homeTeamRow.name, awayTeamRow.name);
          }
        }

        updated++;
      } catch (err) {
        console.log(`[fifaLive] Error syncing live match ${fixture.id}: ${err.message}`);
      }
    }

    this.backfillPenaltyScores();

    await this.backfillEspnShootoutKicks();

    return { updated };
  }

  recalculateTopScorers() {
    const db = getDb();

    db.prepare('DELETE FROM cached_top_scorers').run();

    const goals = db.prepare(`
      SELECT player_name, team_id, COUNT(*) as goal_count
      FROM match_events
      WHERE type = 'GOAL' AND player_name IS NOT NULL
        AND (json_extract(additional_info, '$.goalType') IS NULL OR json_extract(additional_info, '$.goalType') != 3)
      GROUP BY player_name, team_id
    `).all();

    for (const goal of goals) {
      db.prepare(
        `INSERT INTO cached_top_scorers (player_name, team_id, goals)
         VALUES (?, ?, ?)`
      ).run(goal.player_name, goal.team_id, goal.goal_count);
    }

    console.log(`[fifaLive] Recalculated top scorers: ${goals.length} players`);
  }

  _deriveScoresFromEvents(matchId, homeTeamId, awayTeamId) {
    const db = getDb();

    const nullTeamGoals = db.prepare(
      `SELECT COUNT(*) as cnt FROM match_events
       WHERE match_id = ? AND type = 'GOAL' AND team_id IS NULL`
    ).get(matchId);
    if (nullTeamGoals.cnt > 0) return;

    const goals = db.prepare(
      `SELECT team_id, period FROM match_events
       WHERE match_id = ? AND type = 'GOAL'`
    ).all(matchId);

    let homeReg = 0, awayReg = 0, homeET = 0, awayET = 0;

    for (const g of goals) {
      const isHome = Number(g.team_id) === Number(homeTeamId);
      const isAway = Number(g.team_id) === Number(awayTeamId);
      const period = g.period || 3;

      if (period >= 10) continue;

      if (period >= 7) {
        if (isHome) homeET++;
        if (isAway) awayET++;
      } else {
        if (isHome) homeReg++;
        if (isAway) awayReg++;
      }
    }

    const totalHome = homeReg + homeET;
    const totalAway = awayReg + awayET;

    db.prepare(
      `UPDATE cached_fixtures
       SET home_score = ?, away_score = ?,
           home_regulation_score = ?, away_regulation_score = ?
       WHERE id = ?`
    ).run(totalHome, totalAway, homeReg, awayReg, matchId);
  }

  _updatePenaltyScoresFromEvents(matchId, homeTeamId, awayTeamId) {
    const db = getDb();
    const penCounts = db.prepare(
      `SELECT team_id, COUNT(*) as cnt FROM match_events
       WHERE match_id = ? AND period >= 10 AND type = 'GOAL'
       GROUP BY team_id`
    ).all(matchId);

    const homePen = penCounts.find(r => Number(r.team_id) === Number(homeTeamId))?.cnt ?? null;
    const awayPen = penCounts.find(r => Number(r.team_id) === Number(awayTeamId))?.cnt ?? null;

    if (homePen != null || awayPen != null) {
      db.prepare(
        'UPDATE cached_fixtures SET home_pen_score = ?, away_pen_score = ? WHERE id = ?'
      ).run(homePen, awayPen, matchId);
    }
  }

  backfillPenaltyScores() {
    const db = getDb();
    const matches = db.prepare(
      `SELECT f.id, f.home_team_id, f.away_team_id
       FROM cached_fixtures f
       WHERE f.home_pen_score IS NULL AND f.away_pen_score IS NULL
         AND EXISTS (
           SELECT 1 FROM match_events e
           WHERE e.match_id = f.id AND e.period >= 10 AND e.type = 'GOAL'
         )`
    ).all();

    if (matches.length === 0) return;

    let updated = 0;
    for (const m of matches) {
      this._updatePenaltyScoresFromEvents(m.id, m.home_team_id, m.away_team_id);
      updated++;
    }
    console.log(`[fifaLive] Backfilled penalty scores for ${updated} matches`);
  }

  async backfillEspnShootoutKicks() {
    const db = getDb();
    const matches = db.prepare(
      `SELECT f.id, f.home_team_id, f.away_team_id, f.date
       FROM cached_fixtures f
       WHERE f.home_pen_score IS NOT NULL AND f.away_pen_score IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM penalty_shootout_kicks k WHERE k.match_id = f.id
         )
       ORDER BY f.date`
    ).all();

    if (matches.length === 0) return 0;

    let synced = 0;
    for (const m of matches) {
      const homeTeam = db.prepare('SELECT name FROM cached_teams WHERE id = ?').get(m.home_team_id);
      const awayTeam = db.prepare('SELECT name FROM cached_teams WHERE id = ?').get(m.away_team_id);
      if (homeTeam && awayTeam) {
        const count = await syncPenaltyShootout(m.id, m.date, homeTeam.name, awayTeam.name);
        if (count > 0) synced++;
      }
      await delay(DELAY_MS);
    }
    if (synced > 0) {
      console.log(`[fifaLive] Backfilled ESPN shootout data for ${synced} matches`);
    }
    return synced;
  }
}
