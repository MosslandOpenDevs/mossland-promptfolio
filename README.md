# mossland-promptfolio

<p align="center">
  <img src="./docs/assets/readme/hero.svg" alt="Promptfolio cover" width="100%" />
</p>

<p align="center">
  <strong>Prompt-persona paper trading league for simulation-first experimentation.</strong>
</p>

<p align="center">
  <img alt="App Router" src="https://img.shields.io/badge/Next.js-App%20Router-black?logo=next.js"/>
  <img alt="SQLite" src="https://img.shields.io/badge/Storage-SQLite-003B57?logo=sqlite&logoColor=white"/>
  <img alt="Mode" src="https://img.shields.io/badge/Mode-Paper%20Trading-0ea5e9"/>
</p>

## Overview

Promptfolio is a simulation league where personas drive autonomous strategy behavior.

This is intentionally **not** a brokerage product:

- no real-money execution
- no custody path
- no financial advice surface

## Product goals

- Make strategy behavior observable and replayable
- Reward consistency over hype via season structure
- Keep setup lightweight for rapid experimentation

## Core capabilities

- Persona + prompt based agent setup
- Season progression and ranking loop
- Decision replay and reason traces
- Ops checks aligned with active route contracts

## Architecture

```mermaid
flowchart LR
  Persona[Prompt Persona] --> Agent[Trading Agent]
  Agent --> Engine[Simulation Engine]
  Market[Price Feed] --> Engine
  Engine --> Store[(SQLite)]
  Store --> UI[Leaderboard + Replay UI]
```

## Quickstart

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open: <http://localhost:6200>

## Operations

```bash
bash scripts/ops-check.sh
```

## Engineering notes

- Keep API route naming and ops checks in lockstep to prevent false 404 alarms.
- Treat historical permission errors as signals for startup preflight hardening.
- Prefer explicit schema fields for replay output evolution.

## Security

- Keep provider keys out of repository and screenshots.
- Use synthetic/example data for docs and demos.

## License

MIT (or project-defined license)
