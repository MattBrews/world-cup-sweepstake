# New Data Layer v2 — Architecture Plan

## Goals

- **Separate DB** (`sweepstakes_v2.db`) — existing V1 system untouched, dashboards unaffected
- **Incremental sync** — no more full DELETE+INSERT; proper upserts with change detection
- **Source provenance** — track exactly which provider wrote each value and when
- **Resilient providers** — retry logic, circuit breaker, per-provider health tracking
- **Abstracted storage** — Repository pattern (providers return data, don't touch DB)
- **Extensible** — football-first but designed for multiple competitions from day one
- **Comparison/validation** — run both engines, compare outputs, flag discrepancies
- **Provider-agnostic core** — all provider references in bridge tables; core data stands alone

---

## Architecture Overview

```
                                Domain Interfaces
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │ TeamsPvdr    │  │ FixturePvdr  │  │ ScorePvdr    │  │ DetailPvdr   │
  │ TvChannelPvdr│  │ MappingPvdr  │  │              │  │              │
  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
         │                 │                 │                 │
  ┌──────┴─────────────────┴─────────────────┴─────────────────┴──────┐
  │                          Sync Engine                               │
  │  fullSync() | liveSync() | detailSync() | compare()                │
  └──────┬──────────────────────────────────────────────────┬──────────┘
         │                                                  │
  ┌──────┴──────┐                                   ┌──────┴──────┐
  │ Repos       │                                   │ Comparator  │
  │ (storage)   │                                   │ (V1 vs V2)  │
  └──────┬──────┘                                   └─────────────┘
         │
  ┌──────┴──────┐
  │ DB V2       │
  │ (separate)  │
  └─────────────┘
```

---

## Directory Structure

```
backend/src/
├── v2/
│   ├── constants/
│   │   └── enums.js              # All enum definitions
│   ├── db/
│   │   ├── connection.js       # Separate DB connection (sweepstakes_v2.db)
│   │   └── schema.js           # New migrations
│   ├── providers/
│   │   ├── clients/
│   │   │   └── fifaLiveClient.js   # Shared HTTP client for api.fifa.com
│   │   ├── interfaces/
│   │   │   ├── teamsProvider.js
│   │   │   ├── fixtureProvider.js
│   │   │   ├── scoreProvider.js
│   │   │   ├── matchDetailProvider.js
│   │   │   ├── tvChannelProvider.js
│   │   │   └── teamMappingProvider.js
│   │   ├── openFootballTeamsProvider.js
│   │   ├── openFootballFixtureProvider.js
│   │   ├── fifaScoreProvider.js
│   │   ├── fifaMatchDetailProvider.js
│   │   ├── fifaTvChannelProvider.js
│   │   └── fifaCalendarMappingProvider.js
│   ├── repositories/
│   │   ├── teamRepository.js
│   │   ├── teamNameAliasRepository.js
│   │   ├── fixtureRepository.js
│   │   ├── fixtureLiveRepository.js
│   │   ├── outcomeRepository.js
│   │   ├── eventRepository.js
│   │   ├── detailsRepository.js
│   │   └── lineupRepository.js
│   ├── engine/
│   │   ├── syncEngine.js       # Orchestrator
│   │   ├── scheduler.js        # Smart timing per lifecycle
│   │   └── providerRegistry.js # Domain → implementation mapping
│   ├── validation/
│   │   └── comparator.js       # V1 DB vs V2 DB
│   ├── middleware/
│   │   └── dbRouter.js         # V1/V2 connection routing for API requests
│   ├── console.js              # CLI dump/query for validation during development
│   └── index.js                # V2 entry point
```

---

## Final Schema

```sql
─── Core ───────────────────────────────────────────────────────

CREATE TABLE teams (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL UNIQUE,  -- canonical name, e.g. 'Brazil'
  code           TEXT,                  -- e.g. 'BRA'
  logo_url       TEXT,
  parent_team_id INTEGER REFERENCES teams(id)  -- NULL = canonical; points to canonical when this is a duplicate
);

CREATE TABLE competitions (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  name   TEXT NOT NULL,               -- 'World Cup 2026'
  slug   TEXT NOT NULL UNIQUE,        -- 'world-cup-2026'
  sport  TEXT NOT NULL,               -- uses Sport enum
  season TEXT,
  active INTEGER DEFAULT 1
);

CREATE TABLE competition_teams (
  competition_id INTEGER NOT NULL REFERENCES competitions(id),
  team_id        INTEGER NOT NULL REFERENCES teams(id),
  group_letter   TEXT,                -- competition-specific
  seed           INTEGER,
  PRIMARY KEY (competition_id, team_id)
);

─── Fixtures (static definition — rarely changes) ──────────────

CREATE TABLE competition_fixtures (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_id   INTEGER NOT NULL REFERENCES competitions(id),
  round            TEXT,
  stage            TEXT,              -- uses Stage enum
  date             TEXT NOT NULL,     -- ISO 8601
  venue            TEXT,
  home_team_id     INTEGER REFERENCES teams(id),
  away_team_id     INTEGER REFERENCES teams(id),
  home_placeholder TEXT,              -- e.g. 'Winner Group A'
  away_placeholder TEXT,
  tv_channel       TEXT               -- known pre-match
);

─── Transient live state (polled frequently, may change) ──────

CREATE TABLE fixture_live (
  fixture_id     INTEGER PRIMARY KEY REFERENCES competition_fixtures(id),
  home_score     INTEGER,
  away_score     INTEGER,
  home_ht_score  INTEGER,
  away_ht_score  INTEGER,
  status         TEXT DEFAULT 'SCHEDULED',  -- SCHEDULED | AWAITING | LIVE | FT
  current_minute INTEGER,
  period         INTEGER,
  updated_at     TEXT DEFAULT (datetime('now'))
);

─── Settled results (written at natural boundaries: HT, FT) ───

CREATE TABLE fixture_outcomes (
  fixture_id    INTEGER PRIMARY KEY REFERENCES competition_fixtures(id),
  home_score    INTEGER,                   -- final
  away_score    INTEGER,
  home_ht_score INTEGER,
  away_ht_score INTEGER,
  status        TEXT DEFAULT 'SCHEDULED',  -- SCHEDULED | FT | COMPLETE
  updated_at    TEXT DEFAULT (datetime('now'))
);

─── Post-match details (written once) ─────────────────────────

CREATE TABLE fixture_details (
  fixture_id     INTEGER PRIMARY KEY REFERENCES competition_fixtures(id),
  home_formation TEXT,
  away_formation TEXT,
  attendance     INTEGER,
  referee        TEXT,
  updated_at     TEXT DEFAULT (datetime('now'))
);

─── Match events (polymorphic: base + subtype tables) ─────────

CREATE TABLE match_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  fixture_id  INTEGER NOT NULL REFERENCES competition_fixtures(id),
  team_id     INTEGER,
  type        TEXT NOT NULL,          -- uses EventType enum
  minute      TEXT,
  period      INTEGER,
  player_name TEXT
);

CREATE TABLE goal_events (
  event_id      INTEGER PRIMARY KEY REFERENCES match_events(id),
  goal_type     TEXT NOT NULL,        -- uses GoalType enum
  assist_player TEXT
);

CREATE TABLE booking_events (
  event_id  INTEGER PRIMARY KEY REFERENCES match_events(id),
  card_type TEXT NOT NULL             -- uses CardType enum
);

CREATE TABLE substitution_events (
  event_id   INTEGER PRIMARY KEY REFERENCES match_events(id),
  player_off TEXT NOT NULL,
  player_on  TEXT NOT NULL
);

CREATE TABLE penalty_shootout_events (
  event_id INTEGER PRIMARY KEY REFERENCES match_events(id),
  scored   INTEGER NOT NULL
);

─── Line-ups ───────────────────────────────────────────────────

CREATE TABLE match_lineups (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  fixture_id   INTEGER NOT NULL REFERENCES competition_fixtures(id),
  team_id      INTEGER,
  player_name  TEXT,
  position     TEXT,
  shirt_number INTEGER,
  is_starter   INTEGER
);

─── Sweepstakes ────────────────────────────────────────────────

CREATE TABLE sweepstakes (
  id             TEXT PRIMARY KEY,
  competition_id INTEGER NOT NULL REFERENCES competitions(id),
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  public_id      TEXT UNIQUE,
  admin_password TEXT,
  created_at     TEXT DEFAULT (datetime('now'))
);

CREATE TABLE participants (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  sweepstake_id  TEXT NOT NULL REFERENCES sweepstakes(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  team_id        INTEGER NOT NULL,
  team_name      TEXT NOT NULL
);

─── Team name aliases (cross-provider name resolution) ─────────

CREATE TABLE team_name_aliases (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_name TEXT NOT NULL,
  name          TEXT NOT NULL,              -- external name as returned by the provider
  team_id       INTEGER REFERENCES teams(id),  -- NULL = unresolved
  resolved      INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now')),
  resolved_at   TEXT,
  UNIQUE(provider_name, name)
);

─── Provider bridges (all external IDs live here, not in core) ─

CREATE TABLE team_provider_ids (
  team_id       INTEGER NOT NULL REFERENCES teams(id),
  provider_name TEXT NOT NULL,
  provider_id   TEXT NOT NULL,
  PRIMARY KEY (team_id, provider_name)
);

CREATE TABLE fixture_provider_ids (
  fixture_id        INTEGER NOT NULL REFERENCES competition_fixtures(id),
  provider_name     TEXT NOT NULL,
  provider_match_id TEXT NOT NULL,
  PRIMARY KEY (fixture_id, provider_name)
);

─── Sync / audit ───────────────────────────────────────────────

CREATE TABLE sync_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  provider    TEXT NOT NULL,
  operation   TEXT NOT NULL,
  status      TEXT NOT NULL,
  details     TEXT,
  items_count INTEGER,
  duration_ms INTEGER,
  created_at  TEXT DEFAULT (datetime('now'))
);
```

---

## Team Resolution Flow

How the system resolves team identities across providers:

```
FIFA Calendar returns: team "Korea Republic" (FIFA_ID = 12345)

Step 1: Check team_name_aliases WHERE provider_name='fifa-calendar' AND name='Korea Republic'
  → Miss (no alias yet)
Step 2: Check teams WHERE name='Korea Republic'
  → Miss (no team with that name)
Step 3: Auto-create teams { name: 'Korea Republic', parent_team_id: NULL }
Step 4: Store team_provider_ids { team_id: new_id, provider_name: 'fifa-calendar', provider_id: 12345 }
Step 5: Insert team_name_aliases { provider_name: 'fifa-calendar', name: 'Korea Republic', team_id: new_id, resolved: 1 }
Step 6: Fixture mapping proceeds with this team → live data flows

--- Admin later resolves "Korea Republic" = "South Korea" ---

UPDATE teams SET parent_team_id = 1 WHERE id = 55;
-- All queries now resolve team 55 → team 1 via COALESCE(parent_team_id, id)
```

### Query resolution

```sql
-- Resolve a team to its canonical ID in any query:
COALESCE(parent_team_id, id) AS effective_team_id

-- Filter events by a team, including its duplicates:
WHERE team_id IN (SELECT id FROM teams WHERE id = ? OR parent_team_id = ?)
```

### Auto-creation logic (in `TeamRepository`)

```
upsertTeam(name, code, sourceProvider):
  1. Look up team by name → if found, return it
  2. If not found:
     a. Check team_name_aliases for (sourceProvider, name)
        → if found but unresolved, skip (wait for manual resolution)
     b. If no alias → auto-create team, record alias as resolved, store provider ID
```

### Reconciliation (admin operation)

```
reconcileTeams(duplicateId, canonicalId):
  1. Validate both exist and aren't the same
  2. Set duplicate.parent_team_id = canonicalId
  3. Update team_name_aliases to point to canonicalId
  4. Log reconciliation event
  -- No FK updates needed — all queries resolve parent_team_id
```

---

## Enums

All controlled string values are defined as frozen objects in `constants/enums.js`. DB stores machine identifiers; frontend derives display values.

```js
// FixtureStatus — covers all tables
// fixture_live:     SCHEDULED | AWAITING | LIVE | FT
// fixture_outcomes: SCHEDULED | FT | COMPLETE
export const FixtureStatus = Object.freeze({
  SCHEDULED: 'SCHEDULED',   // hasn't started
  AWAITING: 'AWAITING',     // start time passed, waiting for live data
  LIVE: 'LIVE',             // in progress
  FT: 'FT',                 // full time, result available
  COMPLETE: 'COMPLETE',     // full time + all details fetched
});

// EventType — discriminator for polymorphic event tables
export const EventType = Object.freeze({
  GOAL: 'GOAL',
  BOOKING: 'BOOKING',
  SUB: 'SUB',
  PENALTY_SHOOTOUT: 'PENALTY_SHOOTOUT',
});

// GoalType — stored in goal_events table
export const GoalType = Object.freeze({
  OPEN_PLAY: 'OPEN_PLAY',
  PENALTY: 'PENALTY',
  FREE_KICK: 'FREE_KICK',
  OWN_GOAL: 'OWN_GOAL',
});

// CardType — stored in booking_events table
export const CardType = Object.freeze({
  YELLOW: 'YELLOW',
  RED: 'RED',
  SECOND_YELLOW: 'SECOND_YELLOW',
});

// Stage — valid stages for a football competition
export const Stage = Object.freeze({
  GROUP_STAGE: 'GROUP_STAGE',
  ROUND_OF_32: 'ROUND_OF_32',
  ROUND_OF_16: 'ROUND_OF_16',
  QUARTER_FINALS: 'QUARTER_FINALS',
  SEMI_FINALS: 'SEMI_FINALS',
  THIRD_PLACE: 'THIRD_PLACE',
  FINAL: 'FINAL',
});

// Sport — extensible for other sports
export const Sport = Object.freeze({
  FOOTBALL: 'football',
});
```

Providers map external codes to these enums before passing data to repositories.

### What's NOT stored (computed on-the-fly)

| Data | Reason |
|---|---|
| Standings | Pure aggregation of `fixture_outcomes` by group |
| Top scorers | Pure aggregation of `match_events` + `goal_events` |
| Sweepstake leaderboards | Join participants + fixtures |
| Stats / records | All queries over existing tables |

---

## Domain Providers

| Interface | Implementation | Source URL |
|---|---|---|
| `TeamsProvider` | `OpenFootballTeamsProvider` | `raw.githubusercontent.com/openfootball/...` |
| `FixtureProvider` | `OpenFootballFixtureProvider` | `raw.githubusercontent.com/openfootball/...` |
| `ScoreProvider` | `FifaScoreProvider` | `api.fifa.com/v3/live/football/{id}` |
| `MatchDetailProvider` | `FifaMatchDetailProvider` | `api.fifa.com/v3/live/football/{id}` |
| `TvChannelProvider` | `FifaTvChannelProvider` | `api.fifa.com/v3/watch/season/{id}` |
| `TeamMappingProvider` | `FifaCalendarMappingProvider` | `api.fifa.com/v3/calendar/matches` |

### Design principles

1. **Providers return plain data objects** — no database access, no side effects
2. **FIFA providers share a single `FifaLiveClient`** — one HTTP client, one rate limiter, shared retry logic
3. **`OpenFootballTeamsProvider` and `OpenFootballFixtureProvider`** share a single HTTP fetch but expose different interfaces
4. **No Upbound-Web** — removed as redundant (FIFA Live covers scores)
5. **Adding a new provider** = implement the interface, register it. No schema changes needed unless it provides new data types.

---

## Repositories

Each repository handles upsert logic. Teams and fixtures are matched by **name** (teams) or **composite key** (fixtures: home_team + away_team + round + date), not by external IDs.

| Repository | Table(s) | Key operations |
|---|---|---|
| `TeamRepository` | `teams` | `upsert(team, sourceProvider)` — match by name or alias, auto-create with alias if unknown, store provider ID |
| `TeamNameAliasRepository` | `team_name_aliases` | `findUnresolved()`, `resolve(aliasId, teamId)`, `findByProvider(name, provider)` |
| `FixtureRepository` | `competition_fixtures` | `upsert(fixtures, source)` — match by composite key, store provider ID |
| `FixtureLiveRepository` | `fixture_live` | `upsert(liveData)` — written every 60s during live matches |
| `OutcomeRepository` | `fixture_outcomes` | `snapshot(fixtureId)` — copies live data to outcomes at HT/FT boundaries |
| `EventRepository` | `match_events` + subtypes | `replaceEvents(fixtureId, events)` — writes to base + subtype tables |
| `DetailsRepository` | `fixture_details` | `upsert(details)` — written once post-match |
| `LineupRepository` | `match_lineups` | `replaceLineups(fixtureId, lineups)` |

---

## Sync Engine

```js
class SyncEngineV2 {
  constructor(providers, repositories, comparator) {}

  async fullSync() {
    // 1. providers.teams.getTeams()        → teamRepo.upsert()
    // 2. providers.fixtures.getFixtures()  → fixtureRepo.upsert()
    // 3. providers.mappings.getMappings()  → fixtureRepo.updateProviderIds()
    // 4. providers.tv.getTvChannels()      → fixtureRepo.updateTvChannel()
    // 5. comparator.compare()
  }

  async liveSync() {
    // 1. Find AWAITING / LIVE fixtures
    // 2. providers.scores.getLiveScores(matchIds) → liveRepo.upsert()
    // 3. Detect boundaries (halftime, full time):
    //    - HT period transition → outcomeRepo.snapshot() copies HT scores
    //    - FT detected         → outcomeRepo.snapshot() copies FT scores + status
  }

  async detailSync() {
    // 1. Find FT fixtures without details (30min cooldown)
    // 2. providers.details.getMatchData() → eventRepo + lineupRepo + detailsRepo
    // 3. outcomeRepo.markComplete()
  }
}
```

### Sync frequencies

| Method | Frequency | Condition |
|---|---|---|
| `fullSync()` | Every 2h | Always (back-off if no activity) |
| `liveSync()` | Every 1min | Only if AWAITING/LIVE fixtures exist |
| `detailSync()` | Every 1min | Only if FT fixtures without details (30min cooldown) |

---

## Validation / Comparator

```js
class DataComparator {
  constructor(v1Db, v2Db) {}

  async compare() {
    // Compare teams, fixtures, scores across V1 and V2 DB
    // Write results to comparison_results table
    // Return summary: { total, matches, mismatches, onlyV1, onlyV2 }
  }
}
```

Runs after every full sync. Mismatches logged but don't affect the live system.

### Development-time validation (`console.js`)

```bash
node backend/src/v2/console.js --dump         # print all tables
node backend/src/v2/console.js --fixtures      # list fixtures with status
node backend/src/v2/console.js --teams         # list teams and aliases
node backend/src/v2/console.js --sync-stats    # show recent sync log
```

A CLI script for inspecting V2 DB state during development.

---

## V1 / V2 API Routing

A middleware makes it easy to switch between databases during development:

```js
// .env
ACTIVE_DB=v1            # change to 'v2' to run everything on V2

// middleware/dbRouter.js
function dbRouter(req, res, next) {
  req.db = req.query.db === 'v2' || process.env.ACTIVE_DB === 'v2'
    ? v2Connection
    : v1Connection;
  next();
}
```

- **Env var** `ACTIVE_DB=v2` flips all routes to V2
- **Query param** `?db=v2` overrides per-request for testing a single endpoint against V2
- Default is V1 — existing system continues unchanged

---

## Implementation Phases

| Phase | What | Outcome |
|---|---|---|
| 1 | Schema + connection + repositories | V2 DB exists with final schema |
| 2 | Base provider interface + port OpenFootball providers | Teams + fixtures seeded in V2 |
| 3 | Port FIFA providers (Calendar → Live → TV) | Full live data in V2 |
| 4 | Comparator + validation | Can see differences between V1 and V2 |
| 5 | Tuning + bugfixing | Match V1 data exactly, then surpass it |
| 6 | Cutover (when ready) | Point API routes at V2 DB |

### Integration into existing app

```js
// backend/src/index.js — minimal additions
import { SyncEngineV2 } from './v2/engine/syncEngine.js';

const v2Engine = new SyncEngineV2(config);
v2Engine.initialize();  // runs migrations, does initial sync (fire-and-forget)

cron.schedule(fullSyncCron, () => v2Engine.fullSync());
cron.schedule('* * * * *', () => v2Engine.liveSync());
```

No API routes point to V2 data until Phase 6. The V1 system continues unchanged.

### V1/V2 routing during development (Phases 1-5)

```js
// backend/src/index.js
import { dbRouter } from './v2/middleware/dbRouter.js';

app.use('/api', dbRouter);  // attaches req.db

// Existing controllers now read from req.db — default V1, ?db=v2 for V2
```

---

## Key Differences From Current Implementation

| V1 (current) | V2 |
|---|---|
| Full DELETE+INSERT every 2h | Incremental upsert with change detection |
| No source tracking | Bridge tables for all provider IDs |
| 5 providers with mixed concerns | 6 domain interfaces, single responsibility |
| Upbound-Web (redundant) | Removed |
| Providers write to DB directly | Providers return data → Repository writes |
| Standings stored (stale-prone) | Computed on-the-fly |
| Top scorers stored (stale-prone) | Computed on-the-fly |
| FIFA IDs in core tables | All provider IDs in bridge tables |
| Teams + groups in same table | Teams standalone, groups on competition_teams |
| Events: flat table with JSON `additional_info` | Events: polymorphic base + subtype tables with typed columns |
| User-facing display strings in DB (status, stage) | Machine identifiers only; frontend derives display |
| Scores + live state all in one table | Three-way split: `fixture_live` (transient) → `fixture_outcomes` (settled) → `fixture_details` (post-match) |
| TV channel mixed with outcomes | On `competition_fixtures` where it belongs |
| Status + lifecycle_state (two fields) | Single `status` field using FixtureStatus enum |
| No enum definitions — strings hard-coded | All controlled values in `constants/enums.js` |
| Events/lineups wiped every minute | Events only updated when new data arrives |
| No comparison/validation | Built-in comparator against V1 system |
| Hard-coded `TEAM_NAME_MAP` (manual updates) | `team_name_aliases` table + auto-creation + `parent_team_id` for collapsible duplicates |
