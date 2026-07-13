# PRD — mossland-promptfolio (meme paper trading)

## Product goal
A playful, shareable **prompt-driven paper trading game** for MOC.

Users create trader personas via prompts, compete in auto-provisioned weekly seasons,
and share replays. The current engine interprets prompts with deterministic keyword
rules (no LLM yet — see `src/lib/engine.ts`); an LLM decision engine is a planned upgrade.

## Non-goals
- Real money trading
- Investment advice
- Leverage / complex derivatives

## Shipped (v0)
### Entities
- Agent (name, avatar emoji, prompt) — prompt edits limited to 1/day with full history
- Season (name, starting_cash) — weekly seasons auto-created per ISO week
- Tick (timestamp + MOC price from CoinGecko)
- Trade (BUY/SELL/HOLD + human-readable reason)
- Portfolio (cash + MOC units, per season × agent)

### Core user flows
1) Summon agent → prompt persona saved ✅
2) Season exists automatically (weekly, self-healing) ✅
3) Run ticks (button, with retry-aware error feedback) ✅
4) Leaderboard update (equity ranking, leader gap, equity bands) ✅
5) Trade replay — per-agent timeline **and** all-desk filterable index ✅

### Shipped beyond the original MVP
- Operator dashboard on home: radar alerts, brief, priority queue, checklist,
  shift handoff, pulse board, market regime, desk watchlist, feed-freshness budget
- Keyboard-first quick-jump navigation with pins, trail, and shareable filter URLs
- One-click copyable plain-text briefs for chat tools
- Bilingual EN/KO UI (cookie-persisted)
- PnL scoring: realized/unrealized per trade via weighted-average cost basis + ROI
- `/api/health` + footer health badge (30s polling)
- 84 unit tests (node:test)

## Next features (v0.1 remainder)
- Meme badges auto-award (Degen / Monk / Prophet / Diamond Hands) — note: DEGEN/MONK/NORMIE
  *profiles* already drive the engine and flavor lines; badges-as-awards remain unbuilt
- Scoring extensions: max drawdown + trade-frequency penalty (PnL/ROI already shipped)
- True push updates (SSE) — today: post-tick refresh + 30s health polling

## Later (v0.2+)
- One-click share card image (OG image)
- LLM decision engine (prompt → target allocation) with budget guardrails
- Public seasons + spectator mode
- Anti-cheat extensions: seeded price simulation (prompt-edit lock, deterministic
  engine, and per-route write rate limits are already in place)
- Per-user auth / ownership before public multi-tenant operation (see
  [SECURITY.md](SECURITY.md) and the deferred plan in [ROADMAP.md](ROADMAP.md))
