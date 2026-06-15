import fetch from 'node-fetch';

const DELAY_MS = 300;

export class FifaLiveClient {
  constructor() {
    this._lastCall = 0;
  }

  async _throttle() {
    const now = Date.now();
    const elapsed = now - this._lastCall;
    if (elapsed < DELAY_MS) {
      await new Promise(r => setTimeout(r, DELAY_MS - elapsed));
    }
    this._lastCall = Date.now();
  }

  async fetch(url) {
    await this._throttle();
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
  }
}
