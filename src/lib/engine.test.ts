import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolate this file's DB (node:test runs each file in its own process).
const tmpDb = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pf-engine-')), 'engine.sqlite');
process.env.DB_PATH = tmpDb;

const { decideTargetMocRatio, runTick } = await import('./engine.ts');

function countRows(d: Database.Database, table: string): number {
  return (d.prepare(`SELECT COUNT(*) c FROM ${table}`).get() as { c: number }).c;
}

function freshSchema() {
  const d = new Database(tmpDb);
  d.exec(`
    DROP TABLE IF EXISTS agents;
    DROP TABLE IF EXISTS seasons;
    DROP TABLE IF EXISTS portfolios;
    DROP TABLE IF EXISTS ticks;
    DROP TABLE IF EXISTS trades;
    CREATE TABLE agents (id TEXT PRIMARY KEY, name TEXT NOT NULL, avatar_emoji TEXT, prompt TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE seasons (id TEXT PRIMARY KEY, name TEXT NOT NULL, starting_cash_usd REAL NOT NULL, created_at TEXT NOT NULL, ended_at TEXT);
    CREATE TABLE portfolios (season_id TEXT NOT NULL, agent_id TEXT NOT NULL, cash_usd REAL NOT NULL, moc_units REAL NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (season_id, agent_id));
    CREATE TABLE ticks (id TEXT PRIMARY KEY, season_id TEXT NOT NULL, ts TEXT NOT NULL, moc_usd REAL NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE trades (id TEXT PRIMARY KEY, season_id TEXT NOT NULL, agent_id TEXT NOT NULL, tick_id TEXT NOT NULL, side TEXT NOT NULL, moc_units REAL NOT NULL, price_usd REAL NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL);
  `);
  return d;
}

test('decideTargetMocRatio maps keywords (incl. Korean) to allocations', () => {
  assert.equal(decideTargetMocRatio('degen all in'), 0.9);
  assert.equal(decideTargetMocRatio('올인 간다'), 0.9);
  assert.equal(decideTargetMocRatio('monk, no trade'), 0.0);
  assert.equal(decideTargetMocRatio('금욕 모드'), 0.0);
  assert.equal(decideTargetMocRatio('balanced steady hand'), 0.5);
});

test('runTick buys for a degen agent and records a consistent tick', () => {
  const d = freshSchema();
  d.prepare(`INSERT INTO seasons (id, name, starting_cash_usd, created_at) VALUES (?,?,?,?)`).run('s1', 'S', 1000, 't0');
  d.prepare(`INSERT INTO agents (id, name, avatar_emoji, prompt, created_at) VALUES (?,?,?,?,?)`).run('a1', 'Degen', '🚀', 'degen all in', 't0');

  const res = runTick('s1', 2);
  assert.equal(res.agents, 1);

  assert.equal(countRows(d, 'ticks'), 1);
  const trade = d.prepare(`SELECT side, moc_units FROM trades`).get() as any;
  assert.equal(trade.side, 'BUY');
  const pf = d.prepare(`SELECT cash_usd, moc_units FROM portfolios WHERE agent_id='a1'`).get() as any;
  // 90% of $1000 equity into MOC at $2 → 450 units, $100 cash left (no leverage).
  assert.ok(Math.abs(pf.moc_units - 450) < 1e-9);
  assert.ok(Math.abs(pf.cash_usd - 100) < 1e-9);
});

test('runTick rolls back entirely when the season is missing', () => {
  const d = freshSchema();
  d.prepare(`INSERT INTO agents (id, name, avatar_emoji, prompt, created_at) VALUES (?,?,?,?,?)`).run('a1', 'X', '🫠', 'degen', 't0');

  assert.throws(() => runTick('does-not-exist', 2), /season not found/);

  // Atomic: no orphan tick, trade, or portfolio row survives the failure.
  assert.equal(countRows(d, 'ticks'), 0);
  assert.equal(countRows(d, 'trades'), 0);
  assert.equal(countRows(d, 'portfolios'), 0);
});
