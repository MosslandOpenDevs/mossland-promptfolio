import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { ensureWeeklySeason } from '../../../lib/weekly';
import { fetchMocUsd } from '../../../lib/price';
import { runTick } from '../../../lib/engine';

export async function POST(req: Request) {
  const d = db();
  const season = ensureWeeklySeason();

  const mocUsd = await fetchMocUsd();
  runTick(season.id, mocUsd);

  return NextResponse.redirect(new URL('/leaderboard', req.url));
}
