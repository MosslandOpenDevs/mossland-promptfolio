import { db } from '../../lib/db';
import { getLocale, t } from '../../lib/i18n';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  const locale = getLocale();
  const d = db();
  const season = d.prepare(`SELECT * FROM seasons ORDER BY created_at DESC LIMIT 1`).get() as any;
  if (!season) {
    return (
      <main>
        <h2>{t(locale, 'leaderboard')}</h2>
        <div style={{ opacity: 0.7 }}>{t(locale, 'createSeasonFirst')}</div>
      </main>
    );
  }

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

  const scored = rows.map((r) => {
    const equity = Number(r.cash_usd) + Number(r.moc_units) * mocUsd;
    return { ...r, equity };
  }).sort((a,b)=>b.equity-a.equity);

  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>{t(locale, 'leaderboard')}</h2>
      <div style={card}>
        <div>
          <span style={dim}>{t(locale, 'season')}</span> {season.name}
        </div>
        <div><span style={dim}>{t(locale, 'mocUsdLabel')}</span> {mocUsd ? `$${Number(mocUsd).toFixed(6)}` : 'run a tick'}</div>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {scored.map((r, idx) => (
          <div key={r.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 22 }}>{r.avatar_emoji}</div>
                <div style={{ fontWeight: 800 }}>{idx + 1}. {r.name}</div>
              </div>
              <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>${Number(r.equity).toFixed(2)}</div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8, opacity: 0.8, fontSize: 13 }}>
              <div>cash ${Number(r.cash_usd).toFixed(2)}</div>
              <div>MOC {Number(r.moc_units).toFixed(2)}</div>
              <div style={{ marginLeft: 'auto', opacity: 0.7 }}>{r.updated_at}</div>
            </div>
          </div>
        ))}
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
