# Security posture

This is a **paper-trading simulation** — no funds, custody, or execution. The
threat model is therefore about integrity and abuse resistance, not asset loss.

## What is in place

- **Dependency hygiene** — runs on Next.js 16; `npm audit --omit=dev` reports
  **0 vulnerabilities**. (One low-severity, dev-only `esbuild` advisory remains
  via `tsx`; it affects only esbuild's own dev server on Windows and is not
  shipped.) CI runs typecheck → lint → test → build on every push/PR.
- **Input validation** — every write endpoint validates with zod and caps
  sizes (agent name ≤ 40, avatar ≤ 8, prompt ≤ 2,000 chars; season cash
  $1–$1,000,000).
- **Write-path protection** (`src/lib/rate-limit.ts`, `src/lib/guard.ts`):
  - **CSRF / same-origin** — a POST carrying a cross-origin `Origin` header is
    rejected with `403`. Absent-Origin requests (monitors, curl) are allowed,
    as they are not a CSRF vector.
  - **Rate limiting** — per-IP, per-route fixed-window budgets (`429` +
    `Retry-After`). Defaults: agents 10, season 6, tick 30, update-prompt 10,
    locale 30 per minute; tune via `WRITE_RATE_LIMIT` / `WRITE_RATE_WINDOW_MS`.
  - **Atomicity** — ticks, agent creation, and prompt edits run in SQLite
    transactions, so a mid-operation failure rolls back cleanly.
- **Prompt governance** — prompt edits are limited to once per calendar day,
  with the full version history retained.
- **Readiness probe** — `GET /api/health` verifies the DB/schema and returns
  `503` when unreachable (so uptime monitors catch a broken deploy).

## Known limitations (deferred — see docs/ROADMAP.md)

- **No per-user auth / ownership.** There is no user model; any same-origin
  client can create agents/seasons and run ticks. Rate limiting + CSRF reduce
  abuse but do not authenticate callers. A real auth layer (sessions + owner
  checks on agents/prompts) is the main outstanding item before public,
  multi-tenant operation.
- **Rate-limit state is in-memory per process.** Correct for a single-instance
  PM2 deployment; multiple instances would each keep their own counters. A
  shared store (e.g. SQLite/Redis) is needed to throttle globally.
- **Client IP trust.** `x-forwarded-for` is trusted as-is; only deploy behind a
  proxy that sets it reliably, or the first hop can be spoofed.

## Reporting

This is an experimental project. Open an issue for anything security-relevant;
do not include exploit details for anything that could affect a live deployment
in a public issue.
