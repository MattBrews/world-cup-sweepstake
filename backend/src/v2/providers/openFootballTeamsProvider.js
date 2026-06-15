import fetch from 'node-fetch';
import { TeamsProvider } from './interfaces/teamsProvider.js';

const DATA_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

const FLAGS = {
  'Mexico': 'mx', 'South Africa': 'za', 'South Korea': 'kr', 'Czech Republic': 'cz',
  'Canada': 'ca', 'Bosnia & Herzegovina': 'ba', 'Qatar': 'qa', 'Switzerland': 'ch',
  'Brazil': 'br', 'Morocco': 'ma', 'Haiti': 'ht', 'Scotland': 'gb-sct',
  'USA': 'us', 'Paraguay': 'py', 'Australia': 'au', 'Turkey': 'tr',
  'Germany': 'de', 'Curaçao': 'cw', 'Ivory Coast': 'ci', 'Ecuador': 'ec',
  'Netherlands': 'nl', 'Japan': 'jp', 'Sweden': 'se', 'Tunisia': 'tn',
  'Belgium': 'be', 'Egypt': 'eg', 'Iran': 'ir', 'New Zealand': 'nz',
  'Spain': 'es', 'Cape Verde': 'cv', 'Saudi Arabia': 'sa', 'Uruguay': 'uy',
  'France': 'fr', 'Senegal': 'sn', 'Iraq': 'iq', 'Norway': 'no',
  'Argentina': 'ar', 'Algeria': 'dz', 'Austria': 'at', 'Jordan': 'jo',
  'Portugal': 'pt', 'DR Congo': 'cd', 'Uzbekistan': 'uz', 'Colombia': 'co',
  'England': 'gb-eng', 'Croatia': 'hr', 'Ghana': 'gh', 'Panama': 'pa',
};

export class OpenFootballTeamsProvider extends TeamsProvider {
  constructor(fetchPromise) {
    super();
    this._fetchPromise = fetchPromise;
  }

  async getTeams() {
    if (!this._fetchPromise) {
      this._fetchPromise = fetch(DATA_URL).then(r => {
        if (!r.ok) throw new Error(`openfootball fetch error ${r.status}`);
        return r.json();
      });
    }
    const data = await this._fetchPromise;
    const seen = {};
    for (const m of data.matches || []) {
      for (const name of [m.team1, m.team2]) {
        if (!seen[name] && FLAGS[name]) {
          const code = FLAGS[name];
          const logoUrl = `https://hatscripts.github.io/circle-flags/flags/${code}.svg`;
          seen[name] = { name, code, logo_url: logoUrl };
        }
      }
    }
    return Object.values(seen);
  }
}
