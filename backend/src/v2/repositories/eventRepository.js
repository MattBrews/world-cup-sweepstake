import { getV2Db } from '../db/connection.js';

export class EventRepository {
  constructor() {
    this.db = getV2Db();
  }

  replaceEvents(fixtureId, events) {
    const del = this.db.transaction(() => {
      this.db.prepare('DELETE FROM penalty_shootout_events WHERE event_id IN (SELECT id FROM match_events WHERE fixture_id = ?)').run(fixtureId);
      this.db.prepare('DELETE FROM substitution_events WHERE event_id IN (SELECT id FROM match_events WHERE fixture_id = ?)').run(fixtureId);
      this.db.prepare('DELETE FROM booking_events WHERE event_id IN (SELECT id FROM match_events WHERE fixture_id = ?)').run(fixtureId);
      this.db.prepare('DELETE FROM goal_events WHERE event_id IN (SELECT id FROM match_events WHERE fixture_id = ?)').run(fixtureId);
      this.db.prepare('DELETE FROM match_events WHERE fixture_id = ?').run(fixtureId);
    });
    del();

    const insertEvent = this.db.prepare(`
      INSERT INTO match_events (fixture_id, team_id, type, minute, period, player_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertGoal = this.db.prepare('INSERT INTO goal_events (event_id, goal_type, assist_player) VALUES (?, ?, ?)');
    const insertBooking = this.db.prepare('INSERT INTO booking_events (event_id, card_type) VALUES (?, ?)');
    const insertSub = this.db.prepare('INSERT INTO substitution_events (event_id, player_off, player_on) VALUES (?, ?, ?)');
    const insertPenalty = this.db.prepare('INSERT INTO penalty_shootout_events (event_id, scored) VALUES (?, ?)');

    const write = this.db.transaction(() => {
      for (const ev of events) {
        const info = insertEvent.run(ev.fixture_id || fixtureId, ev.team_id || null, ev.type, ev.minute || null, ev.period || null, ev.player_name || null);
        const eventId = info.lastInsertRowid;
        if (ev.type === 'GOAL' && ev.goal) {
          insertGoal.run(eventId, ev.goal.goal_type, ev.goal.assist_player || null);
        }
        if (ev.type === 'BOOKING' && ev.booking) {
          insertBooking.run(eventId, ev.booking.card_type);
        }
        if (ev.type === 'SUB' && ev.sub) {
          insertSub.run(eventId, ev.sub.player_off, ev.sub.player_on);
        }
        if (ev.type === 'PENALTY_SHOOTOUT' && ev.penalty !== undefined) {
          insertPenalty.run(eventId, ev.penalty.scored ? 1 : 0);
        }
      }
    });
    write();
  }

  getByFixtureId(fixtureId) {
    const rows = this.db.prepare('SELECT * FROM match_events WHERE fixture_id = ? ORDER BY id').all(fixtureId);
    return rows.map(r => ({
      ...r,
      goal: r.type === 'GOAL' ? this.db.prepare('SELECT * FROM goal_events WHERE event_id = ?').get(r.id) : undefined,
      booking: r.type === 'BOOKING' ? this.db.prepare('SELECT * FROM booking_events WHERE event_id = ?').get(r.id) : undefined,
      sub: r.type === 'SUB' ? this.db.prepare('SELECT * FROM substitution_events WHERE event_id = ?').get(r.id) : undefined,
      penalty: r.type === 'PENALTY_SHOOTOUT' ? this.db.prepare('SELECT * FROM penalty_shootout_events WHERE event_id = ?').get(r.id) : undefined,
    }));
  }
}
