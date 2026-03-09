import { db } from '../../lib/db';
import { getLocale, t } from '../../lib/i18n';
import { getEquityBand } from '../../lib/market-metrics';
import { ensureWeeklySeason } from '../../lib/weekly';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  const locale = getLocale();
  const d = db();
  const season = ensureWeeklySeason();

  const lastTick = d.prepare(`SELECT * FROM ticks WHERE season_id=? ORDER BY ts DESC LIMIT 1`).get(season.id) as any;
  const mocUsd = lastTick?.moc_usd ?? 0;

  const rows = d
    .prepare(
      `SELECT a.id, a.name, a.avatar_emoji, p.cash_usd, p.moc_units, p.updated_at
       FROM portfolios p
       JOIN agents a ON a.id = p.agent_id
       WHERE p.season_id=?
       ORDER BY p.updated_at DESC`
    )
    .all(season.id) as any[];

  const scored = rows
    .map((r) => {
      const equity = Number(r.cash_usd) + Number(r.moc_units) * mocUsd;
      return { ...r, equity };
    })
    .sort((a, b) => b.equity - a.equity);

  const leader = scored[0] ?? null;
  const runnerUp = scored[1] ?? null;
  const leaderGap = leader && runnerUp ? leader.equity - runnerUp.equity : null;
  const averageEquity = scored.length > 0 ? scored.reduce((sum, row) => sum + row.equity, 0) / scored.length : null;
  const latestPortfolioUpdate = scored[0]?.updated_at ?? null;
  const spread = leader && scored.length > 0 ? leader.equity - scored[scored.length - 1]!.equity : null;

  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>{t(locale, 'leaderboard')}</h2>
      <div style={card}>
        <div>
          <span style={dim}>{t(locale, 'season')}</span> {season.name}
        </div>
        <div><span style={dim}>{t(locale, 'mocUsdLabel')}</span> {mocUsd ? `$${Number(mocUsd).toFixed(6)}` : 'run a tick'}</div>
      </div>

      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div style={card}>
          <div style={dimLabel}>Active desks</div>
          <div style={metricValue}>{scored.length}</div>
          <div style={metricHint}>Portfolios ranked in the current season.</div>
        </div>
        <div style={card}>
          <div style={dimLabel}>Leader gap</div>
          <div style={metricValue}>{leaderGap !== null ? `$${leaderGap.toFixed(2)}` : '—'}</div>
          <div style={metricHint}>
            {leader && runnerUp ? `${leader.name} vs ${runnerUp.name}` : 'Need at least two desks for a gap signal.'}
          </div>
        </div>
        <div style={card}>
          <div style={dimLabel}>Average equity</div>
          <div style={metricValue}>{averageEquity !== null ? `$${averageEquity.toFixed(2)}` : '—'}</div>
          <div style={metricHint}>{latestPortfolioUpdate ? `Latest rebalance ${latestPortfolioUpdate}` : 'No portfolio updates yet.'}</div>
        </div>
        <div style={card}>
          <div style={dimLabel}>Field spread</div>
          <div style={metricValue}>{spread !== null ? `$${spread.toFixed(2)}` : '—'}</div>
          <div style={metricHint}>Gap between the top desk and the last ranked desk.</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {scored.map((r, idx) => {
          const band = getEquityBand({
            equity: Number(r.equity),
            averageEquity,
            leaderEquity: leader?.equity ?? null,
            totalDesks: scored.length,
          });
          const bandColor = band.tone === 'leader'
            ? '#f59e0b'
            : band.tone === 'positive'
              ? '#22c55e'
              : band.tone === 'warning'
                ? '#f97316'
                : '#94a3b8';

          return (
            <div key={r.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 22 }}>{r.avatar_emoji}</div>
                  <div style={{ fontWeight: 800 }}>{idx + 1}. {r.name}</div>
                  <span style={{ border: `1px solid ${bandColor}`, color: bandColor, borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    {band.label}
                  </span>
                </div>
                <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>${Number(r.equity).toFixed(2)}</div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8, opacity: 0.8, fontSize: 13, flexWrap: 'wrap' }}>
                <div>cash ${Number(r.cash_usd).toFixed(2)}</div>
                <div>MOC {Number(r.moc_units).toFixed(2)}</div>
                <div>vs avg {averageEquity !== null ? `${r.equity - averageEquity >= 0 ? '+' : ''}${Number(r.equity - averageEquity).toFixed(2)}` : '—'}</div>
                <div style={{ marginLeft: 'auto', opacity: 0.7 }}>{r.updated_at}</div>
              </div>
            </div>
          );
        })}
        {scored.length === 0 && <div style={{ opacity: 0.7 }}>{t(locale, 'noPortfolios')}</div>}
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
const dimLabel: React.CSSProperties = {
  opacity: 0.6,
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '.08em',
};
const metricValue: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  marginTop: 6,
  fontVariantNumeric: 'tabular-nums',
};
const metricHint: React.CSSProperties = {
  opacity: 0.72,
  fontSize: 12,
  marginTop: 6,
};
