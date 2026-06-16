export class FixtureProvider {
  /**
   * Get fixtures for a competition.
   * @param {string} externalCompetitionId - The provider's ID for the competition.
   * @returns {Promise<Array<object>>} Normalized fixtures.
   */
  async getFixtures(externalCompetitionId) {
    throw new Error('getFixtures not implemented');
  }
}
