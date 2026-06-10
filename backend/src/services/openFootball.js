import fetch from 'node-fetch';
import { getDb } from '../db/connection.js';

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

let nextId = 0;
const teamCache = {};

function ensureTeam(name, gl, db) {
  if (teamCache[name]) return teamCache[name];
  const id = ++nextId;
  const code = FLAGS[name] || null;
  const logoUrl = code ? `${FLAG_BASE}/${code}.svg` : null;
  teamCache[name] = id;
  db.prepare(
    `INSERT OR REPLACE INTO cached_teams (id, name, code, logo_url, group_letter)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, name, code, logoUrl, gl);
  return id;
}

export async function fetchAndSync() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`openfootball fetch error ${res.status}`);
  const data = await res.json();
  const matches = data.matches || [];

  const db = getDb();
  db.prepare('DELETE FROM cached_teams').run();
  db.prepare('DELETE FROM cached_fixtures').run();
  db.prepare('DELETE FROM cached_standings').run();

  nextId = 0;
  Object.keys(teamCache).forEach(k => delete teamCache[k]);

  const teamGroups = {};
  for (const m of matches) {
    if (!m.group) continue;
    const gl = groupLetter(m.group);
    if (!gl) continue;
    if (!teamGroups[m.team1]) teamGroups[m.team1] = gl;
    if (!teamGroups[m.team2]) teamGroups[m.team2] = gl;
  }

  for (const [name, gl] of Object.entries(teamGroups)) {
    ensureTeam(name, gl, db);
  }

  const ins = db.prepare(
    `INSERT OR REPLACE INTO cached_fixtures
     (id, round, stage, date, home_team_id, away_team_id, home_score, away_score, status, venue, home_placeholder, away_placeholder)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let fid = 0;
  for (const m of matches) {
    fid++;
    const score = matchScore(m);
    const homeId = teamCache[m.team1];
    const awayId = teamCache[m.team2];
    ins.run(
      fid,
      m.round,
      matchStage(m.round),
      parseDate(m.date, m.time),
      homeId || null,
      awayId || null,
      score.home,
      score.away,
      matchStatus(m),
      m.ground || null,
      homeId ? null : m.team1 || null,
      awayId ? null : m.team2 || null
    );
  }

  const standingsIns = db.prepare(
    `INSERT INTO cached_standings
     (group_letter, team_id, rank, points, played, win, draw, lose, goals_for, goals_against, goal_diff)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const groupMatches = {};
  for (const m of matches) {
    if (!m.group) continue;
    const gl = groupLetter(m.group);
    if (!gl) continue;
    if (!groupMatches[gl]) groupMatches[gl] = [];
    groupMatches[gl].push(m);
  }

  let standingCount = 0;

  for (const [gl, gms] of Object.entries(groupMatches)) {
    const stats = {};

    for (const m of gms) {
      const h = teamCache[m.team1];
      const a = teamCache[m.team2];
      if (!h || !a) continue;

      if (!stats[h]) stats[h] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
      if (!stats[a]) stats[a] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };

      const s = matchScore(m);
      if (s.home !== null && s.away !== null) {
        stats[h].p++; stats[a].p++;
        stats[h].gf += s.home; stats[h].ga += s.away;
        stats[a].gf += s.away; stats[a].ga += s.home;

        if (s.home > s.away) { stats[h].w++; stats[h].pts += 3; stats[a].l++; }
        else if (s.home < s.away) { stats[a].w++; stats[a].pts += 3; stats[h].l++; }
        else { stats[h].d++; stats[h].pts++; stats[a].d++; stats[a].pts++; }
      }
    }

    const sorted = Object.entries(stats)
      .map(([tid, s]) => ({
        tid: +tid, ...s, gd: s.gf - s.ga,
      }))
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

    sorted.forEach((s, i) => {
      standingsIns.run(gl, s.tid, i + 1, s.pts, s.p, s.w, s.d, s.l, s.gf, s.ga, s.gd);
      standingCount++;
    });
  }

  return {
    teams: Object.keys(teamCache).length,
    fixtures: fid,
    standings: standingCount,
  };
}
