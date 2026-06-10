import fetch from 'node-fetch';
import { getDb } from '../db/connection.js';

const BASE = 'https://v3.football.api-sports.io';

function getApiKey() {
  const envKey = process.env.API_FOOTBALL_KEY;
  if (envKey) return envKey;
  try {
    const db = getDb();
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get('api_football_key');
    return row?.value || null;
  } catch {
    return null;
  }
}

export function setApiKey(key) {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('api_football_key', key);
}

export function hasApiKey() {
  return !!getApiKey();
}

async function apiFetch(endpoint, params = {}) {
  const key = getApiKey();
  if (!key) {
    throw new Error('API-Football key not configured');
  }

  const url = new URL(`${BASE}${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    headers: { 'x-apisports-key': key },
  });

  if (!res.ok) {
    throw new Error(`API-Football error ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  return data;
}

export async function getAllFixtures() {
  return apiFetch('/fixtures', { league: 1, season: 2026 });
}

export async function getLiveFixtures() {
  return apiFetch('/fixtures', { live: 'all' });
}

export async function getStandings() {
  return apiFetch('/standings', { league: 1, season: 2026 });
}

export async function getTeams() {
  return apiFetch('/teams', { league: 1, season: 2026 });
}

export async function getTopScorers() {
  return apiFetch('/players/topscorers', { league: 1, season: 2026 });
}
