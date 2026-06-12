import { DataService } from './dataService.js';
import fetch from 'node-fetch';
import { getDb } from '../../db/connection.js';

const DATA_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';
const FLAG_BASE = 'https://hatscripts.github.io/circle-flags/flags';

const FLAGS = {
  'Mexico': 'mx', 'South Africa': 'za', 'South Korea': 'kr', 'Czech Republic': 'cz',
  'Canada': 'ca', 'Bosnia & Herzegovina': 'ba', 'Qatar': 'qa', 'Switzerland': 'ch',
  'Brazil': 'br', 'Morocco': 'ma', 'Haiti': 'ht',   'Scotland': 'gb-sct',
  'USA': 'us', 'Paraguay': 'py', 'Australia': 'au', 'Turkey': 'tr',
  'Germany': 'de', 'Curaçao': 'cw', 'Ivory Coast': 'ci', 'Ecuador': 'ec',
  'Netherlands': 'nl', 'Japan': 'jp', 'Sweden': 'se', 'Tunisia': 'tn',
  'Belgium': 'be', 'Egypt': 'eg', 'Iran': 'ir', 'New Zealand': 'nz',
  'Spain': 'es', 'Cape Verde': 'cv', 'Saudi Arabia': 'sa', 'Uruguay': 'uy',
  'France': 'fr', 'Senegal': 'sn', 'Iraq': 'iq', 'Norway': 'no',
  'Argentina': 'ar', 'Algeria': 'dz', 'Austria': 'at', 'Jordan': 'jo',
  'Portugal': 'pt', 'DR Congo': 'cd', 'Uzbekistan': 'uz', 'Colombia': 'co',
  'England': 'gb-eng', 'Croatia': 'hr', 'Ghana': 'gh', 'Panama': 'pa',
};

export class OpenFootballProvider extends DataService {
  get name() { return 'openfootball'; }

  async getFixtures() {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`openfootball fetch error ${res.status}`);
    const data = await res.json();
    return data.matches || [];
  }

  async syncFixtures() {
    const matches = await this.getFixtures();
    const db = getDb();

    db.prepare('DELETE FROM match_events').run();
    db.prepare('DELETE FROM match_lineups').run();
    db.prepare('DELETE FROM cached_top_scorers').run();
    db.prepare('DELETE FROM cached_standings').run();
    db.prepare('DELETE FROM cached_fixtures').run();
    db.prepare('DELETE FROM cached_teams').run();

    const teamGroups = {};
    for (const m of matches) {
      if (!m.group) continue;
      const gl = groupLetter(m.group);
      if (!gl) continue;
      if (!teamGroups[m.team1]) teamGroups[m.team1] = gl;
      if (!teamGroups[m.team2]) teamGroups[m.team2] = gl;
    }

    let nextId = 0;
    const teamCache = {};

    for (const [name, gl] of Object.entries(teamGroups)) {
      nextId++;
      const code = FLAGS[name] || null;
      const logoUrl = code ? `${FLAG_BASE}/${code}.svg` : null;
      teamCache[name] = nextId;
      db.prepare(
        `INSERT OR REPLACE INTO cached_teams (id, name, code, logo_url, group_letter)
         VALUES (?, ?, ?, ?, ?)`
      ).run(nextId, name, code, logoUrl, gl);
    }

    const ins = db.prepare(
      `INSERT OR REPLACE INTO cached_fixtures
       (id, round, stage, date, home_team_id, away_team_id, home_score, away_score, status, venue, home_placeholder, away_placeholder, lifecycle_state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    let fid = 0;
    for (const m of matches) {
      fid++;
      const score = matchScore(m);
      const homeId = teamCache[m.team1];
      const awayId = teamCache[m.team2];
      const status = matchStatus(m);
      ins.run(
        fid,
        m.round,
        matchStage(m.round),
        parseDate(m.date, m.time),
        homeId || null,
        awayId || null,
        score.home,
        score.away,
        status,
        m.ground || null,
        homeId ? null : m.team1 || null,
        awayId ? null : m.team2 || null,
        status === 'FT' ? 'FT' : 'SCHEDULED'
      );
    }

    return {
      teams: Object.keys(teamCache).length,
      fixtures: fid,
      teamCache,
    };
  }
}

function groupLetter(group) {
  const m = group?.match(/Group\s+(\w)/);
  return m ? m[1] : null;
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

function matchScore(m) {
  if (m.score?.ft) return { home: m.score.ft[0], away: m.score.ft[1] };
  return { home: null, away: null };
}

function matchStatus(m) {
  return m.score?.ft ? 'FT' : 'SCHEDULED';
}

function matchStage(round) {
  if (!round) return 'Group Stage';
  const r = round.toLowerCase();
  if (r.includes('matchday')) return 'Group Stage';
  if (r.includes('round of 32')) return 'Round of 32';
  if (r.includes('round of 16')) return 'Round of 16';
  if (r.includes('quarter')) return 'Quarter-finals';
  if (r.includes('semi')) return 'Semi-finals';
  if (r.includes('3rd') || r.includes('third')) return '3rd Place';
  if (r.includes('final')) return 'Final';
  return 'Group Stage';
}
