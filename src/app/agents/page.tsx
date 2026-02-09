import { db } from '../../lib/db';
import { getLocale, t } from '../../lib/i18n';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  const locale = getLocale();
  const d = db();
  const agents = d.prepare(`SELECT id, name, avatar_emoji, prompt, created_at FROM agents ORDER BY created_at DESC`).all() as any[];

  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>{t(locale, 'agentsTitle')}</h2>

      <form action="/api/agents" method="post" style={card}>
        <div style={{ display: 'grid', gap: 8 }}>
          <label>
            <div style={label}>{t(locale, 'name')}</div>
            <input name="name" required placeholder="Degen Monk" style={input} />
          </label>
          <label>
            <div style={label}>{t(locale, 'avatarEmoji')}</div>
            <input name="avatar" required defaultValue="🫠" style={input} />
          </label>
          <label>
            <div style={label}>{t(locale, 'promptPersona')}</div>
            <textarea name="prompt" required placeholder="You are a legendary degen trader..." style={{ ...input, minHeight: 120 }} />
          </label>
          <button style={button} type="submit">{t(locale, 'summonAgent')}</button>
        </div>
      </form>

      <div style={{ display: 'grid', gap: 12 }}>
        {agents.map((a) => (
          <a key={a.id} href={`/agents/${a.id}`} style={{ ...card, textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 24 }}>{a.avatar_emoji}</div>
              <div style={{ fontWeight: 700 }}>{a.name}</div>
              <div style={{ opacity: 0.6, fontSize: 12 }}>{a.id}</div>
            </div>
            <pre style={pre}>{a.prompt}</pre>
          </a>
        ))}
        {agents.length === 0 && <div style={{ opacity: 0.7 }}>{t(locale, 'noAgents')}</div>}
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
  margin: '10px 0 0',
  opacity: 0.85,
  fontSize: 13,
  lineHeight: 1.4,
};
