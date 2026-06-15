import { getV2Db } from '../db/connection.js';

export class SyncEngineV2 {
  constructor(providers, repos) {
    this.providers = providers;
    this.teamRepo = repos.teamRepo;
    this.fixtureRepo = repos.fixtureRepo;
    this.liveRepo = repos.liveRepo;
    this.outcomeRepo = repos.outcomeRepo;
    this.eventRepo = repos.eventRepo;
    this.detailsRepo = repos.detailsRepo;
    this.lineupRepo = repos.lineupRepo;
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

      const compId = await this._ensureCompetition();

      if (this.providers.get('fixtures')) {
        const fixtures = await this.providers.get('fixtures').getFixtures();
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

          this.liveRepo.upsert({
            fixture_id: fixtureId,
            home_score: f.score?.home ?? null,
            away_score: f.score?.away ?? null,
            status: f.score ? 'FT' : 'SCHEDULED',
          });
          if (f.score) {
            this.outcomeRepo.snapshot(fixtureId);
          }
        }
        logSync('openfootball', 'syncFixtures', 'ok', fixtures.length);
      }

      if (this.providers.get('mappings')) {
        const result = await this.providers.get('mappings').syncMappings(compId);
        logSync('fifa-calendar', 'syncMappings', 'ok', result.fixtureMappings);
      }

      if (this.providers.get('tv')) {
        const channels = await this.providers.get('tv').getTvChannels();
        let updated = 0;
        for (const c of channels) {
          const fixture = this.fixtureRepo.findFixtureByProviderId('fifa-calendar', c.matchId);
          if (fixture) {
            this.fixtureRepo.updateTvChannel(fixture.id, c.channel);
            updated++;
          }
        }
        logSync('fifa-tv', 'syncTvChannels', 'ok', updated);
      }

      return { status: 'ok' };
    } catch (err) {
      logSync('fullSync', 'error', err.message);
      throw err;
    }
  }

  async liveSync() {
    const fixtures = this.fixtureRepo.findAwaitingOrLive();
    if (fixtures.length === 0) return { updated: 0 };

    const matchIds = [];
    const fixtureById = {};
    for (const f of fixtures) {
      const pid = this.db.prepare(
        "SELECT provider_match_id FROM fixture_provider_ids WHERE fixture_id = ? AND provider_name = 'fifa-live' OR provider_name = 'fifa-calendar'"
      ).get(f.id);
      if (pid) {
        matchIds.push(pid.provider_match_id);
        fixtureById[pid.provider_match_id] = f;
      }
    }

    if (matchIds.length === 0 || !this.providers.get('scores')) return { updated: 0 };

    const liveData = await this.providers.get('scores').getLiveScores(matchIds);
    let updated = 0;

    for (const ld of liveData) {
      const fixture = fixtureById[ld.matchId];
      if (!fixture) continue;

      const prevStatus = this.liveRepo.getByFixtureId(fixture.id)?.status;
      this.liveRepo.upsert({
        fixture_id: fixture.id,
        home_score: ld.homeScore,
        away_score: ld.awayScore,
        home_ht_score: ld.homeHtScore,
        away_ht_score: ld.awayHtScore,
        status: ld.status,
        current_minute: ld.currentMinute,
        period: ld.period,
      });

      if (ld.status === 'FT' && prevStatus !== 'FT') {
        this.outcomeRepo.snapshot(fixture.id);
      }
      if (ld.status === 'LIVE' && prevStatus === 'AWAITING') {
        this.outcomeRepo.snapshot(fixture.id);
      }

      updated++;
    }

    return { updated };
  }

  async detailSync() {
    const fixtures = this.fixtureRepo.findFtWithoutDetails(30);
    if (fixtures.length === 0) return { updated: 0 };

    const matchIds = [];
    const fixtureById = {};
    for (const f of fixtures) {
      const pid = this.db.prepare(
        "SELECT provider_match_id FROM fixture_provider_ids WHERE fixture_id = ? AND (provider_name = 'fifa-live' OR provider_name = 'fifa-calendar')"
      ).get(f.id);
      if (pid) {
        matchIds.push(pid.provider_match_id);
        fixtureById[pid.provider_match_id] = f;
      }
    }

    if (matchIds.length === 0 || !this.providers.get('details')) return { updated: 0 };

    let updated = 0;
    for (const matchId of matchIds) {
      const fixture = fixtureById[matchId];
      if (!fixture) continue;

      const matchData = await this.providers.get('details').getMatchData(matchId);
      if (!matchData) continue;

      this.detailsRepo.upsert(fixture.id, matchData.details);
      this.eventRepo.replaceEvents(fixture.id, matchData.events);
      this.lineupRepo.replaceLineups(fixture.id, matchData.lineups);
      this.outcomeRepo.markComplete(fixture.id);
      updated++;
    }

    return { updated };
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
