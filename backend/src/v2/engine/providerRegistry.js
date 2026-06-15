import { ProviderName } from '../constants/enums.js';

export class ProviderRegistry {
  constructor() {
    this._interfaces = {};
  }

  register(interfaceName, implementation) {
    this._interfaces[interfaceName] = implementation;
  }

  get(interfaceName) {
    const impl = this._interfaces[interfaceName];
    if (!impl) throw new Error(`No provider registered for ${interfaceName}`);
    return impl;
  }

  getAll() {
    return this._interfaces;
  }
}

export function createDefaultRegistry() {
  return new ProviderRegistry();
}
