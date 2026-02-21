# mossland-promptfolio

Prompt-driven **paper trading** league for **MOC (Moss Coin)**.

Build a meme trader persona with a prompt, watch it trade, and replay every decision.

## What this is
- **Game / entertainment** product (no real money, no investment advice)
- Agents trade a simulated portfolio based on your **prompt persona**
- Seasons, leaderboards, and shareable replays

## MVP features (v0)
- Create an **Agent** (name + avatar + prompt)
- Start a **Season** (time range + starting cash)
- Run ticks (manual button / cron later)
- Leaderboard (PnL + max drawdown)
- Replay: every trade has a short **"because"** reason

## Tech
- Next.js (App Router)
- SQLite (local file)
- CoinGecko price feed for MOC (USD)

## Dev
```bash
npm install
npm run dev
# open http://localhost:6200
```

## Env
Copy `.env.example` → `.env.local`.

## Disclaimer
This is a **paper trading game** for fun. Nothing here is financial advice.
