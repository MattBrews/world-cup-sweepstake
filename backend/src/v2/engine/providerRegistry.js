import { ProviderName } from '../constants/enums.js';

export class ProviderRegistry {
  constructor() {
    this._interfaces = {};
  }

  register(interfaceName, implementation) {
    this._interfaces[interfaceName] = implementation;
  }

  get(interfaceName) {
    return this._interfaces[interfaceName] || null;
  }

  getAll() {
    return this._interfaces;
  }
}

export function createDefaultRegistry() {
  return new ProviderRegistry();
}
