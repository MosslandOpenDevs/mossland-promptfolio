import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../../lib/db';
import { id, nowIso } from '../../../../../lib/ids';
import { enforceWrite } from '../../../../../lib/guard';

const Body = z.object({
  prompt: z.string().min(1).max(2000),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = enforceWrite(req, 'update-prompt', { limit: 10 });
  if (blocked) return blocked;

  const agentId = (await params).id;
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

  // Once-per-day edit limit. The creation-time history row (changed_at === created_at)
  // does not count as the day's edit, so a fresh persona can still be corrected today.
  const editedToday =
    !!lastChange &&
    lastChange.changed_at !== agent.created_at &&
    new Date(lastChange.changed_at).toDateString() === new Date().toDateString();
  if (editedToday) {
    return NextResponse.json({ success: false, error: 'Already updated today' }, { status: 400 });
  }

  const ts = nowIso();
  const applyUpdate = d.transaction(() => {
    d.prepare(`INSERT INTO prompt_history (id, agent_id, prompt, changed_at) VALUES (?, ?, ?, ?)`).run(
      id('ph'),
      agentId,
      parsed.data.prompt,
      ts
    );
    d.prepare(`UPDATE agents SET prompt=? WHERE id=?`).run(parsed.data.prompt, agentId);
  });
  applyUpdate();

  return NextResponse.redirect(new URL(`/agents/${agentId}`, req.url), 303);
}
