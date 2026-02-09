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

  // If called via client fetch, return JSON so we can show witty spinners.
  if (req.headers.get('x-pf-ajax') === '1') {
    return NextResponse.json({ success: true, seasonId: season.id, mocUsd });
  }

  return NextResponse.redirect(new URL('/leaderboard', req.url));
}
