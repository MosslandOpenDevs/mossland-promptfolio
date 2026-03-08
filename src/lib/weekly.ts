import { db } from './db';

export function isoWeek(date = new Date()): { year: number; week: number } {
  // ISO week date weeks start on Monday.
  // Algorithm: https://en.wikipedia.org/wiki/ISO_week_date#Algorithms
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Thursday in current week decides the year.
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

export function weeklySeasonKey(date = new Date()): string {
  const { year, week } = isoWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function weeklySeasonId(date = new Date()): string {
  return `season_${weeklySeasonKey(date).replace('-', '').toLowerCase()}`; // season_2026w07
}

export function defaultStartingCashUsd(): number {
  const v = process.env.DEFAULT_STARTING_CASH_USD;
  const n = v ? Number(v) : 1000;
  if (!Number.isFinite(n) || n <= 0) return 1000;
  return n;
}

export function ensureWeeklySeason(): { id: string; name: string; starting_cash_usd: number; created_at: string } {
  const d = db();
  const id = weeklySeasonId();
  const key = weeklySeasonKey();
  const name = `Weekly Season ${key}`;
  const starting = defaultStartingCashUsd();

  d.prepare(
    `INSERT OR IGNORE INTO seasons (id, name, starting_cash_usd, created_at)
     VALUES (?, ?, ?, datetime('now'))`
  ).run(id, name, starting);

  const season = d.prepare(`SELECT id, name, starting_cash_usd, created_at FROM seasons WHERE id=?`).get(id) as any;
  return season;
}
