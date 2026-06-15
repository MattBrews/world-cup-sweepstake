import { TvChannelProvider } from './interfaces/tvChannelProvider.js';
import { FifaLiveClient } from './clients/fifaLiveClient.js';

const SEASON_ID = '285023';
const COUNTRY = 'GBR';

export class FifaTvChannelProvider extends TvChannelProvider {
  constructor(client) {
    super();
    this.client = client || new FifaLiveClient();
  }

  async getTvChannels() {
    const data = await this.client.fetch(
      `https://api.fifa.com/api/v3/watch/season/${SEASON_ID}`
    );
    if (!data) return [];

    const gbr = (data.Results || []).find(r => r.IdCountry === COUNTRY);
    if (!gbr) return [];

    return (gbr.Matches || []).map(m => {
      const sources = (m.Sources || []).map(s => s.Name).filter(Boolean);
      const main = sources.find(s => /BBC\s+(1|2)|ITV[1]?|ITV4/.test(s)) || sources[0];
      return {
        matchId: m.IdMatch,
        channel: main || null,
      };
    }).filter(c => c.channel);
  }
}
