import { db } from '../../lib/db';
import { getLocale, t } from '../../lib/i18n';

export const dynamic = 'force-dynamic';

export default async function SeasonPage() {
  const locale = getLocale();
  const d = db();
  const season = d.prepare(`SELECT * FROM seasons ORDER BY created_at DESC LIMIT 1`).get() as any;
  const ticks = season
    ? (d.prepare(`SELECT * FROM ticks WHERE season_id=? ORDER BY ts DESC LIMIT 20`).all(season.id) as any[])
    : [];

  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>{t(locale, 'seasonTitle')}</h2>

      <div style={card}>
        <div style={{ fontWeight: 700 }}>{t(locale, 'currentSeason')}</div>
        {season ? (
          <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
            <div><span style={dim}>name</span> {season.name}</div>
            <div><span style={dim}>starting_cash</span> ${Number(season.starting_cash_usd).toFixed(2)}</div>
            <div><span style={dim}>id</span> {season.id}</div>
          </div>
        ) : (
          <div style={{ opacity: 0.7, marginTop: 8 }}>{t(locale, 'noSeason')}</div>
        )}
      </div>

      <form action="/api/season" method="post" style={card}>
        <div style={{ display: 'grid', gap: 8 }}>
          <label>
            <div style={label}>{t(locale, 'seasonName')}</div>
            <input name="name" required defaultValue={`Season ${new Date().toISOString().slice(0, 10)}`} style={input} />
          </label>
          <label>
            <div style={label}>{t(locale, 'startingCash')}</div>
            <input name="starting_cash_usd" required defaultValue="1000" style={input} />
          </label>
          <button style={button} type="submit">{t(locale, 'startNewSeason')}</button>
        </div>
      </form>

      <form action="/api/tick" method="post" style={card}>
        <button style={button} type="submit" disabled={!season}>
          {t(locale, 'runTick')}
        </button>
        {!season && <div style={{ opacity: 0.7, fontSize: 12, marginTop: 8 }}>{t(locale, 'createSeasonFirst')}</div>}
      </form>

      {season && (
        <div style={card}>
          <div style={{ fontWeight: 700 }}>{t(locale, 'recentTicks')}</div>
          <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
            {ticks.map((t) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ opacity: 0.8 }}>{t.ts}</div>
                <div style={{ fontVariantNumeric: 'tabular-nums' }}>${Number(t.moc_usd).toFixed(6)}</div>
              </div>
            ))}
            {ticks.length === 0 && <div style={{ opacity: 0.7 }}>{t(locale, 'noTicks')}</div>}
          </div>
        </div>
      )}
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
