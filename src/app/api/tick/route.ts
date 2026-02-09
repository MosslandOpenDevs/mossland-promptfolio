import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { fetchMocUsd } from '../../../lib/price';
import { runTick } from '../../../lib/engine';

export async function POST(req: Request) {
  const d = db();
  const season = d.prepare(`SELECT * FROM seasons ORDER BY created_at DESC LIMIT 1`).get() as any;
  if (!season) return NextResponse.json({ success: false, error: 'No season' }, { status: 400 });

  const mocUsd = await fetchMocUsd();
  runTick(season.id, mocUsd);

  return NextResponse.redirect(new URL('/leaderboard', req.url));
}
