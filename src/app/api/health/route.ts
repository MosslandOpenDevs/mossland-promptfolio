import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      name: 'mossland-promptfolio',
      service: 'mossland-promptfolio',
      version: process.env.npm_package_version ?? '0.0.0',
      timestamp: new Date().toISOString(),
      uptimeSec: Math.round(process.uptime()),
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
      },
    }
  );
}
