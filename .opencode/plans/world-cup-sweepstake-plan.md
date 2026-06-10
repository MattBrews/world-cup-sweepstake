# World Cup 2026 Sweepstake Tracker — Implementation Plan

## Overview

A dark-mode webapp for tracking World Cup sweepstakes. Multiple sweepstakes can coexist, each with a unique URL slug. The app fetches live data from [api-sports.io](https://api-sports.io/documentation/football/v3) (API-Football v3, free tier: 100 req/day) via scheduled cron jobs and caches it locally. Runs in a single Docker container on a home server.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express (serves API + React static files) |
| Frontend | React (Vite) — dark neon design spec |
| Database | SQLite via `better-sqlite3` (zero-config, file-based) |
| API Client | `node-fetch` for api-sports.io v3 calls |
| Scheduler | `node-cron` for periodic data sync |
| Auth | `bcrypt` + session cookies for admin pages |
| Container | Single Docker container, multi-stage build |

---

## API-Football v3 Reference

| Item | Value |
|------|-------|
| League ID | `1` (FIFA World Cup, constant across all years) |
| Season | `2026` |
| Base URL | `https://v3.football.api-sports.io` |
| Auth | Header `x-apisports-key: <key>` (GET requests only) |
| Free Tier | 100 requests/day (resets 00:00 UTC) |

### Key Endpoints

| Endpoint | Params | Data |
|----------|--------|------|
| `GET /fixtures` | `league=1&season=2026` | All 104 matches |
| `GET /fixtures?live=all` | — | Live matches |
| `GET /standings` | `league=1&season=2026` | Group tables A–L |
| `GET /teams` | `league=1&season=2026` | All 48 teams + logos |
| `GET /players/topscorers` | `league=1&season=2026` | Top scorers (lower priority) |

---

## Data Model

```
sweepstakes
├── id              TEXT (UUID)
├── name            TEXT
├── slug            TEXT (URL identifier, unique)
├── admin_password  TEXT (bcrypt hash, nullable)
├── created_at      TEXT (ISO 8601)

participants
├── id              INTEGER (auto)
├── sweepstake_id   TEXT → sweepstakes.id
├── name            TEXT (person's name)
├── team_id         INTEGER (API team ID)
├── team_name       TEXT

cached_teams
├── id              INTEGER (API team ID)
├── name            TEXT
├── code            TEXT (3-letter code)
├── logo_url        TEXT
├── group_letter    TEXT (A–L)

cached_fixtures
├── id              INTEGER (API fixture ID)
├── round           TEXT
├── stage           TEXT ("Group Stage" / "Knockout")
├── date            TEXT (ISO 8601)
├── home_team_id    INTEGER
├── away_team_id    INTEGER
├── home_score      INTEGER (nullable)
├── away_score      INTEGER (nullable)
├── status          TEXT (NS, 1H, 2H, FT, etc.)
├── venue           TEXT

cached_standings
├── id              INTEGER (auto)
├── group_letter    TEXT (A–L)
├── team_id         INTEGER
├── rank            INTEGER
├── points          INTEGER
├── played          INTEGER
├── win             INTEGER
├── draw            INTEGER
├── lose            INTEGER
├── goals_for       INTEGER
├── goals_against   INTEGER
├── goal_diff       INTEGER

cached_top_scorers
├── player_name     TEXT
├── team_id         INTEGER
├── goals           INTEGER

sync_log
├── id              INTEGER (auto)
├── endpoint        TEXT
├── fetched_at      TEXT
├── status          TEXT
├── request_count   INTEGER
```

---

## Page Structure & Routes

| Route | Component | Purpose | Auth |
|-------|-----------|---------|------|
| `/` | `HomePage` | List of sweepstakes | No |
| `/sweepstake/:slug` | `DashboardPage` | Stage-aware dashboard | No |
| `/sweepstake/:slug/fixtures` | `FixturesPage` | All matches, filterable by stage | No |
| `/sweepstake/:slug/standings` | `StandingsPage` | Group tables + knockout progression | No |
| `/sweepstake/:slug/stats` | `StatsPage` | Leaderboard with team/person toggle | No |
| `/admin` | `AdminLoginPage` | Password entry | — |
| `/admin/dashboard` | `AdminDashboardPage` | Create + manage all sweepstakes | Master admin |
| `/admin/:slug` | `AdminManagePage` | Manage participants for one sweepstake | Master or that sweepstake's admin |

---

## Stage-Aware Dashboard

The default view changes automatically based on the current tournament stage, detected from fixture statuses.

### Stage Navigation Bar

Horizontal segmented control showing all stages:
```
[ Group Stage ]  R32  R16  QF  SF  Final
```
Current stage highlighted. Click any previous stage to view its cached data.

### Content by Stage

| Stage | Visualization |
|-------|---------------|
| **Group Stage** (default) | 4-column grid of Group cards (A–L). Each card: colored border/glow, header with group letter + teams qualified counter, data rows for each team. Claimed teams show a participant badge (`← Alice`). |
| **Knockout Rounds** | Match cards in round columns with winner arrows. Claimed teams get a colored badge. |
| **Final / 3rd Place** | Full-width highlighted match card(s). |

### Progress & Status Bar

- Left: status icon + text (e.g. "Group Stage")
- Center: orange→pink gradient bar (matches completed / total)
- Right: counter fraction (e.g. "48/104")

---

## Dashboard Design Spec

### Colors

| Role | Value |
|------|-------|
| Background | `#0b111e` (`#0e1726` alt) |
| Accent (titles) | `#ff5a79` (coral/pink) |
| Card BG | `rgba(20, 30, 50, 0.7)` (glassmorphism) |
| Font | Inter / Roboto / Poppins |

### 9 Color Tokens

| # | Hex | Name |
|---|-----|------|
| 1 | `#E53E3E` | Crimson |
| 2 | `#DD6B20` | Amber |
| 3 | `#319795` | Teal |
| 4 | `#805AD5` | Purple |
| 5 | `#3182CE` | Bright Blue |
| 6 | `#B7791F` | Ochre/Gold |
| 7 | `#38A169` | Forest Green |
| 8 | `#B83280` | Magenta |
| 9 | `#2B6CB0` | Steel Blue |

Each token controls: card border color, header badge background, header accent text, and subtle outer glow (`box-shadow` with `currentColor` at 0.15–0.2 opacity).

### Card Structure

```
┌──────────────────────────────────┐
│ ❶ Group A           2/4 teams   │
│──────────────────────────────────│
│ 🏴󠁧󠁢󠁥󠁮󠁧󠁿 England      9 PTS  │
│ 🇺🇸 USA ← Alice       6 PTS      │
│ 🇮🇷 Iran ← Bob        3 PTS      │
│ 🇪🇨 Ecuador ← Carol   0 PTS      │
└──────────────────────────────────┘
```

---

## Admin Model (Two-Tier)

| Role | Auth | Can See |
|------|------|---------|
| **Master admin** | Password from env var `MASTER_PASSWORD` | All sweepstakes; create, edit, delete any |
| **Sweepstake admin** | Per-sweepstake `admin_password` in DB | Only that sweepstake's participant management |

- No user accounts — simple password entry
- Login page checks master password first, then per-sweepstake passwords
- Session stored via `express-session` cookies

---

## Data Sync Strategy

### Cron Schedule
Every **2 hours** during the tournament (configurable via `SYNC_INTERVAL_MINUTES`).

### Per Sync (4 requests, ~38/day)

| # | Request | Purpose |
|---|---------|---------|
| 1 | `GET /fixtures?live=all` | Live matches & statuses |
| 2 | `GET /standings?league=1&season=2026` | Group tables |
| 3 | `GET /fixtures?league=1&season=2026` | All fixtures (refresh) |
| 4 | `GET /players/topscorers?league=1&season=2026` | Top scorers (every other sync) |

**Budget:** ~38/100 req/day used — ~62 remaining for manual refreshes.

---

## Project Structure

```
world-cup-sweepstake/
├── package.json
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── PLAN.md
│
├── backend/
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── config.js
│       ├── db/
│       │   ├── connection.js
│       │   └── schema.js
│       ├── routes/
│       │   ├── sweepstakes.js
│       │   ├── participants.js
│       │   ├── dashboard.js
│       │   ├── fixtures.js
│       │   └── auth.js
│       ├── services/
│       │   ├── apiFootball.js
│       │   └── syncService.js
│       └── middleware/
│           └── auth.js
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api/client.js
        ├── styles/
        │   ├── tokens.css
        │   └── global.css
        ├── components/
        │   ├── ui/
        │   │   ├── Card.jsx
        │   │   ├── ProgressBar.jsx
        │   │   ├── StageNav.jsx
        │   │   ├── Header.jsx
        │   │   └── Toggle.jsx
        │   └── dashboard/
        │       ├── GroupCard.jsx
        │       ├── GroupTable.jsx
        │       ├── ParticipantBadge.jsx
        │       ├── MatchCard.jsx
        │       └── BracketView.jsx
        └── pages/
            ├── HomePage.jsx
            ├── DashboardPage.jsx
            ├── FixturesPage.jsx
            ├── StandingsPage.jsx
            ├── StatsPage.jsx
            ├── AdminLoginPage.jsx
            ├── AdminDashboardPage.jsx
            └── AdminManagePage.jsx
```

---

## Implementation Phases

### Phase 1: Project Scaffolding
- Root `package.json` with scripts
- Backend Express skeleton with SQLite
- Frontend Vite + React with dark-mode CSS
- Dockerfile (multi-stage build)
- docker-compose.yml with env vars
- `.env.example`

### Phase 2: Database & Sync Service
- SQLite schema — all tables
- DB connection + auto-migration on startup
- `apiFootball.js` client with rate-limit awareness
- `syncService.js` — node-cron + manual trigger
- Backend routes: sweepstakes CRUD, participants CRUD

### Phase 3: Frontend Design System
- `tokens.css` — 9 color tokens as CSS custom properties
- `global.css` — dark theme, glassmorphism utilities
- Shared UI components
- Dashboard subcomponents

### Phase 4: Frontend Pages
- All pages from the route table

### Phase 5: Docker & Deploy
- Optimised Dockerfile
- Volume persistence for SQLite
- Health check endpoint
- README with setup instructions

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `API_FOOTBALL_KEY` | Yes | Your api-sports.io API key |
| `MASTER_PASSWORD` | Yes | Password for master admin access |
| `PORT` | No | Internal port (default: 3000) |
| `SYNC_INTERVAL_MINUTES` | No | Cron interval (default: 120) |
| `SESSION_SECRET` | No | Session secret (auto-generated) |
| `DATA_DIR` | No | Directory for SQLite DB (default: `/data`) |

---

## Notes

- The app starts serving immediately with cached data (or empty state). Sync runs in the background.
- API data is shared across all sweepstakes — one sync serves all.
- Free tier (100 req/day): ~38 used by sync, ~62 remaining.
- Design: dark mode, neon glow, glassmorphism cards, 9 color tokens, responsive grid.
