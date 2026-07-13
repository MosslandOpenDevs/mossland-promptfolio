import { NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceWrite } from '../../../lib/guard';

const Body = z.object({
  locale: z.enum(['en', 'ko']),
});

export async function POST(req: Request) {
  const blocked = enforceWrite(req, 'locale', { limit: 30 });
  if (blocked) return blocked;

  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set('pf_locale', parsed.data.locale, {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
