import { NextResponse } from 'next/server';
import { ensureWeeklySeason } from '../../../lib/weekly';
import { fetchMocUsd } from '../../../lib/price';
import { runTick } from '../../../lib/engine';
import { enforceWrite } from '../../../lib/guard';

export async function POST(req: Request) {
  const blocked = enforceWrite(req, 'tick', { limit: 30 });
  if (blocked) return blocked;

  const season = ensureWeeklySeason();
  const isAjax = req.headers.get('x-pf-ajax') === '1';

  try {
    const mocUsd = await fetchMocUsd();
    runTick(season.id, mocUsd);

    if (isAjax) {
      return NextResponse.json({ success: true, seasonId: season.id, mocUsd });
    }

    return NextResponse.redirect(new URL('/leaderboard', req.url), 303);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Tick failed';
    if (isAjax) {
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
    throw err;
  }
}
