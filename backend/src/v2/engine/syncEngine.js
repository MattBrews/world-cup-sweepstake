import { getV2Db } from '../db/connection.js';

export class SyncEngineV2 {
  constructor(providers, repos) {
    this.providers = providers;
    this.teamRepo = repos.teamRepo;
    this.fixtureRepo = repos.fixtureRepo;
    this.liveRepo = repos.liveRepo;
    this.outcomeRepo = repos.outcomeRepo;
    this.aliasRepo = repos.aliasRepo;
    this.db = getV2Db();
  }

  async fullSync() {
    const startedAt = Date.now();
    const logSync = (provider, operation, status, count) => {
      this.db.prepare(`
        INSERT INTO sync_log (provider, operation, status, items_count, duration_ms)
        VALUES (?, ?, ?, ?, ?)
      `).run(provider, operation, status, count || 0, Date.now() - startedAt);
    };

    try {
      if (this.providers.get('teams')) {
        const teams = await this.providers.get('teams').getTeams();
        for (const team of teams) {
          const teamId = this.teamRepo.upsert(team, 'openfootball');
          this.teamRepo.storeProviderId(teamId, 'openfootball', team.name);
          this.aliasRepo.insert('openfootball', team.name, teamId);
        }
        logSync('openfootball', 'syncTeams', 'ok', teams.length);
      }

      if (this.providers.get('fixtures')) {
        const fixtures = await this.providers.get('fixtures').getFixtures();
        const compId = await this._ensureCompetition();
        for (const f of fixtures) {
          const homeTeam = this.teamRepo.findByName(f.team1);
          const awayTeam = this.teamRepo.findByName(f.team2);
          const fixtureId = this.fixtureRepo.upsert({
            round: f.round,
            stage: f.stage,
            date: f.date,
            venue: f.venue,
            home_team_id: homeTeam?.id || null,
            away_team_id: awayTeam?.id || null,
            home_placeholder: homeTeam ? null : f.team1,
            away_placeholder: awayTeam ? null : f.team2,
          }, compId);

          if (f.score) {
            this.liveRepo.upsert({
              fixture_id: fixtureId,
              home_score: f.score.home,
              away_score: f.score.away,
              status: 'FT',
            });
            this.outcomeRepo.snapshot(fixtureId);
          }
        }
        logSync('openfootball', 'syncFixtures', 'ok', fixtures.length);
      }

      if (this.providers.get('mappings')) {
        const mappings = await this.providers.get('mappings').getMappings();
        for (const m of mappings) {
          const homeTeam = this.teamRepo.findByName(m.homeTeam);
          const awayTeam = this.teamRepo.findByName(m.awayTeam);
          if (!homeTeam || !awayTeam) continue;
          const fixture = this.fixtureRepo.findByComposite(1, homeTeam.id, awayTeam.id, m.date, m.round);
          if (fixture) {
            this.fixtureRepo.storeProviderId(fixture.id, m.providerName, m.providerMatchId);
          }
        }
        logSync('providers', 'syncMappings', 'ok', mappings.length);
      }

      if (this.providers.get('tv')) {
        const channels = await this.providers.get('tv').getTvChannels();
        for (const { fixtureId, channel } of channels) {
          this.fixtureRepo.updateTvChannel(fixtureId, channel);
        }
        logSync('providers', 'syncTvChannels', 'ok', channels.length);
      }

      return { status: 'ok' };
    } catch (err) {
      logSync('fullSync', 'error', err.message);
      throw err;
    }
  }

  async _ensureCompetition() {
    const existing = this.db.prepare("SELECT id FROM competitions WHERE slug = 'world-cup-2026'").get();
    if (existing) return existing.id;
    const info = this.db.prepare(
      "INSERT INTO competitions (name, slug, sport, season) VALUES ('World Cup 2026', 'world-cup-2026', 'football', '2026')"
    ).run();
    return info.lastInsertRowid;
  }
}
