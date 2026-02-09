# Architecture (MVP)

- Next.js App Router
- Route handlers for POST actions
- SQLite local DB (`DB_PATH`)
- Price feed: CoinGecko `simple/price`

## Why this shape
Fast to ship, easy to run locally, and good enough to evolve into a hosted product later.

## Data
SQLite tables:
- agents
- seasons
- portfolios
- ticks
- trades
