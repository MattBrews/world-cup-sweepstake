import { ProviderRegistry } from './registry.js';
import { CompetitionRepository } from './repositories/competitionRepository.js';

const registry = new ProviderRegistry();
const competitionRepo = new CompetitionRepository();

export { registry, competitionRepo };
