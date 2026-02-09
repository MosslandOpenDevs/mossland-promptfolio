import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../lib/db';
import { id, nowIso } from '../../../lib/ids';

const Body = z.object({
  name: z.string().min(1).max(40),
  avatar: z.string().min(1).max(8),
  prompt: z.string().min(1).max(2000),
});

export async function POST(req: Request) {
  const form = await req.formData();
  const parsed = Body.safeParse({
    name: form.get('name'),
    avatar: form.get('avatar'),
    prompt: form.get('prompt'),
  });

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const d = db();
  const ts = nowIso();
  d.prepare(`INSERT INTO agents (id, name, avatar_emoji, prompt, created_at) VALUES (?, ?, ?, ?, ?)`).run(
    id('agent'),
    parsed.data.name,
    parsed.data.avatar,
    parsed.data.prompt,
    ts
  );

  return NextResponse.redirect(new URL('/agents', req.url));
}
