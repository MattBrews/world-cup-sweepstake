import { getV2Db } from '../db/connection.js';

export class TeamNameAliasRepository {
  constructor() {
    this.db = getV2Db();
  }

  findByProvider(providerName, name) {
    return this.db.prepare(
      'SELECT * FROM team_name_aliases WHERE provider_name = ? AND name = ?'
    ).get(providerName, name);
  }

  findUnresolved() {
    return this.db.prepare(
      'SELECT * FROM team_name_aliases WHERE resolved = 0 ORDER BY created_at'
    ).all();
  }

  insert(providerName, name, teamId) {
    this.db.prepare(
      'INSERT OR IGNORE INTO team_name_aliases (provider_name, name, team_id, resolved, resolved_at) VALUES (?, ?, ?, 1, datetime(\'now\'))'
    ).run(providerName, name, teamId);
  }

  resolve(aliasId, teamId) {
    this.db.prepare(
      'UPDATE team_name_aliases SET team_id = ?, resolved = 1, resolved_at = datetime(\'now\') WHERE id = ?'
    ).run(teamId, aliasId);
  }

  resolveByProvider(providerName, name, teamId) {
    this.db.prepare(
      'UPDATE team_name_aliases SET team_id = ?, resolved = 1, resolved_at = datetime(\'now\') WHERE provider_name = ? AND name = ?'
    ).run(teamId, providerName, name);
  }
}
