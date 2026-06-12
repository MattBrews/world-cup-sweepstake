import fetch from 'node-fetch';
import { getDb } from '../db/connection.js';

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

export async function syncMatchDetails() {
  const db = getDb();

  const fixtures = db.prepare(
    `SELECT id, api_match_id FROM cached_fixtures
     WHERE api_match_id IS NOT NULL AND status = 'FT'`
  ).all();

  let updated = 0;
  let totalEvents = 0;
  let totalLineups = 0;

  for (const fixture of fixtures) {
    await delay(DELAY_MS);

    try {
      const res = await fetch(
        `https://api.fifa.com/api/v3/live/football/${fixture.api_match_id}`
      );
      if (!res.ok) {
        console.log(`[fifaMatchDetails] Skipping match ${fixture.id}: HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();

      // Clear old data for this match
      db.prepare('DELETE FROM match_events WHERE match_id = ?').run(fixture.id);
      db.prepare('DELETE FROM match_lineups WHERE match_id = ?').run(fixture.id);

      // Formations, attendance, referee
      const homeFormation = data.HomeTeam?.Tactics || null;
      const awayFormation = data.AwayTeam?.Tactics || null;
      const attendance = data.Attendance || null;
      const referee = (data.Officials || [])
        .filter(o => o.OfficialType === 1)
        .map(o => o.Name?.[0]?.Description)
        .filter(Boolean)[0] || null;

      db.prepare(
        `UPDATE cached_fixtures SET home_formation = ?, away_formation = ?, attendance = ?, referee = ?
         WHERE id = ?`
      ).run(homeFormation, awayFormation, attendance, referee, fixture.id);

      // Process goals
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

      // Process bookings
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

      // Process substitutions
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

      // Process penalties
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

      // Process line-ups
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

      // Update top scorers
      for (const g of goals) {
        const sName = findPlayerName(data, g.IdTeam, g.IdPlayer);
        if (!g.IdPlayer || !sName) continue;

        db.prepare(
          `INSERT INTO cached_top_scorers (player_name, team_id, goals)
           VALUES (?, ?, 1)
           ON CONFLICT(player_name, team_id) DO UPDATE SET goals = goals + 1`
        ).run(sName, resolveTeamId(g.IdTeam));
      }

      updated++;
    } catch (err) {
      console.log(`[fifaMatchDetails] Error match ${fixture.id}: ${err.message}`);
    }
  }

  console.log(`[fifaMatchDetails] Updated ${updated} matches (${totalEvents} events, ${totalLineups} lineups)`);
  return { matchesUpdated: updated, events: totalEvents, lineups: totalLineups };
}

function positionLabel(pos) {
  const labels = {
    0: 'Goalkeeper', 1: 'Defender', 2: 'Midfielder', 3: 'Forward',
  };
  return labels[pos] || null;
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

function resolveTeamId(fifaTeamId) {
  if (!fifaTeamId) return null;
  const db = getDb();
  const row = db.prepare('SELECT local_team_id FROM cached_team_mappings WHERE fifa_team_id = ?').get(parseInt(fifaTeamId));
  return row ? row.local_team_id : null;
}
