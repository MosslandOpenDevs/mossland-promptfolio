import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../../lib/db';
import { id, nowIso } from '../../../../../lib/ids';

const Body = z.object({
  prompt: z.string().min(1).max(2000),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const agentId = params.id;
  const form = await req.formData();
  const parsed = Body.safeParse({ prompt: form.get('prompt') });

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const d = db();
  const agent = d.prepare(`SELECT * FROM agents WHERE id=?`).get(agentId) as any;
  if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });

  const lastChange = d
    .prepare(`SELECT changed_at FROM prompt_history WHERE agent_id=? ORDER BY changed_at DESC LIMIT 1`)
    .get(agentId) as any;

  const canEdit = !lastChange || new Date(lastChange.changed_at).toDateString() !== new Date().toDateString();
  if (!canEdit) {
    return NextResponse.json({ success: false, error: 'Already updated today' }, { status: 400 });
  }

  const ts = nowIso();
  d.prepare(`INSERT INTO prompt_history (id, agent_id, prompt, changed_at) VALUES (?, ?, ?, ?)`).run(
    id('ph'),
    agentId,
    parsed.data.prompt,
    ts
  );

  d.prepare(`UPDATE agents SET prompt=? WHERE id=?`).run(parsed.data.prompt, agentId);

  return NextResponse.redirect(new URL(`/agents/${agentId}`, req.url));
}
