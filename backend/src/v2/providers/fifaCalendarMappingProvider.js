import { TeamMappingProvider } from './interfaces/teamMappingProvider.js';
import { FifaLiveClient } from './clients/fifaLiveClient.js';

const SEASON_ID = '285023';

export class FifaCalendarMappingProvider extends TeamMappingProvider {
  constructor(client, teamRepo, fixtureRepo, aliasRepo) {
    super();
    this.client = client || new FifaLiveClient();
    this.teamRepo = teamRepo;
    this.fixtureRepo = fixtureRepo;
    this.aliasRepo = aliasRepo;
  }

  async getMappings() {
    const data = await this.client.fetch(
      `https://api.fifa.com/api/v3/calendar/matches?idSeason=${SEASON_ID}&count=500&language=en`
    );
    if (!data) return [];
    return (data.Results || []).map(m => ({
      matchId: m.IdMatch,
      date: m.Date,
      homeTeam: m.Home?.TeamName?.[0]?.Description,
      awayTeam: m.Away?.TeamName?.[0]?.Description,
      homeFifaTeamId: m.Home?.IdTeam,
      awayFifaTeamId: m.Away?.IdTeam,
    }));
  }

  async syncMappings(competitionId) {
    const mappings = await this.getMappings();
    let teamMappings = 0;
    let fixtureMappings = 0;
    let newTeams = 0;

    for (const m of mappings) {
      const homeTeamId = await this._resolveTeam(m.homeTeam, m.homeFifaTeamId);
      const awayTeamId = await this._resolveTeam(m.awayTeam, m.awayFifaTeamId);
      if (homeTeamId) teamMappings++;
      if (awayTeamId) teamMappings++;
      if (!homeTeamId || !awayTeamId) continue;

      const date = m.date ? m.date.slice(0, 10) : null;
      const fixture = this.fixtureRepo.findByComposite(competitionId, homeTeamId, awayTeamId, date, null);
      if (fixture) {
        this.fixtureRepo.storeProviderId(fixture.id, 'fifa-calendar', m.matchId);
        fixtureMappings++;
      }
    }

    return { teamMappings, fixtureMappings, newTeams };
  }

  async _resolveTeam(name, fifaTeamId) {
    if (!name) return null;

    const byProviderId = this.teamRepo.findTeamByProviderId('fifa-calendar', fifaTeamId);
    if (byProviderId) return byProviderId;

    const byName = this.teamRepo.findByName(name);
    if (byName) {
      this.teamRepo.storeProviderId(byName.id, 'fifa-calendar', fifaTeamId);
      this.aliasRepo.insert('fifa-calendar', name, byName.id);
      return byName.id;
    }

    const alias = this.aliasRepo.findByProvider('fifa-calendar', name);
    if (alias && alias.resolved && alias.team_id) {
      return alias.team_id;
    }

    const ourName = this._ourName(name);
    if (ourName !== name) {
      const byOurName = this.teamRepo.findByName(ourName);
      if (byOurName) {
        this.teamRepo.storeProviderId(byOurName.id, 'fifa-calendar', fifaTeamId);
        this.aliasRepo.insert('fifa-calendar', name, byOurName.id);
        return byOurName.id;
      }
    }

    const newTeamId = this.teamRepo.upsert({ name, code: null, logo_url: null }, 'fifa-calendar');
    this.teamRepo.storeProviderId(newTeamId, 'fifa-calendar', fifaTeamId);
    this.aliasRepo.insert('fifa-calendar', name, newTeamId);
    return newTeamId;
  }

  _ourName(fifaName) {
    const map = {
      'Korea Republic': 'South Korea',
      'Czechia': 'Czech Republic',
      'Bosnia and Herzegovina': 'Bosnia & Herzegovina',
      'Türkiye': 'Turkey',
      "Côte d'Ivoire": 'Ivory Coast',
      'IR Iran': 'Iran',
      'Cabo Verde': 'Cape Verde',
      'Congo DR': 'DR Congo',
      'USA': 'USA',
    };
    return map[fifaName] || fifaName;
  }
}
