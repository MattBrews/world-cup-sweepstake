import { runV2Migrations } from './db/schema.js';

export { getV2Db } from './db/connection.js';
export { runV2Migrations } from './db/schema.js';
export { TeamRepository } from './repositories/teamRepository.js';
export { TeamNameAliasRepository } from './repositories/teamNameAliasRepository.js';
export { FixtureRepository } from './repositories/fixtureRepository.js';
export { FixtureLiveRepository } from './repositories/fixtureLiveRepository.js';
export { OutcomeRepository } from './repositories/outcomeRepository.js';
export { EventRepository } from './repositories/eventRepository.js';
export { DetailsRepository } from './repositories/detailsRepository.js';
export { LineupRepository } from './repositories/lineupRepository.js';
export { SyncEngineV2 } from './engine/syncEngine.js';
export { ProviderRegistry, createDefaultRegistry } from './engine/providerRegistry.js';
export { OpenFootballTeamsProvider } from './providers/openFootballTeamsProvider.js';
export { OpenFootballFixtureProvider } from './providers/openFootballFixtureProvider.js';
export { FifaLiveClient } from './providers/clients/fifaLiveClient.js';
export { FifaCalendarMappingProvider } from './providers/fifaCalendarMappingProvider.js';
export { FifaScoreProvider } from './providers/fifaScoreProvider.js';
export { FifaMatchDetailProvider } from './providers/fifaMatchDetailProvider.js';
export { FifaTvChannelProvider } from './providers/fifaTvChannelProvider.js';

export function initializeV2() {
  runV2Migrations();
  console.log('[v2] Migrations complete');
}
