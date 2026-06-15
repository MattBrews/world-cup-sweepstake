import { getV2Db } from './db/connection.js';
import { runV2Migrations } from './db/schema.js';
import { TeamRepository } from './repositories/teamRepository.js';
import { FixtureRepository } from './repositories/fixtureRepository.js';

const flag = process.argv[2];
runV2Migrations();

async function main() {
  switch (flag) {
    case '--dump': {
      const db = getV2Db();
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      ).all();
      for (const { name } of tables) {
        console.log(`\n=== ${name} ===`);
        const rows = db.prepare(`SELECT * FROM ${name} LIMIT 20`).all();
        console.table(rows);
      }
      break;
    }
    case '--fixtures': {
      const repo = new FixtureRepository();
      console.table(repo.getAll());
      break;
    }
    case '--teams': {
      const repo = new TeamRepository();
      console.table(repo.getAll());
      const db = getV2Db();
      const aliases = db.prepare('SELECT * FROM team_name_aliases ORDER BY provider_name').all();
      if (aliases.length) {
        console.log('\n=== Team Name Aliases ===');
        console.table(aliases);
      }
      break;
    }
    case '--sync-stats': {
      const db = getV2Db();
      const log = db.prepare('SELECT * FROM sync_log ORDER BY created_at DESC LIMIT 20').all();
      console.table(log);
      break;
    }
    default:
      console.log('Usage: node backend/src/v2/console.js [--dump|--fixtures|--teams|--sync-stats]');
  }
}

main().catch(e => console.error(e));
