const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export function getSweepstakes() {
  return request('/sweepstakes');
}

export function getSweepstake(slug) {
  return request(`/sweepstakes/${slug}`);
}

export function getDashboard(slug) {
  return request(`/sweepstakes/${slug}/dashboard`);
}

export function getFixtures(slug, params = {}) {
  const qs = new URLSearchParams(params).toString();
  return request(`/sweepstakes/${slug}/fixtures${qs ? `?${qs}` : ''}`);
}

export function getStandings(slug) {
  return request(`/sweepstakes/${slug}/standings`);
}

export function getRounds(slug) {
  return request(`/sweepstakes/${slug}/rounds`);
}

export function getParticipants(slug) {
  return request(`/sweepstakes/${slug}/participants`);
}

export function createSweepstake(name, slug, adminPassword) {
  return request('/sweepstakes', {
    method: 'POST',
    body: JSON.stringify({ name, slug, adminPassword }),
  });
}

export function updateSweepstake(slug, data) {
  return request(`/sweepstakes/${slug}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteSweepstake(slug) {
  return request(`/sweepstakes/${slug}`, { method: 'DELETE' });
}

export function addParticipant(slug, name, teamId, teamName) {
  return request(`/sweepstakes/${slug}/participants`, {
    method: 'POST',
    body: JSON.stringify({ name, teamId, teamName }),
  });
}

export function removeParticipant(slug, id) {
  return request(`/sweepstakes/${slug}/participants/${id}`, {
    method: 'DELETE',
  });
}

export function login(password, slug) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password, slug }),
  });
}

export function logout() {
  return request('/auth/logout', { method: 'POST' });
}

export function getSession() {
  return request('/auth/session');
}

export function triggerSync() {
  return request('/sync', { method: 'POST' });
}
