import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const dbPath = process.env.DB_PATH || '.data/promptfolio.sqlite';
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

db.exec(`
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_emoji TEXT NOT NULL DEFAULT '🫠',
  prompt TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  starting_cash_usd REAL NOT NULL,
  created_at TEXT NOT NULL,
  ended_at TEXT
);

CREATE TABLE IF NOT EXISTS portfolios (
  season_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  cash_usd REAL NOT NULL,
  moc_units REAL NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (season_id, agent_id)
);

CREATE TABLE IF NOT EXISTS ticks (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  moc_usd REAL NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  tick_id TEXT NOT NULL,
  side TEXT NOT NULL, -- BUY|SELL|HOLD
  moc_units REAL NOT NULL,
  price_usd REAL NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);

console.log('DB initialized at', dbPath);
