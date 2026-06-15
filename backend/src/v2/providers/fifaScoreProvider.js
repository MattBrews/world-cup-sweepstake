import { ScoreProvider } from './interfaces/scoreProvider.js';
import { FixtureStatus } from '../constants/enums.js';
import { FifaLiveClient } from './clients/fifaLiveClient.js';

export class FifaScoreProvider extends ScoreProvider {
  constructor(client, teamRepo) {
    super();
    this.client = client || new FifaLiveClient();
    this.teamRepo = teamRepo;
  }

  async getLiveScores(matchIds) {
    const results = [];
    for (const matchId of matchIds) {
      const data = await this.client.fetch(
        `https://api.fifa.com/api/v3/live/football/${matchId}`
      );
      if (!data) continue;

      const homeScore = data.HomeTeam?.Score ?? null;
      const awayScore = data.AwayTeam?.Score ?? null;
      const period = data.Period;
      const matchTime = data.MatchTime || data.MatchMinute || data.Minute || null;

      let status = FixtureStatus.AWAITING;
      if (period != null) {
        if (period >= 10) {
          status = FixtureStatus.FT;
        } else if (period > 0) {
          status = FixtureStatus.LIVE;
        }
      } else {
        const ms = data.MatchStatus || '';
        const su = String(ms).toUpperCase();
        if (su === 'FT' || su === 'AET' || su === 'AP') status = FixtureStatus.FT;
        else if (su.includes('LIVE') || su.includes('IN-PLAY') || su.includes('1ST') ||
                 su.includes('2ND') || su.includes('HALF') || su.includes('EXTRA')) status = FixtureStatus.LIVE;
      }

      let currentMinute = matchTime != null ? parseInt(String(matchTime)) || 0 : null;
      if (currentMinute == null || currentMinute <= 45) {
        const allEvents = [
          ...(data.HomeTeam?.Goals || []).map(g => g.Minute),
          ...(data.AwayTeam?.Goals || []).map(g => g.Minute),
          ...(data.HomeTeam?.Bookings || []).map(b => b.Minute),
          ...(data.AwayTeam?.Bookings || []).map(b => b.Minute),
        ].filter(Boolean);
        const parsed = allEvents.map(m => {
          const str = String(m);
          const match = str.match(/^(\d+)(?:\+(\d+))?/);
          if (!match) return 0;
          return parseInt(match[1]) + (match[2] ? parseInt(match[2]) : 0);
        });
        const eventMax = parsed.length > 0 ? Math.max(...parsed) : null;
        if (eventMax && (!currentMinute || eventMax > currentMinute)) {
          currentMinute = eventMax;
        }
      }

      results.push({
        matchId,
        homeScore,
        awayScore,
        homeHtScore: null,
        awayHtScore: null,
        status,
        currentMinute,
        period,
        data,
      });
    }
    return results;
  }
}
