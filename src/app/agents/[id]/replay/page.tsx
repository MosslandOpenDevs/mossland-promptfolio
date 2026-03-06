import { db } from '../../../../lib/db';
import { notFound } from 'next/navigation';
import { getLocale, t } from '../../../../lib/i18n';
import { buildReplayTimeline } from '../../../../lib/replay';

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
     ORDER BY tk.ts ASC, tr.created_at ASC
     LIMIT 200`
  ).all(season.id, agent.id) as any[];
  const timeline = buildReplayTimeline(
    trades.map((tr) => ({
      id: String(tr.id),
      tickTs: String(tr.tick_ts),
      side: String(tr.side),
      mocUnits: Number(tr.moc_units),
      priceUsd: Number(tr.price_usd),
      reason: String(tr.reason ?? ''),
    })),
    mocUsd || null
  ).reverse();

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
        {timeline.length === 0 ? (
          <div style={{ opacity: 0.7 }}>No trades yet. Run a tick and let the meme gods decide.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>time</th>
                  <th style={th}>date</th>
                  <th style={th}>action</th>
                  <th style={th}>price</th>
                  <th style={th}>units</th>
                  <th style={th}>realized PnL</th>
                  <th style={th}>unrealized PnL</th>
                  <th style={th}>reason</th>
                </tr>
              </thead>
              <tbody>
                {timeline.map((row) => (
                  <tr key={row.id} style={trRow}>
                    <td style={td}>{row.timestamp.slice(11, 19)}</td>
                    <td style={td}>{row.date}</td>
                    <td style={{ ...td, textTransform: 'uppercase', fontWeight: 800 }}>{row.action}</td>
                    <td style={td}>${row.priceUsd.toFixed(6)}</td>
                    <td style={td}>{row.mocUnits.toFixed(4)}</td>
                    <td style={td}>{formatPnl(row.realizedPnlUsd)}</td>
                    <td style={td}>{formatPnl(row.unrealizedPnlUsd)}</td>
                    <td style={{ ...td, minWidth: 280 }}>{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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

const table: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
};

const th: React.CSSProperties = {
  textAlign: 'left',
  borderBottom: '1px solid #2a3648',
  padding: '8px 6px',
  opacity: 0.7,
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  borderBottom: '1px solid #1f2a37',
  padding: '8px 6px',
  verticalAlign: 'top',
};

const trRow: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
};

function formatPnl(value: number | null): string {
  if (value == null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}$${value.toFixed(2)}`;
}
