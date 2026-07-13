import { db } from '../../../lib/db';
import { notFound } from 'next/navigation';
import { getLocale, t } from '../../../lib/i18n';

export const dynamic = 'force-dynamic';

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const d = db();
  const agent = d.prepare(`SELECT * FROM agents WHERE id=?`).get(id) as any;
  if (!agent) return notFound();

  const history = d
    .prepare(`SELECT * FROM prompt_history WHERE agent_id=? ORDER BY changed_at DESC`)
    .all(id) as any[];

  const lastChange = history[0]?.changed_at;
  const canEditToday = !lastChange || new Date(lastChange).toDateString() !== new Date().toDateString();

  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>
        {agent.avatar_emoji} {agent.name}
      </h2>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700 }}>{t(locale, 'currentPrompt')}</div>
          <a href={`/agents/${agent.id}/replay`} style={{ color: '#7ee787', textDecoration: 'none' }}>Replay →</a>
        </div>
        <pre style={pre}>{agent.prompt}</pre>
      </div>

      {canEditToday ? (
        <form action={`/api/agents/${id}/update-prompt`} method="post" style={card}>
          <div style={{ display: 'grid', gap: 8 }}>
            <label>
              <div style={label}>{t(locale, 'updatePromptLimit')}</div>
              <textarea name="prompt" required defaultValue={agent.prompt} style={{ ...input, minHeight: 100 }} />
            </label>
            <button style={button} type="submit">
              {t(locale, 'updatePrompt')}
            </button>
          </div>
        </form>
      ) : (
        <div style={{ ...card, opacity: 0.7 }}>{t(locale, 'promptLocked')}</div>
      )}

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>{t(locale, 'promptHistory')}</div>
        {history.length > 0 ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {history.map((h) => (
              <div key={h.id} style={{ borderBottom: '1px solid #1f2a37', paddingBottom: 8 }}>
                <div style={{ opacity: 0.7, fontSize: 12 }}>{h.changed_at}</div>
                <pre style={pre}>{h.prompt}</pre>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ opacity: 0.7 }}>{t(locale, 'noChanges')}</div>
        )}
      </div>
    </main>
  );
}

const card: React.CSSProperties = {
  border: '1px solid #253042',
  borderRadius: 12,
  padding: 12,
  background: '#0f1720',
};

const label: React.CSSProperties = { opacity: 0.7, fontSize: 12, marginBottom: 4 };

const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 10px',
  borderRadius: 10,
  border: '1px solid #253042',
  background: '#0b0f14',
  color: '#e6edf3',
  boxSizing: 'border-box',
};

const button: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #2d3b52',
  background: '#132033',
  color: '#e6edf3',
  fontWeight: 700,
  cursor: 'pointer',
};

const pre: React.CSSProperties = {
  whiteSpace: 'pre-wrap',
  margin: '8px 0 0',
  opacity: 0.85,
  fontSize: 13,
  lineHeight: 1.4,
};
