import Link from 'next/link';
import { db } from '../../lib/db';
import { ensureWeeklySeason } from '../../lib/weekly';
import { getLocale, t } from '../../lib/i18n';

export const dynamic = 'force-dynamic';

export default async function SeasonPage() {
  const locale = getLocale();
  const d = db();
  const season = ensureWeeklySeason();
  const ticks = season
    ? (d.prepare(`SELECT * FROM ticks WHERE season_id=? ORDER BY ts DESC LIMIT 20`).all(season.id) as any[])
    : [];

  const lastTick = ticks[0] ?? null;
  const latestPrice = Number(lastTick?.moc_usd ?? 0);
  const priorTick = ticks[1] ?? null;
  const priorPrice = Number(priorTick?.moc_usd ?? 0);
  const priceDelta = lastTick && priorTick ? latestPrice - priorPrice : null;

  const agentCountRow = d.prepare(`SELECT count(*) as c FROM agents`).get() as any;
  const portfolioCountRow = season
    ? (d.prepare(`SELECT count(*) as c FROM portfolios WHERE season_id=?`).get(season.id) as any)
    : ({ c: 0 } as any);
  const tradeCountRow = season
    ? (d.prepare(`SELECT count(*) as c FROM trades WHERE season_id=?`).get(season.id) as any)
    : ({ c: 0 } as any);

  const agentCount = Number(agentCountRow?.c ?? 0);
  const portfolioCount = Number(portfolioCountRow?.c ?? 0);
  const tradeCount = Number(tradeCountRow?.c ?? 0);

  const summaryItems = [
    {
      label: locale === 'ko' ? '에이전트' : 'agents',
      value: String(agentCount),
      hint: locale === 'ko' ? '트레이딩 페르소나 수' : 'trader personas ready',
    },
    {
      label: locale === 'ko' ? '포트폴리오' : 'portfolios',
      value: String(portfolioCount),
      hint: locale === 'ko' ? '현재 시즌 참여 수' : 'active in this season',
    },
    {
      label: locale === 'ko' ? '체결 로그' : 'trades',
      value: String(tradeCount),
      hint: locale === 'ko' ? '이번 시즌 누적 의사결정' : 'executed decisions this season',
    },
    {
      label: locale === 'ko' ? '최근 가격' : 'latest moc_usd',
      value: latestPrice > 0 ? `$${latestPrice.toFixed(6)}` : '—',
      hint:
        priceDelta === null
          ? locale === 'ko'
            ? '비교할 직전 tick 없음'
            : 'no prior tick to compare'
          : `${priceDelta >= 0 ? '+' : '-'}$${Math.abs(priceDelta).toFixed(6)} vs prev`,
    },
  ];

  const quickLinks = [
    { href: '/', label: locale === 'ko' ? '아레나' : 'Arena' },
    { href: '/agents', label: t(locale, 'agents') },
    { href: '/leaderboard', label: t(locale, 'leaderboard') },
    { href: '/replay', label: t(locale, 'replay') },
  ];

  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{t(locale, 'seasonTitle')}</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href} style={quickLink}>
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div style={summaryGrid}>
        {summaryItems.map((item) => (
          <div key={item.label} style={summaryCard}>
            <div style={summaryLabel}>{item.label}</div>
            <div style={summaryValue}>{item.value}</div>
            <div style={summaryHint}>{item.hint}</div>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700 }}>{t(locale, 'currentSeason')}</div>
        {season ? (
          <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
            <div><span style={dim}>name</span> {season.name}</div>
            <div><span style={dim}>starting_cash</span> ${Number(season.starting_cash_usd).toFixed(2)}</div>
            <div><span style={dim}>id</span> {season.id}</div>
            <div><span style={dim}>last_tick</span> {lastTick?.ts ?? '—'}</div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700 }}>{t(locale, 'recentTicks')}</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              {ticks.length > 0
                ? locale === 'ko'
                  ? `최근 ${ticks.length}개 tick 표시`
                  : `showing latest ${ticks.length} ticks`
                : t(locale, 'noTicks')}
            </div>
          </div>
          <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
            {ticks.map((tick, index) => {
              const nextTick = ticks[index + 1] ?? null;
              const tickDelta = nextTick ? Number(tick.moc_usd) - Number(nextTick.moc_usd) : null;
              return (
                <div key={tick.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ opacity: 0.8 }}>{tick.ts}</div>
                  <div style={{ fontVariantNumeric: 'tabular-nums', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span>${Number(tick.moc_usd).toFixed(6)}</span>
                    {tickDelta !== null && (
                      <span style={{ color: tickDelta >= 0 ? '#7ee787' : '#ff9b9b', fontSize: 12 }}>
                        {tickDelta >= 0 ? '+' : '-'}${Math.abs(tickDelta).toFixed(6)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
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

const summaryGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12,
};

const summaryCard: React.CSSProperties = {
  ...card,
  display: 'grid',
  gap: 6,
};

const summaryLabel: React.CSSProperties = {
  opacity: 0.68,
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '.08em',
};

const summaryValue: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  fontVariantNumeric: 'tabular-nums',
};

const summaryHint: React.CSSProperties = {
  opacity: 0.72,
  fontSize: 12,
};

const quickLink: React.CSSProperties = {
  border: '1px solid #253042',
  borderRadius: 999,
  padding: '6px 10px',
  background: '#0b0f14',
  color: '#c2d4ea',
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 700,
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
