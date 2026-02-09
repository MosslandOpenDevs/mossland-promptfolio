import { db } from '../../../../lib/db';
import { notFound } from 'next/navigation';
import { getLocale, t } from '../../../../lib/i18n';

export const dynamic = 'force-dynamic';

export default async function AgentReplayPage({ params }: { params: { id: string } }) {
  const locale = getLocale();
  const d = db();

  const agent = d.prepare(`SELECT * FROM agents WHERE id=?`).get(params.id) as any;
  if (!agent) return notFound();

  const season = d.prepare(`SELECT * FROM seasons ORDER BY created_at DESC LIMIT 1`).get() as any;
  if (!season) {
    return (
      <main>
        <h2>{agent.avatar_emoji} {agent.name} — Replay</h2>
        <div style={{ opacity: 0.7 }}>{t(locale, 'createSeasonFirst')}</div>
      </main>
    );
  }

  const lastTick = d.prepare(`SELECT * FROM ticks WHERE season_id=? ORDER BY ts DESC LIMIT 1`).get(season.id) as any;
  const mocUsd = lastTick?.moc_usd ?? 0;

  const portfolio = d.prepare(`SELECT * FROM portfolios WHERE season_id=? AND agent_id=?`).get(season.id, agent.id) as any;
  const cash = Number(portfolio?.cash_usd ?? season.starting_cash_usd);
  const moc = Number(portfolio?.moc_units ?? 0);
  const equity = cash + moc * mocUsd;

  const trades = d.prepare(
    `SELECT tr.*, tk.ts as tick_ts
     FROM trades tr
     JOIN ticks tk ON tk.id = tr.tick_id
     WHERE tr.season_id=? AND tr.agent_id=?
     ORDER BY tk.ts DESC, tr.created_at DESC
     LIMIT 200`
  ).all(season.id, agent.id) as any[];

  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{agent.avatar_emoji} {agent.name} — Replay</h2>
        <a href={`/agents/${agent.id}`} style={{ color: '#7ee787', textDecoration: 'none' }}>← back</a>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', opacity: 0.9 }}>
          <div><span style={dim}>season</span> {season.name}</div>
          <div><span style={dim}>moc_usd</span> {mocUsd ? `$${Number(mocUsd).toFixed(6)}` : 'run a tick'}</div>
          <div><span style={dim}>equity</span> ${equity.toFixed(2)}</div>
          <div><span style={dim}>cash</span> ${cash.toFixed(2)}</div>
          <div><span style={dim}>MOC</span> {moc.toFixed(2)}</div>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Trade timeline</div>
        {trades.length === 0 ? (
          <div style={{ opacity: 0.7 }}>No trades yet. Run a tick and let the meme gods decide.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {trades.map((tr) => (
              <div key={tr.id} style={{ borderBottom: '1px solid #1f2a37', paddingBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 800 }}>{tr.side}</div>
                  <div style={{ opacity: 0.75, fontSize: 12 }}>{tr.tick_ts}</div>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 6, opacity: 0.9, fontSize: 13, flexWrap: 'wrap' }}>
                  <div><span style={dim}>units</span> {Number(tr.moc_units).toFixed(4)} MOC</div>
                  <div><span style={dim}>price</span> ${Number(tr.price_usd).toFixed(6)}</div>
                </div>
                <div style={{ marginTop: 6, opacity: 0.85, fontSize: 13, lineHeight: 1.4 }}>
                  <span style={dim}>because</span> {tr.reason}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ opacity: 0.6, fontSize: 12 }}>
        Paper trading only. Meme responsibly.
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

const dim: React.CSSProperties = { opacity: 0.6, marginRight: 6 };
