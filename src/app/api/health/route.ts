import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';

// Never prerender: a health check must reflect live process + DB state.
export const dynamic = 'force-dynamic';

export async function GET() {
  // Readiness: can we open the DB and reach an initialized schema?
  // A missing table (forgot `npm run db:init`) or unreadable file throws here.
  let dbOk = true;
  let dbError: string | undefined;
  try {
    db().prepare('SELECT 1 FROM agents LIMIT 1').get();
  } catch (err) {
    dbOk = false;
    dbError = err instanceof Error ? err.message : 'database unavailable';
  }

  return NextResponse.json(
    {
      ok: dbOk,
      status: dbOk ? 'ok' : 'degraded',
      name: 'mossland-promptfolio',
      service: 'mossland-promptfolio',
      version: process.env.npm_package_version ?? '0.0.0',
      timestamp: new Date().toISOString(),
      uptimeSec: Math.round(process.uptime()),
      db: dbOk ? 'ok' : 'down',
      ...(dbError ? { dbError } : {}),
    },
    {
      status: dbOk ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
      },
    }
  );
}
