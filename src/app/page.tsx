import Link from 'next/link';
import { db } from '../lib/db';
import { ensureWeeklySeason } from '../lib/weekly';
import { getLocale, t } from '../lib/i18n';
import TerminalLog, { type TerminalRow } from '../components/TerminalLog';
import ZineStamp from '../components/ZineStamp';
import ExecuteTickButton from '../components/ExecuteTickButton';
import CopyBriefButton from '../components/CopyBriefButton';
import { memeLine } from '../lib/meme';
import { formatDurationShort, getAverageTickIntervalMs, getDirectionStreak, getFreshnessBudget, getLatestTickAgeMs, parsePositivePrice } from '../lib/market-metrics';
import { getHomeAlerts, getHomeBrief } from '../lib/home-alerts';
import { buildHomeBriefing, buildOperatorActionPlan, buildOperatorChecklist, buildOperatorHandoff, buildOperatorPriorityQueue } from '../lib/home-briefing';

export const dynamic = 'force-dynamic';

function formatClockLabel(ts: string | null | undefined, locale: 'en' | 'ko') {
  if (!ts) return '—';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export default async function Page() {
  const locale = getLocale();
  const d = db();

  // Auto-create weekly season so the product always feels "alive".
  const season = ensureWeeklySeason();
  const lastTick = d.prepare(`SELECT * FROM ticks WHERE season_id=? ORDER BY ts DESC LIMIT 1`).get(season.id) as any;

  const mocUsd = parsePositivePrice(lastTick?.moc_usd);

  const ticksCountRow = d.prepare(`SELECT count(*) as c FROM ticks WHERE season_id=?`).get(season.id) as any;
  const ticksCount = Number(ticksCountRow?.c ?? 0);

  const recentTicks = d.prepare(`SELECT ts, moc_usd FROM ticks WHERE season_id=? ORDER BY ts DESC LIMIT 12`).all(season.id) as Array<{ ts: string; moc_usd: number | string }>;
  const { direction: streakDirection, streak: directionStreak } = getDirectionStreak(recentTicks);
  const averageTickIntervalMs = getAverageTickIntervalMs(recentTicks);
  const latestTickAgeMs = getLatestTickAgeMs(recentTicks);
  const freshnessBudget = getFreshnessBudget({ latestTickAgeMs });
  const lastTickLabel = formatClockLabel(lastTick?.ts ?? null, locale);
  const staleByLabel =
    lastTick?.ts && freshnessBudget.remainingMs !== null
      ? formatClockLabel(new Date(new Date(lastTick.ts).getTime() + freshnessBudget.remainingMs).toISOString(), locale)
      : '—';

  const agentsCountRow = d.prepare(`SELECT count(*) as c FROM agents`).get() as any;
  const agentsCount = Number(agentsCountRow?.c ?? 0);

  const trades = d.prepare(
    `SELECT tr.*, tk.ts as tick_ts, a.name as agent_name, a.prompt as agent_prompt
     FROM trades tr
     JOIN ticks tk ON tk.id = tr.tick_id
     JOIN agents a ON a.id = tr.agent_id
     WHERE tr.season_id=?
     ORDER BY tk.ts DESC, tr.created_at DESC
     LIMIT 10`
  ).all(season.id) as any[];

  // Build a "zine terminal" feed: sys boot + price update + most recent trades.
  const rows: TerminalRow[] = [];

  rows.push({
    ts: new Date().toISOString().slice(11, 19),
    kind: 'SYS',
    title: 'COMMAND_DECK',
    lines: [
      `> season: ${season.name}`,
      `> agents: ${agentsCount} | ticks: ${ticksCount}`,
      `> spinner: "${(await import('../lib/spinner')).pickSpinnerVerb(season.id + ':' + String(ticksCount))}"`,
    ],
    highlight: 'tape',
  });

  if (!mocUsd) {
    rows.push({
      ts: new Date().toISOString().slice(11, 19),
      kind: 'WARN',
      title: 'PRICE_FEED',
      lines: ['> MOC price unknown', '> hit EXECUTE TICK to fetch CoinGecko'],
      highlight: 'alert',
    });
  } else {
    rows.push({
      ts: String(lastTick?.ts ?? new Date().toISOString()).slice(11, 19),
      kind: 'SYS',
      title: 'PRICE_UPDATE',
      lines: [`> MOC_USD = $${Number(mocUsd).toFixed(6)}`, `> tick_id: ${String(lastTick?.id ?? '—')}`],
      highlight: 'primary',
    });
  }

  const sideCounts = trades.reduce(
    (acc, tr) => {
      if (tr.side === 'BUY') acc.BUY += 1;
      else if (tr.side === 'SELL') acc.SELL += 1;
      else acc.HOLD += 1;
      return acc;
    },
    { BUY: 0, SELL: 0, HOLD: 0 }
  );

  const latestTrade = trades[0] ?? null;
  const pulseLabel =
    sideCounts.BUY > sideCounts.SELL
      ? 'BUY PRESSURE'
      : sideCounts.SELL > sideCounts.BUY
        ? 'SELL PRESSURE'
        : sideCounts.HOLD > 0
          ? 'HOLDING PATTERN'
          : 'AWAITING SIGNAL';
  const pulseTone =
    sideCounts.BUY > sideCounts.SELL
      ? 'var(--primary)'
      : sideCounts.SELL > sideCounts.BUY
        ? 'var(--alert)'
        : 'var(--ink)';
  const hasMomentum = directionStreak >= 3;
  const regime =
    trades.length === 0
      ? {
          label: 'NO FLOW',
          tone: 'var(--ink)',
          note: 'Need a fresh tick before the desk can read market posture.',
          ctaHref: '/season',
          ctaLabel: 'Run a fresh tick',
        }
      : hasMomentum && streakDirection === 'up'
        ? {
            label: 'RISK-ON',
            tone: 'var(--primary)',
            note: 'Buy pressure and upward streak are aligned. Review the leaders before the next rebalance.',
            ctaHref: '/leaderboard',
            ctaLabel: 'Review leaders',
          }
        : hasMomentum && streakDirection === 'down'
          ? {
              label: 'RISK-OFF',
              tone: 'var(--alert)',
              note: 'Downward streak is building. Inspect defensive desks and stale positions now.',
              ctaHref: '/replay',
              ctaLabel: 'Inspect replay',
            }
          : sideCounts.HOLD >= Math.max(sideCounts.BUY, sideCounts.SELL)
            ? {
                label: 'WAIT-AND-SEE',
                tone: '#b45309',
                note: 'Hold decisions dominate. Gather one more tick before rotating exposure.',
                ctaHref: '/season',
                ctaLabel: 'Open season HQ',
              }
            : {
                label: 'MIXED TAPE',
                tone: 'var(--ink)',
                note: 'Flow is active but conviction is split. Use replay to audit trade reasons before acting.',
                ctaHref: '/replay',
                ctaLabel: 'Audit trade tape',
              };
  const recentHeadline = latestTrade
    ? `${latestTrade.agent_name} ${latestTrade.side} ${Number(latestTrade.moc_units).toFixed(2)} MOC`
    : 'No trade headlines yet';
  const recentAgents = Array.from(new Set(trades.map((tr) => String(tr.agent_name)).filter(Boolean))).slice(0, 4);
  const activeDeskCount = recentAgents.length;
  const isFeedStale = latestTickAgeMs !== null && latestTickAgeMs > 15 * 60 * 1000;
  const homeAlerts = getHomeAlerts({
    agentsCount,
    ticksCount,
    tradesCount: trades.length,
    activeDeskCount,
    latestTickAgeMs,
    averageTickIntervalMs,
    directionStreak,
    streakDirection,
    buyCount: sideCounts.BUY,
    sellCount: sideCounts.SELL,
  });
  const homeBrief = getHomeBrief(homeAlerts);
  const briefToneColor =
    homeBrief.tone === 'danger'
      ? 'var(--alert)'
      : homeBrief.tone === 'warning'
        ? '#b45309'
        : homeBrief.tone === 'success'
          ? 'var(--primary)'
          : 'var(--ink)';

  const nextAction =
    agentsCount === 0
      ? {
          state: 'bootstrap',
          badge: 'setup',
          title: 'Create your first trading agent.',
          note: 'Start in Agent Lab, then run one tick to generate a live portfolio.',
          href: '/agents',
          cta: 'Open Agent Lab',
        }
      : ticksCount === 0
        ? {
            state: 'first-tick',
            badge: 'data missing',
            title: 'Run the first tick to fetch price + decisions.',
            note: 'A fresh tick unlocks leaderboard, pulse signals, and replay data.',
            href: '/season',
            cta: 'Open Season HQ',
          }
        : isFeedStale
          ? {
              state: 'stale',
              badge: 'stale feed',
              title: 'Refresh the feed before making decisions.',
              note: 'Last tick is stale. Run a new tick from Command center now.',
              href: '/season',
              cta: 'View Season Status',
            }
          : trades.length === 0
            ? {
                state: 'no-trades',
                badge: 'waiting',
                title: 'Generate the first trade log.',
                note: 'Your agents exist, but no trades were recorded in this season yet.',
                href: '/replay',
                cta: 'Open Replay',
              }
            : hasMomentum
              ? {
                  state: 'momentum',
                  badge: streakDirection === 'up' ? 'uptrend' : 'downtrend',
                  title: `Momentum is ${streakDirection === 'up' ? 'stacking up' : 'sliding down'}.`,
                  note: `Current streak: ${directionStreak} ticks. Inspect top agents before the next rebalance.`,
                  href: '/leaderboard',
                  cta: 'Review Leaders',
                }
              : {
                  state: 'monitor',
                  badge: 'steady',
                  title: 'Monitor one more tick for a cleaner signal.',
                  note: 'Market is active but momentum is not strong yet.',
                  href: '/replay',
                  cta: 'Inspect Replay',
                };

  const feedState = latestTickAgeMs !== null && latestTickAgeMs <= 15 * 60 * 1000 ? 'FRESH' : latestTickAgeMs !== null ? 'STALE' : 'EMPTY';
  const freshnessLabel =
    freshnessBudget.remainingMs === null
      ? '—'
      : freshnessBudget.remainingMs > 0
        ? formatDurationShort(freshnessBudget.remainingMs, locale)
        : `${formatDurationShort(Math.abs(freshnessBudget.remainingMs), locale)} late`;
  const cadenceLabel = formatDurationShort(averageTickIntervalMs, locale);
  for (const tr of trades) {
    const units = Number(tr.moc_units);
    const usd = Number(tr.price_usd);
    const big = units * usd > 50; // arbitrary highlight threshold
    const seed = String(tr.id ?? '') + String(tr.tick_id ?? '');
    const joke = memeLine({ prompt: String(tr.agent_prompt ?? ''), side: tr.side, seed });

    rows.push({
      ts: String(tr.tick_ts).slice(11, 19),
      kind: tr.side,
      title: `${tr.agent_name}`,
      lines: [
        `> ${tr.side} ${units.toFixed(2)} MOC @ $${usd.toFixed(6)}`,
        `"${tr.reason}"`,
        `say: ${joke}`,
      ],
      highlight: tr.side === 'BUY' ? (big ? 'primary' : undefined) : tr.side === 'SELL' ? (big ? 'tape' : undefined) : undefined,
    });
  }

  const top = season
    ? (d.prepare(
        `SELECT a.id, a.name, a.avatar_emoji, p.cash_usd, p.moc_units
         FROM portfolios p
         JOIN agents a ON a.id=p.agent_id
         WHERE p.season_id=?
         ORDER BY (p.cash_usd + p.moc_units * ?) DESC
         LIMIT 2`
      ).all(season.id, mocUsd ?? 0) as any[])
    : [];

  const deskWatchlist = season
    ? (d.prepare(
        `SELECT
           a.id,
           a.name,
           a.avatar_emoji,
           p.cash_usd,
           p.moc_units,
           lt.side as last_side,
           lt.reason as last_reason,
           tk.ts as last_tick_ts,
           COALESCE(stats.trade_count, 0) as trade_count
         FROM portfolios p
         JOIN agents a ON a.id = p.agent_id
         LEFT JOIN (
           SELECT tr.agent_id, tr.side, tr.reason, tr.tick_id
           FROM trades tr
           INNER JOIN (
             SELECT agent_id, MAX(created_at) as max_created_at
             FROM trades
             WHERE season_id = ?
             GROUP BY agent_id
           ) latest
             ON latest.agent_id = tr.agent_id
            AND latest.max_created_at = tr.created_at
           WHERE tr.season_id = ?
         ) lt ON lt.agent_id = p.agent_id
         LEFT JOIN ticks tk ON tk.id = lt.tick_id
         LEFT JOIN (
           SELECT agent_id, COUNT(*) as trade_count
           FROM trades
           WHERE season_id = ?
           GROUP BY agent_id
         ) stats ON stats.agent_id = p.agent_id
         WHERE p.season_id = ?
         ORDER BY trade_count DESC, (p.cash_usd + p.moc_units * ?) DESC
         LIMIT 3`
      ).all(season.id, season.id, season.id, season.id, mocUsd ?? 0) as Array<{
        id: string;
        name: string;
        avatar_emoji: string | null;
        cash_usd: number | string;
        moc_units: number | string;
        last_side: 'BUY' | 'SELL' | 'HOLD' | null;
        last_reason: string | null;
        last_tick_ts: string | null;
        trade_count: number | string;
      }>)
    : [];

  const operatorBriefing = buildHomeBriefing({
    seasonName: season?.name ?? '—',
    mocUsd: mocUsd ?? null,
    feedState,
    freshnessLabel,
    cadenceLabel,
    regimeLabel: regime.label,
    regimeNote: regime.note,
    pulseLabel,
    briefHeadline: homeBrief.headline,
    briefDetail: homeBrief.detail,
    nextActionTitle: nextAction.title,
    nextActionCta: nextAction.cta,
    activeDeskCount,
    tradeMixLabel: `BUY ${sideCounts.BUY} · SELL ${sideCounts.SELL} · HOLD ${sideCounts.HOLD}`,
    watchlistNames: deskWatchlist.map((desk) => desk.name),
  });
  const operatorChecklist = buildOperatorChecklist({
    agentsCount,
    ticksCount,
    feedState,
    activeDeskCount,
  });
  const operatorPriorityQueue = buildOperatorPriorityQueue({
    agentsCount,
    ticksCount,
    feedState,
    activeDeskCount,
    directionStreak,
    streakDirection,
    buyCount: sideCounts.BUY,
    sellCount: sideCounts.SELL,
  });
  const operatorActionPlan = buildOperatorActionPlan({
    queue: operatorPriorityQueue,
    checklist: operatorChecklist,
  });
  const operatorHandoff = buildOperatorHandoff({
    seasonName: season?.name ?? '—',
    feedState,
    freshnessLabel,
    regimeLabel: regime.label,
    pulseLabel,
    topTask: operatorPriorityQueue[0] ?? null,
    checklist: operatorChecklist,
  });

  return (
    <main style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="pf-h1"><span className="underline-doodle">{t(locale, 'arenaTitle')}</span></h1>
          <p className="pf-sub">{t(locale, 'arenaSubtitle')}</p>
        </div>
        <div className="pf-tape" style={{ padding: '4px 10px', transform: 'rotate(1deg)' }}>
          <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '.18em', textTransform: 'uppercase' }}>
            Vol. 1 / Issue 42
          </span>
        </div>
      </div>

      <div className="pf-marquee">
        <div className="pf-marquee__inner">
          <span>MOC: {mocUsd ? `$${Number(mocUsd).toFixed(6)}` : '—'} </span>
          <span>SEASON: {season?.name ?? '—'}</span>
          <span>MODE: PAPER_TRADING</span>
          <span>SIGNAL: LOFI</span>
          <span>MOC: {mocUsd ? `$${Number(mocUsd).toFixed(6)}` : '—'} </span>
          <span>SEASON: {season?.name ?? '—'}</span>
          <span>MODE: PAPER_TRADING</span>
          <span>SIGNAL: LOFI</span>
        </div>
      </div>

      <div className="pf-card" style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="pf-h2">Quick jumps</div>
          <span className="pf-pill">home navigation</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href="#command-center" className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>Command center</a>
          <a href="#operator-brief" className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>Operator brief</a>
          <a href="#shift-handoff" className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>Shift handoff</a>
          <a href="#operator-radar" className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>Operator radar</a>
          <a href="#desk-watchlist" className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>Desk watchlist</a>
          <a href="#leaderboard-top" className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>Leaderboard</a>
        </div>
        <div className="pf-dim" style={{ fontSize: 11 }}>
          Jump straight to the live action blocks instead of scanning the whole dashboard.
        </div>
      </div>

      <div className="pf-grid">
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="pf-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'var(--primary)' }} />
            <div className="pf-h2">Season status</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginTop: 10 }}>
              <div style={{ fontFamily: 'Permanent Marker, cursive', fontSize: 20, color: 'var(--primary)', transform: 'rotate(-2deg)' }}>
                “Sprouting”
              </div>
              <div style={{ fontFamily: 'Space Grotesk, system-ui', fontSize: 28, fontWeight: 900 }}>
                {season ? 'LIVE' : 'NO SEASON'}
              </div>
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span className="pf-pill">moc_usd: {mocUsd ? `$${Number(mocUsd).toFixed(6)}` : '—'}</span>
              <span className="pf-pill">last_tick: {lastTick?.ts ? String(lastTick.ts).slice(11, 19) : '—'}</span>
              <span className="pf-pill">ticks: {ticksCount}</span>
              <span className="pf-pill">agents: {agentsCount}</span>
              <span className="pf-pill">BUY: {sideCounts.BUY}</span>
              <span className="pf-pill">SELL: {sideCounts.SELL}</span>
              <span className="pf-pill">HOLD: {sideCounts.HOLD}</span>
            </div>
          </div>

          <TerminalLog title="TERMINAL_LOG.txt" rows={rows} />
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div className="pf-card" style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="pf-h2">Next action</div>
              <span className="pf-pill">{nextAction.badge}</span>
            </div>
            <div style={{ fontWeight: 900, letterSpacing: '.04em' }}>{nextAction.title}</div>
            <div className="pf-dim" style={{ fontSize: 11 }}>{nextAction.note}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href={nextAction.href} className="pf-btn">{nextAction.cta}</Link>
              {nextAction.state === 'first-tick' || nextAction.state === 'stale' ? <span className="pf-pill">run execute tick now</span> : null}
            </div>
          </div>

          <div id="command-center" className="pf-card" style={{ display: 'grid', gap: 10, scrollMarginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="pf-h2">Command center</div>
              <ZineStamp text="LIVE" />
            </div>

            <ExecuteTickButton disabled={!season} />

            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
              <Link href="/agents" className="pf-btn">AGENT LAB</Link>
              <Link href="/leaderboard" className="pf-btn">RANK</Link>
              <Link href="/replay" className="pf-btn">REPLAY</Link>
              <Link href="/season" className="pf-btn">SEASON HQ</Link>
            </div>

            <div className="pf-dim" style={{ fontSize: 10, textAlign: 'center' }}>
              * WARNING: Unregulated paper trading zone.
            </div>
          </div>

          <div className="pf-card" style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="pf-h2">Market freshness</div>
              <span className="pf-pill">cadence {formatDurationShort(averageTickIntervalMs, locale)}</span>
            </div>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
              <div>
                <div className="pf-dim" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.12em' }}>Last tick age</div>
                <div style={{ fontWeight: 900, fontSize: 22 }}>{formatDurationShort(latestTickAgeMs, locale)}</div>
              </div>
              <div>
                <div className="pf-dim" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.12em' }}>Freshness budget</div>
                <div style={{ fontWeight: 900, fontSize: 22, color: freshnessBudget.tone === 'stale' ? 'var(--alert)' : freshnessBudget.tone === 'warning' ? '#b45309' : freshnessBudget.tone === 'fresh' ? 'var(--primary)' : 'var(--ink)' }}>
                  {freshnessBudget.remainingMs === null
                    ? '—'
                    : freshnessBudget.remainingMs > 0
                      ? formatDurationShort(freshnessBudget.remainingMs, locale)
                      : `${formatDurationShort(Math.abs(freshnessBudget.remainingMs), locale)} late`}
                </div>
              </div>
              <div>
                <div className="pf-dim" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.12em' }}>Momentum</div>
                <div style={{ fontWeight: 900, fontSize: 22 }}>
                  {directionStreak > 0 ? `${streakDirection === 'up' ? '↑' : '↓'} ${directionStreak}` : '—'}
                </div>
              </div>
              <div>
                <div className="pf-dim" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.12em' }}>Feed state</div>
                <div style={{ fontWeight: 900, fontSize: 22 }}>
                  {latestTickAgeMs !== null && latestTickAgeMs <= 15 * 60 * 1000 ? 'FRESH' : latestTickAgeMs !== null ? 'STALE' : 'EMPTY'}
                </div>
              </div>
            </div>
            <div className="pf-dim" style={{ fontSize: 11 }}>
              {freshnessBudget.remainingMs === null
                ? 'Run the first tick to start the freshness timer.'
                : freshnessBudget.isStale
                  ? `Feed is ${formatDurationShort(Math.abs(freshnessBudget.remainingMs), locale)} behind the freshness target. Run a new tick now.`
                  : `${freshnessBudget.label}: ${formatDurationShort(freshnessBudget.remainingMs, locale)} left before the feed turns stale.`}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="pf-pill">last tick {lastTickLabel}</span>
              <span className="pf-pill">stale by {staleByLabel}</span>
            </div>
            <div className="pf-dim" style={{ fontSize: 11 }}>
              {directionStreak > 0
                ? `Recent price action is ${streakDirection === 'up' ? 'stacking upward' : 'sliding downward'} for ${directionStreak} ticks.`
                : 'Need at least two clean ticks to estimate momentum.'}
            </div>
          </div>

          <div id="operator-brief" className="pf-card" style={{ display: 'grid', gap: 10, scrollMarginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="pf-h2">Operator brief</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="pf-pill" style={{ borderColor: briefToneColor, color: briefToneColor }}>{homeBrief.tone}</span>
                <CopyBriefButton text={operatorBriefing} />
              </div>
            </div>
            <div style={{ border: `2px solid ${briefToneColor}`, borderRadius: 14, padding: '12px 14px', background: 'rgba(255,255,255,.78)', display: 'grid', gap: 8 }}>
              <div style={{ fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', color: briefToneColor }}>{homeBrief.headline}</div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{homeBrief.detail}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="pf-pill">tick {lastTickLabel}</span>
                <span className="pf-pill">deadline {staleByLabel}</span>
              </div>
              <div className="pf-dim" style={{ fontSize: 11, whiteSpace: 'pre-line' }}>{operatorBriefing}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link href={homeBrief.href} className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>
                  {homeBrief.cta}
                </Link>
                {homeBrief.secondaryCtas.map((cta) => (
                  <Link key={cta.id} href={cta.href} className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px', background: 'rgba(255,255,255,.92)' }}>
                    {cta.cta}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div id="shift-handoff" className="pf-card" style={{ display: 'grid', gap: 10, scrollMarginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="pf-h2">Shift handoff</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="pf-pill">quick passdown</span>
                <CopyBriefButton text={operatorHandoff} />
              </div>
            </div>
            <div className="pf-dim" style={{ fontSize: 11 }}>
              One glance for the next operator: feed state, regime, pulse, top task, and readiness.
            </div>
            <div style={{ border: '2px dashed rgba(0,0,0,.22)', borderRadius: 14, padding: '12px 14px', background: 'rgba(255,255,255,.78)', display: 'grid', gap: 8 }}>
              <div style={{ fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>SHIFT HANDOFF</div>
              <div className="pf-dim" style={{ fontSize: 11, whiteSpace: 'pre-line' }}>{operatorHandoff}</div>
            </div>
          </div>

          <div className="pf-card" style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="pf-h2">Operator priority queue</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="pf-pill">top 3 tasks</span>
                <CopyBriefButton text={operatorActionPlan} />
              </div>
            </div>
            <div className="pf-dim" style={{ fontSize: 11 }}>
              Copy a ready-to-share action plan with the top queue and readiness checks.
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {operatorPriorityQueue.map((item, index) => {
                const toneColor = item.tone === 'urgent' ? 'var(--alert)' : item.tone === 'ready' ? 'var(--primary)' : '#b45309';
                const toneLabel = item.tone === 'urgent' ? 'NOW' : item.tone === 'ready' ? 'GO' : 'WATCH';

                return (
                  <div key={item.id} style={{ border: `2px solid ${toneColor}`, borderRadius: 12, padding: '10px 12px', background: 'rgba(255,255,255,.76)', display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', color: toneColor }}>#{index + 1} {item.label}</div>
                      <span className="pf-pill" style={{ borderColor: toneColor, color: toneColor }}>{toneLabel}</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{item.detail}</div>
                    <div>
                      <Link href={item.href} className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>
                        {item.cta}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pf-card" style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="pf-h2">Operator checklist</div>
              <span className="pf-pill">3-step readiness</span>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {operatorChecklist.map((item) => {
                const toneColor = item.status === 'ready'
                  ? 'var(--primary)'
                  : item.status === 'action'
                    ? 'var(--alert)'
                    : '#b45309';
                const statusLabel = item.status === 'ready' ? 'READY' : item.status === 'action' ? 'ACTION' : 'WATCH';

                return (
                  <div key={item.id} style={{ border: `2px solid ${toneColor}`, borderRadius: 12, padding: '10px 12px', background: 'rgba(255,255,255,.74)', display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', color: toneColor }}>{item.label}</div>
                      <span className="pf-pill" style={{ borderColor: toneColor, color: toneColor }}>{statusLabel}</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{item.detail}</div>
                    <div>
                      <Link href={item.href} className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>
                        {item.cta}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div id="operator-radar" className="pf-card" style={{ display: 'grid', gap: 10, scrollMarginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="pf-h2">Operator radar</div>
              <span className="pf-pill">top 3 signals</span>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {homeAlerts.map((alert) => {
                const toneColor = alert.tone === 'danger'
                  ? 'var(--alert)'
                  : alert.tone === 'warning'
                    ? '#b45309'
                    : alert.tone === 'success'
                      ? 'var(--primary)'
                      : 'var(--ink)';

                return (
                  <div key={alert.id} style={{ border: `2px solid ${toneColor}`, borderRadius: 12, padding: '10px 12px', background: 'rgba(255,255,255,.72)', display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', color: toneColor }}>{alert.label}</div>
                      <span className="pf-pill" style={{ borderColor: toneColor, color: toneColor }}>{alert.id.replace(/-/g, ' ')}</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{alert.message}</div>
                    <div>
                      <Link href={alert.href} className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>
                        {alert.cta}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pf-card" style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="pf-h2">Pulse board</div>
              <span className="pf-pill" style={{ color: pulseTone, borderColor: pulseTone }}>{pulseLabel}</span>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontWeight: 900, letterSpacing: '.04em' }}>{recentHeadline}</div>
              <div className="pf-dim" style={{ fontSize: 11 }}>
                {latestTrade
                  ? `Latest note: "${String(latestTrade.reason ?? '').slice(0, 96)}${String(latestTrade.reason ?? '').length > 96 ? '…' : ''}"`
                  : 'Run EXECUTE TICK to generate the first market memo.'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="pf-pill">active desks: {activeDeskCount || 0}</span>
              {recentAgents.length > 0 ? (
                recentAgents.map((name) => (
                  <span key={name} className="pf-pill">desk: {name}</span>
                ))
              ) : (
                <span className="pf-pill">desk: waiting for agents</span>
              )}
            </div>
          </div>

          <div className="pf-card" style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="pf-h2">Market regime</div>
              <span className="pf-pill" style={{ color: regime.tone, borderColor: regime.tone }}>{regime.label}</span>
            </div>
            <div style={{ fontWeight: 900, letterSpacing: '.04em' }}>{regime.note}</div>
            <div className="pf-dim" style={{ fontSize: 11 }}>
              {latestTickAgeMs !== null
                ? `Feed age ${formatDurationShort(latestTickAgeMs, locale)} · momentum ${directionStreak > 0 ? `${streakDirection === 'up' ? '↑' : '↓'} ${directionStreak}` : 'flat'} · trade mix ${sideCounts.BUY}/${sideCounts.SELL}/${sideCounts.HOLD}`
                : 'Need recent tick data to derive regime confidence.'}
            </div>
            <div>
              <Link href={regime.ctaHref} className="pf-btn" style={{ display: 'inline-flex' }}>{regime.ctaLabel}</Link>
            </div>
          </div>

          <div id="desk-watchlist" className="pf-card" style={{ display: 'grid', gap: 10, scrollMarginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="pf-h2">Desk watchlist</div>
              <span className="pf-pill">top 3 desks</span>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {deskWatchlist.map((desk) => {
                const equity = mocUsd ? (Number(desk.cash_usd) + Number(desk.moc_units) * Number(mocUsd)).toFixed(2) : '—';
                const sideTone = desk.last_side === 'BUY'
                  ? 'var(--primary)'
                  : desk.last_side === 'SELL'
                    ? 'var(--alert)'
                    : desk.last_side === 'HOLD'
                      ? '#b45309'
                      : 'var(--ink)';
                const reason = String(desk.last_reason ?? '').trim();
                const tradeCount = Number(desk.trade_count ?? 0);

                return (
                  <div key={desk.id} style={{ border: `2px solid ${sideTone}`, borderRadius: 14, padding: '12px 14px', background: 'rgba(255,255,255,.74)', display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <div className="pf-polaroid" style={{ minWidth: 52, transform: 'rotate(-2deg)' }}>
                          <div style={{ height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                            {desk.avatar_emoji ?? '🧠'}
                          </div>
                          <div style={{ borderTop: '1px solid rgba(0,0,0,.08)', paddingTop: 4, textAlign: 'center', fontFamily: 'Permanent Marker, cursive', fontSize: 10 }}>
                            {desk.name}
                          </div>
                        </div>
                        <div style={{ display: 'grid', gap: 4 }}>
                          <div style={{ fontWeight: 900, letterSpacing: '.05em' }}>{desk.name}</div>
                          <div className="pf-dim" style={{ fontSize: 11 }}>equity ${equity} · trades {tradeCount}</div>
                        </div>
                      </div>
                      <span className="pf-pill" style={{ borderColor: sideTone, color: sideTone }}>
                        {desk.last_side ?? 'NO SIGNAL'}
                      </span>
                    </div>
                    <div className="pf-dim" style={{ fontSize: 11 }}>
                      {reason
                        ? `Latest memo: "${reason.slice(0, 120)}${reason.length > 120 ? '…' : ''}"`
                        : 'No trade memo yet. Run a fresh tick to get a signal.'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="pf-pill">last tick: {desk.last_tick_ts ? String(desk.last_tick_ts).slice(11, 19) : '—'}</span>
                      <Link href={`/agents/${desk.id}/replay`} className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>
                        Open desk replay
                      </Link>
                    </div>
                  </div>
                );
              })}
              {deskWatchlist.length === 0 && <div className="pf-dim">No active desks yet. Create agents + run a tick.</div>}
            </div>
          </div>

          <div id="leaderboard-top" className="pf-card" style={{ scrollMarginTop: 24 }}>
            <div className="pf-h2" style={{ marginBottom: 10 }}>Leaderboard (top)</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {top.map((a: any, idx: number) => (
                <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '54px 1fr', gap: 10, alignItems: 'center' }}>
                  <div className="pf-polaroid" style={{ transform: idx === 0 ? 'rotate(-3deg)' : 'rotate(2deg)' }}>
                    <div style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                      {a.avatar_emoji}
                    </div>
                    <div style={{ borderTop: '1px solid rgba(0,0,0,.08)', paddingTop: 4, textAlign: 'center', fontFamily: 'Permanent Marker, cursive', fontSize: 10 }}>
                      {a.name}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 900, letterSpacing: '.08em' }}>#{idx + 1}</div>
                    <div className="pf-dim" style={{ fontSize: 11 }}>
                      equity ${mocUsd ? (Number(a.cash_usd) + Number(a.moc_units) * Number(mocUsd)).toFixed(2) : '—'}
                    </div>
                    <a href={`/agents/${a.id}/replay`} style={{ fontSize: 11 }}>replay →</a>
                  </div>
                </div>
              ))}
              {top.length === 0 && <div className="pf-dim">No portfolios yet. Create agents + run a tick.</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="pf-dim" style={{ fontSize: 12 }}>{t(locale, 'disclaimer')}</div>
    </main>
  );
}
