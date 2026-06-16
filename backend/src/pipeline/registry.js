export class ProviderRegistry {
  constructor() {
    this.providers = {
      fixtures: {},
    };
  }

  /**
   * Register a provider instance.
   * @param {string} dataType - 'fixtures', 'teams', or 'scores'
   * @param {string} providerName - Name of the provider (e.g., 'openfootball')
   * @param {object} providerInstance - The provider instance implementation
   */
  register(dataType, providerName, providerInstance) {
    if (!this.providers[dataType]) {
      this.providers[dataType] = {};
    }
    this.providers[dataType][providerName] = providerInstance;
  }

  /**
   * Get a provider instance.
   * @param {string} dataType - 'fixtures', 'teams', or 'scores'
   * @param {string} providerName - Name of the provider
   */
  get(dataType, providerName) {
    return this.providers[dataType]?.[providerName] || null;
  }

  /**
   * Get all registered providers for a given data type.
   * @param {string} dataType - 'fixtures', 'teams', or 'scores'
   */
  getAll(dataType) {
    return this.providers[dataType] || {};
  }
}
