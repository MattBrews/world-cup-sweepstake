import { randomBytes } from 'node:crypto';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const db = new Database(path.join(__dirname, '.data', 'sweepstakes.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const sweep = db.prepare("SELECT id, slug, public_id FROM sweepstakes WHERE slug = 'office-pool'").get();
if (!sweep) {
  console.error('Sweepstake "office-pool" not found');
  process.exit(1);
}

console.log(`Using sweepstake: ${sweep.slug} (${sweep.public_id})`);

const teams = db.prepare('SELECT id, name FROM cached_teams ORDER BY id').all();
console.log(`Found ${teams.length} teams`);

const people = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];

db.prepare('DELETE FROM participants WHERE sweepstake_id = ?').run(sweep.id);

const insert = db.prepare(
  'INSERT INTO participants (sweepstake_id, name, team_id, team_name, prediction_token) VALUES (?, ?, ?, ?, ?)'
);

const insertMany = db.transaction((teams) => {
  for (let i = 0; i < teams.length; i++) {
    const person = people[i % people.length];
    const token = randomBytes(6).toString('hex');
    insert.run(sweep.id, person, teams[i].id, teams[i].name, token);
  }
});

insertMany(teams);

const count = db.prepare('SELECT COUNT(*) as c FROM participants WHERE sweepstake_id = ?').get(sweep.id);
console.log(`Assigned ${count.c} teams to ${people.length} people`);

const perPerson = db.prepare(
  'SELECT name, COUNT(*) as cnt FROM participants WHERE sweepstake_id = ? GROUP BY name ORDER BY name'
).all(sweep.id);
for (const p of perPerson) {
  console.log(`  ${p.name}: ${p.cnt} teams`);
}

db.close();
console.log('Done!');
