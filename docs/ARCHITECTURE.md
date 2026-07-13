# Architecture

- Next.js 14 App Router, React 18, TypeScript strict
- All pages `force-dynamic` server-rendered against local SQLite (better-sqlite3, WAL)
- 6 API route handlers: `/api/health` (GET, DB readiness probe — `503` when the schema is unreachable) + 5 POST endpoints (`agents`, `agents/[id]/update-prompt`, `season`, `tick`, `locale`); zod-validated wherever input is accepted (`tick` takes no body), form flows use POST-redirect-GET (`303`)
- Price feed: CoinGecko `simple/price` (`COINGECKO_BASE_URL` / `COINGECKO_COIN_ID`), `no-store`, throws on failure — no synthetic fallback
- i18n: `pf_locale` cookie (1 year) → server-side `getLocale()` → typed EN/KO dictionary, applied to `<html lang>` and page copy

## Why this shape

Fast to ship, easy to run locally, and good enough to evolve into a hosted product later.
Determinism is a design goal: the strategy engine is a pure keyword matcher, meme flavor
lines are hash-picked, and replay PnL is fully reconstructible from the `trades` table.

## Request flow (tick)

```
POST /api/tick
  → ensureWeeklySeason()        # idempotent: season_YYYYwWW, "Weekly Season YYYY-Www"
  → fetchMocUsd()               # CoinGecko live price, throws on failure
  → runTick(seasonId, price)    # per agent: prompt → target allocation → rebalance
      · drift ≤ 2% of equity    → HOLD (no trade row)
      · BUY capped at cash      → no leverage
      · SELL capped at units    → no shorting
  → AJAX (x-pf-ajax: 1) → JSON  |  form POST → redirect /leaderboard
```

Tick failures are classified in `src/lib/tick-feedback.ts`: retryable statuses (408/429/502/503/504)
plus body-text matching for known errors (price fetch failed, malformed price response, database locked),
Retry-After parsing with a 10-minute cap, machine-readable error codes, and operator-friendly copy.

## Data

SQLite tables (schema lives in `scripts/db-init.ts`, created via `npm run db:init`):

| Table | Notes |
|---|---|
| `agents` | id, name, avatar_emoji (default 🫠), prompt, created_at |
| `seasons` | starting_cash_usd, nullable ended_at |
| `portfolios` | composite PK (season_id, agent_id); cash_usd + moc_units |
| `ticks` | one row per executed tick with moc_usd |
| `trades` | side `BUY\|SELL\|HOLD`, units, price, human-readable reason |
| `prompt_history` | backs the once-per-day prompt edit lock + version trail; indexed (agent_id, changed_at DESC) |

`src/lib/db.ts` only opens the connection (singleton, WAL) — it does **not** create tables,
so `npm run db:init` is required before first run. `GET /api/health` surfaces exactly this
failure: a missing schema makes its readiness query throw, returning `503` with `db:"down"`.

A tick is atomic: `runTick` wraps the tick row, per-agent trades, and portfolio upserts in a
single `better-sqlite3` transaction, so a mid-loop failure rolls back rather than leaving a
partial tick behind. Agent creation and prompt edits are likewise transactional (the persona's
opening prompt is recorded as version 1 in `prompt_history`).

## Derived intelligence (no extra storage)

The home dashboard computes everything from the six tables at request time:
alerts/radar (`home-alerts.ts`), briefs and priority queue (`home-briefing.ts`),
desk watch signals (`desk-watchlist.ts`), and market metrics — freshness budget
(15-min staleness), direction streaks, tick cadence, equity bands (`market-metrics.ts`).
