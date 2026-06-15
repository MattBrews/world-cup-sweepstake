import fetch from 'node-fetch';
import { FixtureProvider } from './interfaces/fixtureProvider.js';
import { Stage } from '../constants/enums.js';

const DATA_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

export class OpenFootballFixtureProvider extends FixtureProvider {
  constructor(fetchPromise) {
    super();
    this._fetchPromise = fetchPromise;
  }

  async getFixtures() {
    if (!this._fetchPromise) {
      this._fetchPromise = fetch(DATA_URL).then(r => {
        if (!r.ok) throw new Error(`openfootball fetch error ${r.status}`);
        return r.json();
      });
    }
    const data = await this._fetchPromise;
    return (data.matches || []).map(m => ({
      team1: m.team1,
      team2: m.team2,
      round: m.round || null,
      stage: matchStage(m.round),
      date: parseDate(m.date, m.time),
      venue: m.ground || null,
      group: m.group || null,
      score: m.score?.ft ? { home: m.score.ft[0], away: m.score.ft[1] } : null,
    }));
  }
}

function parseDate(dateStr, timeStr) {
  if (!timeStr) return new Date(dateStr + 'T12:00:00Z').toISOString();
  const t = timeStr.match(/(\d{2}):(\d{2})\s*UTC([+-]\d+)/);
  if (!t) return new Date(dateStr + 'T12:00:00Z').toISOString();
  const d = new Date(Date.UTC(
    parseInt(dateStr.slice(0, 4)),
    parseInt(dateStr.slice(5, 7)) - 1,
    parseInt(dateStr.slice(8, 10)),
    parseInt(t[1]) - parseInt(t[3]),
    parseInt(t[2])
  ));
  return d.toISOString();
}

function matchStage(round) {
  if (!round) return Stage.GROUP_STAGE;
  const r = round.toLowerCase();
  if (r.includes('matchday')) return Stage.GROUP_STAGE;
  if (r.includes('round of 32')) return Stage.ROUND_OF_32;
  if (r.includes('round of 16')) return Stage.ROUND_OF_16;
  if (r.includes('quarter')) return Stage.QUARTER_FINALS;
  if (r.includes('semi')) return Stage.SEMI_FINALS;
  if (r.includes('3rd') || r.includes('third')) return Stage.THIRD_PLACE;
  if (r.includes('final')) return Stage.FINAL;
  return Stage.GROUP_STAGE;
}
