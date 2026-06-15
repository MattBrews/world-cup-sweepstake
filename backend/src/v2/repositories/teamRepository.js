import { getV2Db } from '../db/connection.js';

export class TeamRepository {
  constructor() {
    this.db = getV2Db();
  }

  findById(id) {
    return this.db.prepare('SELECT * FROM teams WHERE id = ?').get(id);
  }

  findByName(name) {
    return this.db.prepare('SELECT * FROM teams WHERE name = ?').get(name);
  }

  resolveId(id) {
    const row = this.db.prepare('SELECT COALESCE(parent_team_id, id) AS effective_id FROM teams WHERE id = ?').get(id);
    return row ? row.effective_id : null;
  }

  upsert(team, sourceProvider) {
    const { name, code, logo_url } = team;
    const existing = this.findByName(name);
    if (existing) {
      this.db.prepare('UPDATE teams SET code = COALESCE(?, code), logo_url = COALESCE(?, logo_url) WHERE id = ?')
        .run(code || null, logo_url || null, existing.id);
      return existing.id;
    }
    const alias = this.db.prepare(
      'SELECT team_id FROM team_name_aliases WHERE provider_name = ? AND name = ? AND resolved = 1'
    ).get(sourceProvider, name);
    if (alias) {
      return alias.team_id;
    }
    const info = this.db.prepare(
      'INSERT INTO teams (name, code, logo_url) VALUES (?, ?, ?)'
    ).run(name, code || null, logo_url || null);
    return info.lastInsertRowid;
  }

  setParentTeamId(duplicateId, canonicalId) {
    this.db.prepare('UPDATE teams SET parent_team_id = ? WHERE id = ?').run(canonicalId, duplicateId);
  }

  storeProviderId(teamId, providerName, providerId) {
    this.db.prepare(
      'INSERT OR REPLACE INTO team_provider_ids (team_id, provider_name, provider_id) VALUES (?, ?, ?)'
    ).run(teamId, providerName, String(providerId));
  }

  findTeamByProviderId(providerName, providerId) {
    const row = this.db.prepare(
      'SELECT team_id FROM team_provider_ids WHERE provider_name = ? AND provider_id = ?'
    ).get(providerName, String(providerId));
    return row ? row.team_id : null;
  }

  getAll() {
    return this.db.prepare('SELECT * FROM teams ORDER BY name').all();
  }
}
