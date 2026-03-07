import { db } from '../../lib/db';
import { getLocale, t } from '../../lib/i18n';

export const dynamic = 'force-dynamic';

export default async function AgentsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const locale = getLocale();
  const d = db();
  const agents = d.prepare(`SELECT id, name, avatar_emoji, prompt, created_at FROM agents ORDER BY created_at DESC`).all() as any[];
  const qParam = Array.isArray(searchParams?.q) ? searchParams?.q[0] : searchParams?.q;
  const q = (qParam ?? '').trim();
  const qLower = q.toLocaleLowerCase(locale);
  const filteredAgents = agents.filter((agent) => {
    if (!qLower) return true;
    const haystack = `${agent.name ?? ''} ${agent.id ?? ''} ${agent.prompt ?? ''}`.toLocaleLowerCase(locale);
    return haystack.includes(qLower);
  });

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

      <form method="get" style={{ ...card, display: 'grid', gap: 8 }}>
        <label>
          <div style={label}>{t(locale, 'agentsFilterLabel')}</div>
          <input
            name="q"
            defaultValue={q}
            placeholder={t(locale, 'agentsFilterPlaceholder')}
            style={input}
          />
        </label>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ opacity: 0.75, fontSize: 12 }}>
            {t(locale, 'agentsFilterShowing')} {filteredAgents.length} {t(locale, 'agentsFilterOf')} {agents.length}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button style={button} type="submit">{t(locale, 'agentsFilterApply')}</button>
            {q && (
              <a href="/agents" style={{ color: '#9ab', fontSize: 12 }}>
                {t(locale, 'agentsFilterClear')}
              </a>
            )}
          </div>
        </div>
      </form>

      <div style={{ display: 'grid', gap: 12 }}>
        {filteredAgents.map((a) => (
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
        {agents.length > 0 && filteredAgents.length === 0 && <div style={{ opacity: 0.7 }}>{t(locale, 'noAgentsMatch')}</div>}
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
