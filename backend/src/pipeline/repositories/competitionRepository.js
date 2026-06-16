import { getDb } from '../../db/connection.js';

export class CompetitionRepository {
  constructor() {
    this.db = getDb();
  }

  findAll() {
    return this.db.prepare(`
      SELECT * FROM competitions 
      ORDER BY name
    `).all();
  }

  findById(id) {
    const comp = this.db.prepare(`SELECT * FROM competitions WHERE id = ?`).get(id);
    if (!comp) return null;
    
    comp.mappings = this.getMappings(id);
    return comp;
  }

  findBySlug(slug) {
    const comp = this.db.prepare(`SELECT * FROM competitions WHERE slug = ?`).get(slug);
    if (!comp) return null;

    comp.mappings = this.getMappings(comp.id);
    return comp;
  }

  create({ name, slug, sport, season, active = 1 }) {
    const info = this.db.prepare(`
      INSERT INTO competitions (name, slug, sport, season, active)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, slug, sport, season || null, active);
    return info.lastInsertRowid;
  }

  update(id, data) {
    const fields = [];
    const values = [];
    
    for (const key of ['name', 'slug', 'sport', 'season', 'active']) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(data[key]);
      }
    }
    
    if (fields.length === 0) return;
    values.push(id);
    
    this.db.prepare(`
      UPDATE competitions 
      SET ${fields.join(', ')} 
      WHERE id = ?
    `).run(...values);
  }

  delete(id) {
    this.db.prepare(`DELETE FROM competitions WHERE id = ?`).run(id);
  }

  getMappings(competitionId) {
    return this.db.prepare(`
      SELECT data_type, provider_name, external_id, created_at
      FROM competition_provider_mappings
      WHERE competition_id = ?
    `).all(competitionId);
  }

  setMapping(competitionId, dataType, providerName, externalId) {
    this.db.prepare(`
      INSERT OR REPLACE INTO competition_provider_mappings 
        (competition_id, data_type, provider_name, external_id)
      VALUES (?, ?, ?, ?)
    `).run(competitionId, dataType, providerName, String(externalId));
  }

  getMapping(competitionId, dataType) {
    return this.db.prepare(`
      SELECT provider_name, external_id
      FROM competition_provider_mappings
      WHERE competition_id = ? AND data_type = ?
    `).get(competitionId, dataType);
  }

  removeMapping(competitionId, dataType) {
    this.db.prepare(`
      DELETE FROM competition_provider_mappings
      WHERE competition_id = ? AND data_type = ?
    `).run(competitionId, dataType);
  }
}
