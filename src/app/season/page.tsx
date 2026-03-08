import Link from 'next/link';
import { db } from '../../lib/db';
import { ensureWeeklySeason } from '../../lib/weekly';
import { getLocale, t } from '../../lib/i18n';

export const dynamic = 'force-dynamic';

function formatDuration(ms: number | null, locale: 'en' | 'ko') {
  if (!ms || !Number.isFinite(ms) || ms < 0) {
    return '—';
  }

  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 1) {
    return locale === 'ko' ? '1분 미만' : '<1 min';
  }

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];

  if (days > 0) parts.push(locale === 'ko' ? `${days}일` : `${days}d`);
  if (hours > 0) parts.push(locale === 'ko' ? `${hours}시간` : `${hours}h`);
  if (minutes > 0 && parts.length < 2) parts.push(locale === 'ko' ? `${minutes}분` : `${minutes}m`);

  return parts.join(' ');
}

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
  const tickPrices = ticks.map((tick) => Number(tick.moc_usd)).filter((price) => Number.isFinite(price) && price > 0);
  const highPrice = tickPrices.length > 0 ? Math.max(...tickPrices) : null;
  const lowPrice = tickPrices.length > 0 ? Math.min(...tickPrices) : null;
  const averagePrice = tickPrices.length > 0 ? tickPrices.reduce((sum, price) => sum + price, 0) / tickPrices.length : null;
  const latestVsAverage = latestPrice > 0 && averagePrice ? latestPrice - averagePrice : null;
  const directionStreak = (() => {
    if (ticks.length < 2) return 0;

    let streak = 0;
    let direction: 'up' | 'down' | null = null;

    for (let index = 0; index < ticks.length - 1; index += 1) {
      const current = Number(ticks[index]?.moc_usd ?? 0);
      const previous = Number(ticks[index + 1]?.moc_usd ?? 0);
      const delta = current - previous;

      if (delta === 0) break;

      const nextDirection = delta > 0 ? 'up' : 'down';
      if (!direction) {
        direction = nextDirection;
        streak = 1;
        continue;
      }

      if (direction !== nextDirection) break;
      streak += 1;
    }

    return direction ? streak : 0;
  })();
  const parsedTickTimes = ticks
    .map((tick) => Date.parse(String(tick.ts ?? '')))
    .filter((value) => Number.isFinite(value));
  const averageTickIntervalMs =
    parsedTickTimes.length >= 2
      ? parsedTickTimes
          .slice(0, -1)
          .reduce((sum, value, index) => sum + Math.abs(value - parsedTickTimes[index + 1]!), 0) /
        (parsedTickTimes.length - 1)
      : null;
  const latestTickAgeMs = lastTick?.ts ? Date.now() - Date.parse(String(lastTick.ts)) : null;
  const seasonStartedAtMs = season?.created_at ? Date.parse(String(season.created_at)) : null;
  const seasonAgeMs = seasonStartedAtMs && Number.isFinite(seasonStartedAtMs) ? Date.now() - seasonStartedAtMs : null;

  const recentTradeMixRow = season
    ? (d.prepare(
        `SELECT side, count(*) as c
         FROM trades
         WHERE season_id=?
         GROUP BY side`
      ).all(season.id) as Array<{ side: string; c: number }>)
    : [];
  const recentTradeMix = recentTradeMixRow.reduce(
    (acc, row) => ({ ...acc, [row.side]: Number(row.c ?? 0) }),
    { BUY: 0, SELL: 0, HOLD: 0 } as Record<string, number>
  );

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
  const tradesPerTick = ticks.length > 0 ? tradeCount / ticks.length : null;

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
            <div><span style={dim}>age</span> {formatDuration(seasonAgeMs, locale)}</div>
            <div><span style={dim}>last_tick</span> {lastTick?.ts ?? '—'}</div>
            <div><span style={dim}>last_tick_age</span> {formatDuration(latestTickAgeMs, locale)}</div>
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
            <div style={{ fontWeight: 700 }}>{locale === 'ko' ? '시장 스냅샷' : 'Market snapshot'}</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              {ticks.length > 0
                ? locale === 'ko'
                  ? `최근 ${ticks.length}개 tick 기준`
                  : `based on latest ${ticks.length} ticks`
                : t(locale, 'noTicks')}
            </div>
          </div>

          <div style={{ ...summaryGrid, marginTop: 10 }}>
            <div style={summaryCard}>
              <div style={summaryLabel}>{locale === 'ko' ? '가격 범위' : 'price range'}</div>
              <div style={summaryValue}>{highPrice !== null && lowPrice !== null ? `$${lowPrice.toFixed(6)} → $${highPrice.toFixed(6)}` : '—'}</div>
              <div style={summaryHint}>
                {averagePrice !== null
                  ? locale === 'ko'
                    ? `평균 $${averagePrice.toFixed(6)}`
                    : `average $${averagePrice.toFixed(6)}`
                  : locale === 'ko'
                    ? '범위를 계산할 tick 없음'
                    : 'need ticks to calculate range'}
              </div>
            </div>

            <div style={summaryCard}>
              <div style={summaryLabel}>{locale === 'ko' ? '최근 추세' : 'current streak'}</div>
              <div style={summaryValue}>
                {directionStreak > 0
                  ? `${priceDelta !== null && priceDelta >= 0 ? '↑' : '↓'} ${directionStreak}`
                  : '—'}
              </div>
              <div style={summaryHint}>
                {directionStreak > 0
                  ? locale === 'ko'
                    ? `${priceDelta !== null && priceDelta >= 0 ? '상승' : '하락'} 연속 ${directionStreak}틱`
                    : `${priceDelta !== null && priceDelta >= 0 ? 'up' : 'down'} for ${directionStreak} straight ticks`
                  : locale === 'ko'
                    ? '추세를 판단할 tick 부족'
                    : 'not enough ticks for a streak'}
              </div>
            </div>

            <div style={summaryCard}>
              <div style={summaryLabel}>{locale === 'ko' ? '평균 대비 현재' : 'vs average'}</div>
              <div style={summaryValue}>
                {latestVsAverage !== null ? `${latestVsAverage >= 0 ? '+' : '-'}$${Math.abs(latestVsAverage).toFixed(6)}` : '—'}
              </div>
              <div style={summaryHint}>
                {latestVsAverage !== null
                  ? locale === 'ko'
                    ? `현재가 ${latestVsAverage >= 0 ? '평균 위' : '평균 아래'}`
                    : `latest price is ${latestVsAverage >= 0 ? 'above' : 'below'} average`
                  : locale === 'ko'
                    ? '비교할 평균 없음'
                    : 'average comparison unavailable'}
              </div>
            </div>

            <div style={summaryCard}>
              <div style={summaryLabel}>{locale === 'ko' ? '행동 믹스' : 'action mix'}</div>
              <div style={summaryValue}>{`${recentTradeMix.BUY}/${recentTradeMix.SELL}/${recentTradeMix.HOLD}`}</div>
              <div style={summaryHint}>
                {locale === 'ko'
                  ? `BUY / SELL / HOLD 누적 분포`
                  : 'cumulative BUY / SELL / HOLD distribution'}
              </div>
            </div>

            <div style={summaryCard}>
              <div style={summaryLabel}>{locale === 'ko' ? '틱 간격' : 'tick cadence'}</div>
              <div style={summaryValue}>{formatDuration(averageTickIntervalMs, locale)}</div>
              <div style={summaryHint}>
                {averageTickIntervalMs !== null
                  ? locale === 'ko'
                    ? '최근 tick 평균 간격'
                    : 'average interval across recent ticks'
                  : locale === 'ko'
                    ? '간격 계산용 tick 부족'
                    : 'need more ticks to estimate cadence'}
              </div>
            </div>

            <div style={summaryCard}>
              <div style={summaryLabel}>{locale === 'ko' ? '틱당 거래' : 'trades per tick'}</div>
              <div style={summaryValue}>{tradesPerTick !== null ? tradesPerTick.toFixed(1) : '—'}</div>
              <div style={summaryHint}>
                {tradesPerTick !== null
                  ? locale === 'ko'
                    ? '최근 표시 중인 tick 기준 실행 밀도'
                    : 'execution density across visible ticks'
                  : locale === 'ko'
                    ? '비교할 tick 없음'
                    : 'need ticks to compare activity'}
              </div>
            </div>
          </div>
        </div>
      )}

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
