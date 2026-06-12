import { DataService, MATCH_STATUS } from './dataService.js';
import fetch from 'node-fetch';
import { getDb } from '../../db/connection.js';

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
      `SELECT id, api_match_id FROM cached_fixtures
       WHERE api_match_id IS NOT NULL
         AND lifecycle_state IN ('FT', 'IN_PROGRESS', 'AWAITING')`
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

        const homeFormation = data.HomeTeam?.Tactics || null;
        const awayFormation = data.AwayTeam?.Tactics || null;
        const attendance = data.Attendance || null;
        const referee = (data.Officials || [])
          .filter(o => o.OfficialType === 1)
          .map(o => o.Name?.[0]?.Description)
          .filter(Boolean)[0] || null;

        db.prepare(
          `UPDATE cached_fixtures
           SET home_formation = ?, away_formation = ?, attendance = ?, referee = ?,
               last_synced_at = datetime('now')
           WHERE id = ?`
        ).run(homeFormation, awayFormation, attendance, referee, fixture.id);

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
        for (const b of bookings) {
          const playerName = findPlayerName(data, b.IdTeam, b.IdPlayer);
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
          const playerOff = s.PlayerOffName?.[0]?.Description || null;
          const playerOn = s.PlayerOnName?.[0]?.Description || null;
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

        if (data.Penalties) {
          for (const p of data.Penalties) {
            const playerName = p.Player?.Name || p.PlayerName?.[0]?.Description || null;
            db.prepare(
              `INSERT INTO match_events (match_id, team_id, type, minute, period, player_name, additional_info)
               VALUES (?, ?, 'PENALTY', ?, ?, ?, ?)`
            ).run(
              fixture.id,
              resolveTeamId(p.Team?.Id),
              null,
              null,
              playerName,
              JSON.stringify({ scored: !!p.Scored })
            );
            totalEvents++;
          }
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

        db.prepare(
          `UPDATE cached_fixtures SET lifecycle_state = 'COMPLETE' WHERE id = ?`
        ).run(fixture.id);

        updated++;
      } catch (err) {
        console.log(`[fifaLive] Error match ${fixture.id}: ${err.message}`);
      }
    }

    console.log(`[fifaLive] Updated ${updated} matches (${totalEvents} events, ${totalLineups} lineups)`);

    this.recalculateTopScorers();

    return { matchesUpdated: updated, events: totalEvents, lineups: totalLineups };
  }

  async syncLiveMatches() {
    const db = getDb();

    const fixtures = db.prepare(
      `SELECT id, api_match_id, lifecycle_state FROM cached_fixtures
       WHERE api_match_id IS NOT NULL
         AND lifecycle_state IN ('AWAITING', 'IN_PROGRESS')`
    ).all();

    let updated = 0;

    for (const fixture of fixtures) {
      await delay(DELAY_MS);

      try {
        const data = await this.getLiveMatch(fixture.api_match_id);
        if (!data) continue;

        const homeScore = data.HomeTeam?.Score ?? null;
        const awayScore = data.AwayTeam?.Score ?? null;
        const matchStatus = data.MatchStatus || null;

        let newState = fixture.lifecycle_state;
        let newStatus = null;

        if (matchStatus) {
          const statusUpper = matchStatus.toUpperCase();
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

        const updateFields = ['lifecycle_state = ?'];
        const updateValues = [newState];

        if (homeScore !== null && awayScore !== null) {
          updateFields.push('home_score = ?', 'away_score = ?');
          updateValues.push(homeScore, awayScore);
        }

        if (newStatus) {
          updateFields.push('status = ?');
          updateValues.push(newStatus);
        }

        updateFields.push("last_synced_at = datetime('now')");
        updateValues.push(fixture.id);

        db.prepare(
          `UPDATE cached_fixtures SET ${updateFields.join(', ')} WHERE id = ?`
        ).run(...updateValues);

        updated++;
      } catch (err) {
        console.log(`[fifaLive] Error syncing live match ${fixture.id}: ${err.message}`);
      }
    }

    return { updated };
  }

  recalculateTopScorers() {
    const db = getDb();

    db.prepare('DELETE FROM cached_top_scorers').run();

    const goals = db.prepare(`
      SELECT player_name, team_id, COUNT(*) as goal_count
      FROM match_events
      WHERE type = 'GOAL' AND player_name IS NOT NULL
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
}
