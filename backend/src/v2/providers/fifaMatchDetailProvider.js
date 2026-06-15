import { MatchDetailProvider } from './interfaces/matchDetailProvider.js';
import { EventType, GoalType, CardType } from '../constants/enums.js';
import { FifaLiveClient } from './clients/fifaLiveClient.js';

function cardType(card) {
  if (card === 1) return CardType.YELLOW;
  if (card === 2) return CardType.RED;
  if (card === 3) return CardType.SECOND_YELLOW;
  return CardType.YELLOW;
}

function findPlayerName(data, teamId, playerId) {
  if (!teamId || !playerId) return null;
  for (const side of ['HomeTeam', 'AwayTeam']) {
    const team = data[side];
    if (!team || parseInt(team.IdTeam) !== parseInt(teamId)) continue;
    const player = (team.Players || []).find(p => parseInt(p.IdPlayer) === parseInt(playerId));
    if (player) return player.PlayerName?.[0]?.Description || player.ShortName?.[0]?.Description || null;
  }
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

export class FifaMatchDetailProvider extends MatchDetailProvider {
  constructor(client, teamRepo) {
    super();
    this.client = client || new FifaLiveClient();
    this.teamRepo = teamRepo;
  }

  async getMatchData(matchId) {
    const data = await this.client.fetch(
      `https://api.fifa.com/api/v3/live/football/${matchId}`
    );
    if (!data) return null;

    const resolve = (fifaTeamId) => this.teamRepo.findTeamByProviderId('fifa-calendar', fifaTeamId);
    const homeTeamId = resolve(data.HomeTeam?.IdTeam);
    const awayTeamId = resolve(data.AwayTeam?.IdTeam);

    const events = [];
    const goals = [...(data.HomeTeam?.Goals || []), ...(data.AwayTeam?.Goals || [])];
    for (const g of goals) {
      const scorerName = findPlayerName(data, g.IdTeam, g.IdPlayer);
      const assistName = g.IdAssistPlayer ? findPlayerName(data, g.IdTeam, g.IdAssistPlayer) : null;
      events.push({
        type: EventType.GOAL,
        team_id: resolve(g.IdTeam),
        minute: g.Minute || null,
        period: g.Period || null,
        player_name: scorerName,
        goal: { goal_type: g.Type, assist_player: assistName },
      });
    }

    const bookings = [...(data.HomeTeam?.Bookings || []), ...(data.AwayTeam?.Bookings || [])];
    for (const b of bookings) {
      events.push({
        type: EventType.BOOKING,
        team_id: resolve(b.IdTeam),
        minute: b.Minute || null,
        period: b.Period || null,
        player_name: findPlayerName(data, b.IdTeam, b.IdPlayer),
        booking: { card_type: cardType(b.Card) },
      });
    }

    const subs = [...(data.HomeTeam?.Substitutions || []), ...(data.AwayTeam?.Substitutions || [])];
    for (const s of subs) {
      const playerOffId = s.IdPlayerOff || s.PlayerOff?.IdPlayer || s.PlayerOff?.Id || null;
      const playerOnId = s.IdPlayerOn || s.PlayerOn?.IdPlayer || s.PlayerOn?.Id || null;
      const playerOff = s.PlayerOffName?.[0]?.Description || (playerOffId && findPlayerName(data, s.IdTeam, playerOffId)) || null;
      const playerOn = s.PlayerOnName?.[0]?.Description || (playerOnId && findPlayerName(data, s.IdTeam, playerOnId)) || null;
      events.push({
        type: EventType.SUB,
        team_id: resolve(s.IdTeam),
        minute: s.Minute || null,
        period: s.Period || null,
        player_name: `${playerOff} → ${playerOn}`,
        sub: { player_off: playerOff, player_on: playerOn },
      });
    }

    if (data.Penalties) {
      for (const p of data.Penalties) {
        const playerName = p.Player?.Name || p.PlayerName?.[0]?.Description || null;
        events.push({
          type: EventType.PENALTY_SHOOTOUT,
          team_id: resolve(p.Team?.Id),
          minute: null,
          period: null,
          player_name: playerName,
          penalty: { scored: !!p.Scored },
        });
      }
    }

    const lineups = [];
    for (const side of ['HomeTeam', 'AwayTeam']) {
      const team = data[side];
      if (!team) continue;
      const teamId = resolve(team.IdTeam);
      for (const player of team.Players || []) {
        lineups.push({
          team_id: teamId,
          player_name: player.PlayerName?.[0]?.Description || null,
          position: player.PositionName || positionLabel(player.Position),
          shirt_number: player.ShirtNumber || null,
          is_starter: player.Status === 1 ? 1 : 0,
        });
      }
    }

    return {
      details: {
        home_formation: data.HomeTeam?.Tactics || null,
        away_formation: data.AwayTeam?.Tactics || null,
        attendance: data.Attendance || null,
        referee: (data.Officials || [])
          .filter(o => o.OfficialType === 1)
          .map(o => o.Name?.[0]?.Description)
          .filter(Boolean)[0] || null,
      },
      events,
      lineups,
    };
  }
}
