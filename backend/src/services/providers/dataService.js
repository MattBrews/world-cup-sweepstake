export class DataService {
  get name() {
    throw new Error('Must implement name getter');
  }

  async getFixtures() {
    return null;
  }

  async getTvChannels() {
    return null;
  }

  async getScores(matchId) {
    return null;
  }

  async getMatchStatus(matchId) {
    return null;
  }

  async getEvents(matchId) {
    return null;
  }

  async getLineups(matchId) {
    return null;
  }
}

export const MATCH_STATUS = {
  SCHEDULED: 'SCHEDULED',
  AWAITING: 'AWAITING',
  IN_PROGRESS: 'IN_PROGRESS',
  FT: 'FT',
  COMPLETE: 'COMPLETE',
};
