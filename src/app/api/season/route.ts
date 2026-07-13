import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../lib/db';
import { id, nowIso } from '../../../lib/ids';
import { enforceWrite } from '../../../lib/guard';

const Body = z.object({
  name: z.string().min(1).max(80),
  starting_cash_usd: z.coerce.number().min(1).max(1_000_000),
});

export async function POST(req: Request) {
  const blocked = enforceWrite(req, 'season', { limit: 6 });
  if (blocked) return blocked;

  const form = await req.formData();
  const parsed = Body.safeParse({
    name: form.get('name'),
    starting_cash_usd: form.get('starting_cash_usd'),
  });

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const d = db();
  const ts = nowIso();
  d.prepare(`INSERT INTO seasons (id, name, starting_cash_usd, created_at) VALUES (?, ?, ?, ?)`).run(
    id('season'),
    parsed.data.name,
    parsed.data.starting_cash_usd,
    ts
  );

  return NextResponse.redirect(new URL('/season', req.url), 303);
}
