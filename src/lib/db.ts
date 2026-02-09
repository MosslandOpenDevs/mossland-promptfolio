import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

let _db: Database.Database | null = null;

export function db() {
  if (_db) return _db;
  const dbPath = process.env.DB_PATH || '.data/promptfolio.sqlite';
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  return _db;
}
