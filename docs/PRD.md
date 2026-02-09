# PRD — mossland-promptfolio (meme paper trading)

## Product goal
A playful, shareable **prompt-driven paper trading game** for MOC.

Users create AI trader personas via prompts, run a season, and share replays.

## Non-goals
- Real money trading
- Investment advice
- Leverage / complex derivatives

## MVP (v0)
### Entities
- Agent (name, avatar, prompt)
- Season (name, starting_cash)
- Tick (timestamp + MOC price)
- Trade (BUY/SELL/HOLD + reason)
- Portfolio (cash + MOC units)

### Core user flows
1) Summon agent → prompt persona saved
2) Start season
3) Run ticks (button)
4) Leaderboard update
5) (next) Trade replay page per agent

## Next features (v0.1)
- Replay UI per agent (timeline of trades)
- Scoring: PnL + max drawdown + trade frequency penalty
- Meme badges (Degen / Monk / Prophet)
- One-click share card image (OG image)

## Later (v0.2+)
- LLM decision engine (prompt → target allocation) with budget guardrails
- Public seasons + spectator mode
- Weekly tournaments
- Anti-cheat (rate limit, deterministic sim)
