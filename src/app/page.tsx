import Link from 'next/link';
import { db } from '../lib/db';
import { ensureWeeklySeason } from '../lib/weekly';
import { getLocale, t } from '../lib/i18n';
import TerminalLog, { type TerminalRow } from '../components/TerminalLog';
import ZineStamp from '../components/ZineStamp';
import ExecuteTickButton from '../components/ExecuteTickButton';
import CopyBriefButton from '../components/CopyBriefButton';
import CopyAnchorLinkButton from '../components/CopyAnchorLinkButton';
import QuickJumpShortcuts from '../components/QuickJumpShortcuts';
import { memeLine } from '../lib/meme';
import { formatDurationShort, getAverageTickIntervalMs, getDirectionStreak, getFreshnessBudget, getLatestTickAgeMs, parsePositivePrice } from '../lib/market-metrics';
import { getHomeAlerts, getHomeBrief } from '../lib/home-alerts';
import { buildHomeBriefing, buildOperatorActionPlan, buildOperatorChecklist, buildOperatorHandoff, buildOperatorPriorityQueue, buildOperatorRadarBrief } from '../lib/home-briefing';
import { getDeskWatchSignal } from '../lib/desk-watchlist';

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
  const locale = await getLocale();
  const quickJumpItems = [
    { keyLabel: '0', anchorId: 'home-top', label: 'Top' },
    { keyLabel: '1', anchorId: 'season-status', label: 'Season status' },
    { keyLabel: '2', anchorId: 'next-action', label: 'Next action' },
    { keyLabel: '3', anchorId: 'command-center', label: 'Command center' },
    { keyLabel: '4', anchorId: 'market-freshness', label: 'Market freshness' },
    { keyLabel: '5', anchorId: 'operator-brief', label: 'Operator brief' },
    { keyLabel: '6', anchorId: 'operator-priority-queue', label: 'Priority queue' },
    { keyLabel: '7', anchorId: 'operator-checklist', label: 'Checklist' },
    { keyLabel: '8', anchorId: 'shift-handoff', label: 'Shift handoff' },
    { keyLabel: '9', anchorId: 'operator-radar', label: 'Operator radar' },
    { keyLabel: 'd', anchorId: 'desk-watchlist', label: 'Desk watchlist' },
    { keyLabel: 'l', anchorId: 'leaderboard-top', label: 'Leaderboard' },
    { keyLabel: 'p', anchorId: 'desk-participation', label: 'Desk participation' },
    { keyLabel: 'u', anchorId: 'pulse-board', label: 'Pulse board' },
    { keyLabel: 'r', anchorId: 'market-regime', label: 'Market regime' },
  ] as const;
  const snapshotGeneratedAt = new Date();
  const snapshotGeneratedLabel = snapshotGeneratedAt.toLocaleTimeString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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
  const participationRatio = agentsCount > 0 ? activeDeskCount / agentsCount : 0;
  const participationLabel =
    agentsCount === 0
      ? 'NO DESKS'
      : activeDeskCount === 0
        ? 'NO LIVE DESKS'
        : participationRatio >= 0.75
          ? 'BROAD COVERAGE'
          : participationRatio >= 0.4
            ? 'PARTIAL COVERAGE'
            : 'CONCENTRATED';
  const participationTone =
    agentsCount === 0 || activeDeskCount === 0
      ? 'var(--alert)'
      : participationRatio >= 0.75
        ? 'var(--primary)'
        : participationRatio >= 0.4
          ? '#b45309'
          : 'var(--alert)';
  const participationDetail =
    agentsCount === 0
      ? 'Create the first desk before trusting any operator signal.'
      : activeDeskCount === 0
        ? 'Recent tape has no active desk participation yet. Run a fresh tick or inspect prompts.'
        : participationRatio >= 0.75
          ? `${activeDeskCount} of ${agentsCount} desks are active in the recent tape.`
          : participationRatio >= 0.4
            ? `${activeDeskCount} of ${agentsCount} desks are active. One or two more desks would improve signal confidence.`
            : `${activeDeskCount} of ${agentsCount} desks are driving the tape. Check concentration risk before acting.`;
  const participationHref = activeDeskCount <= 1 ? '/agents' : '/replay';
  const participationCta = activeDeskCount <= 1 ? 'Review desk mix' : 'Inspect replay';
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

  const nowTickTs = Date.now();

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
  const topPriorityTask = operatorPriorityQueue[0] ?? null;
  const operatorHandoff = buildOperatorHandoff({
    seasonName: season?.name ?? '—',
    feedState,
    freshnessLabel,
    regimeLabel: regime.label,
    pulseLabel,
    topTask: topPriorityTask,
    checklist: operatorChecklist,
  });
  const operatorRadarBrief = buildOperatorRadarBrief({
    seasonName: season?.name ?? '—',
    feedState,
    alerts: homeAlerts.map((alert) => ({
      label: alert.label,
      message: alert.message,
      cta: alert.cta,
    })),
  });
  const operatorSnapshot = [
    `PROMPTFOLIO SNAPSHOT`,
    `Season: ${season?.name ?? '—'}`,
    `Feed: ${feedState} · freshness ${freshnessLabel} · cadence ${cadenceLabel}`,
    `Pulse: ${pulseLabel} · Regime: ${regime.label}`,
    `Active desks: ${activeDeskCount}/${agentsCount}`,
    '',
    '[Operator brief]',
    operatorBriefing,
    '',
    '[Priority queue]',
    operatorActionPlan,
    '',
    '[Shift handoff]',
    operatorHandoff,
  ].join('\n');
  const pulseBoardBrief = [
    `PULSE BOARD`,
    `Pulse: ${pulseLabel}`,
    `Headline: ${recentHeadline}`,
    latestTrade ? `Latest note: ${String(latestTrade.reason ?? '').trim() || '—'}` : 'Latest note: —',
    `Active desks: ${activeDeskCount || 0}`,
    recentAgents.length > 0 ? `Desk list: ${recentAgents.join(', ')}` : 'Desk list: waiting for agents',
  ].join('\n');
  const participationBrief = [
    `DESK PARTICIPATION`,
    `Status: ${participationLabel}`,
    `Coverage: ${agentsCount > 0 ? `${Math.round(participationRatio * 100)}%` : '—'}`,
    `Active desks: ${activeDeskCount}/${agentsCount}`,
    participationDetail,
  ].join('\n');
  const regimeBrief = [
    `MARKET REGIME`,
    `Regime: ${regime.label}`,
    regime.note,
    latestTickAgeMs !== null
      ? `Feed age ${formatDurationShort(latestTickAgeMs, locale)} · momentum ${directionStreak > 0 ? `${streakDirection === 'up' ? '↑' : '↓'} ${directionStreak}` : 'flat'} · trade mix ${sideCounts.BUY}/${sideCounts.SELL}/${sideCounts.HOLD}`
      : 'Need recent tick data to derive regime confidence.',
  ].join('\n');
  const deskWatchlistBrief = deskWatchlist.length
    ? [
        `DESK WATCHLIST`,
        ...deskWatchlist.map((desk, index) => {
          const equity = mocUsd ? (Number(desk.cash_usd) + Number(desk.moc_units) * Number(mocUsd)).toFixed(2) : '—';
          const reason = String(desk.last_reason ?? '').trim();
          const tradeCount = Number(desk.trade_count ?? 0);
          return `${index + 1}. ${desk.name} · equity $${equity} · trades ${tradeCount} · signal ${desk.last_side ?? 'NO SIGNAL'}${reason ? `\n   memo: ${reason}` : ''}`;
        }),
      ].join('\n')
    : 'DESK WATCHLIST\nNo active desks yet. Create agents + run a tick.';

  return (
    <main id="home-top" tabIndex={-1} style={{ display: 'grid', gap: 14, scrollMarginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="pf-h1"><span className="underline-doodle">{t(locale, 'arenaTitle')}</span></h1>
          <p className="pf-sub">{t(locale, 'arenaSubtitle')}</p>
        </div>
        <div className="pf-tape" aria-hidden="true" style={{ padding: '4px 10px', transform: 'rotate(1deg)' }}>
          <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '.18em', textTransform: 'uppercase' }}>
            Vol. 1 / Issue 42
          </span>
        </div>
      </div>

      <p className="pf-sr-only">
        Live market snapshot. MOC price {mocUsd ? `$${Number(mocUsd).toFixed(6)}` : 'unavailable'}, season {season?.name ?? 'unavailable'}, feed {feedState}, pulse {pulseLabel}.
      </p>
      <div className="pf-marquee" aria-hidden="true">
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
          <div className="pf-h2" id="quick-jumps-heading">Quick jumps</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="pf-pill">home navigation</span>
            <span className="pf-pill">feed: {feedState}</span>
            <span className="pf-pill">pulse: {pulseLabel}</span>
            <span className="pf-pill">snapshot: {snapshotGeneratedLabel}</span>
            <CopyBriefButton
              text={operatorSnapshot}
              idleLabel="COPY SNAPSHOT"
              successLabel="SNAPSHOT COPIED"
              title="Copy operator snapshot"
            />
          </div>
        </div>
        <nav aria-labelledby="quick-jumps-heading" aria-describedby="quick-jumps-help" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href="#home-top" className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>Top</a>
          <a href="#season-status" className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>Season status</a>
          <a href="#next-action" className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>Next action</a>
          <a href="#command-center" className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>Command center</a>
          <a href="#market-freshness" className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>Market freshness</a>
          <a href="#operator-brief" className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>Operator brief</a>
          <a href="#operator-priority-queue" className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>Priority queue</a>
          <a href="#operator-checklist" className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>Checklist</a>
          <a href="#shift-handoff" className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>Shift handoff</a>
          <a href="#operator-radar" className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>Operator radar</a>
          <a href="#desk-watchlist" className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>Desk watchlist</a>
          <a href="#leaderboard-top" className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>Leaderboard</a>
          <a href="#desk-participation" className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>Desk participation</a>
          <a href="#pulse-board" className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>Pulse board</a>
          <a href="#market-regime" className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>Market regime</a>
        </nav>
        <div id="quick-jumps-help" className="pf-dim" style={{ fontSize: 11 }}>
          Jump straight to the live action blocks instead of scanning the whole dashboard. Use Alt+0-9 for the primary operator path, Alt+D for Desk watchlist, Alt+L for Leaderboard, Alt+P for Desk participation, Alt+U for Pulse board, and Alt+R for Market regime. Tap / to filter the jump rail, use ↑ / ↓ to choose among filtered matches, press Enter to jump to the selected match, and Esc to clear the filter. Home / End snap to the first or last section, [ or K move to the previous section, ] or J move to the next one, C copies the link for the section currently in view, O opens that direct link in a new tab, B copies a reusable navigation bundle with the current section plus your pinboard and recent trail, R or Resume jumps back to the last section you were reading, and F pins the current section into a reusable pinboard. The progress rail now keeps the saved last stop, restores your last filter after refresh, responds to browser back/forward hash navigation, tracks a short recent trail, and saves up to four pinned sections so you can bounce between your favorite operator views without rebuilding the same query every visit.
        </div>
        <QuickJumpShortcuts items={quickJumpItems.map((item) => ({ ...item }))} />
      </div>

      <div className="pf-grid">
        <div style={{ display: 'grid', gap: 12 }}>
          <div id="season-status" tabIndex={-1} className="pf-card" style={{ position: 'relative', overflow: 'hidden', scrollMarginTop: 24 }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'var(--primary)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="pf-h2">Season status</div>
              <CopyAnchorLinkButton anchorId="season-status" title="Copy season status link" />
            </div>
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
          <div id="next-action" tabIndex={-1} className="pf-card" style={{ display: 'grid', gap: 10, scrollMarginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="pf-h2">Next action</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="pf-pill">{nextAction.badge}</span>
                <CopyAnchorLinkButton anchorId="next-action" title="Copy next action link" />
              </div>
            </div>
            <div style={{ fontWeight: 900, letterSpacing: '.04em' }}>{nextAction.title}</div>
            <div className="pf-dim" style={{ fontSize: 11 }}>{nextAction.note}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href={nextAction.href} className="pf-btn">{nextAction.cta}</Link>
              {nextAction.state === 'first-tick' || nextAction.state === 'stale' ? <span className="pf-pill">run execute tick now</span> : null}
            </div>
          </div>

          <div id="command-center" tabIndex={-1} className="pf-card" style={{ display: 'grid', gap: 10, scrollMarginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div className="pf-h2">Command center</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <ZineStamp text="LIVE" />
                <CopyAnchorLinkButton anchorId="command-center" title="Copy command center link" />
              </div>
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

          <div id="market-freshness" tabIndex={-1} className="pf-card" style={{ display: 'grid', gap: 10, scrollMarginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="pf-h2">Market freshness</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="pf-pill">cadence {formatDurationShort(averageTickIntervalMs, locale)}</span>
                <CopyAnchorLinkButton anchorId="market-freshness" title="Copy market freshness link" />
              </div>
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

          <div id="operator-brief" tabIndex={-1} className="pf-card" style={{ display: 'grid', gap: 10, scrollMarginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="pf-h2">Operator brief</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="pf-pill" style={{ borderColor: briefToneColor, color: briefToneColor }}>{homeBrief.tone}</span>
                <CopyAnchorLinkButton anchorId="operator-brief" title="Copy operator brief link" />
                <CopyBriefButton
                  text={operatorBriefing}
                  idleLabel="COPY BRIEF"
                  successLabel="BRIEF COPIED"
                  title="Copy operator brief"
                />
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

          <div id="shift-handoff" tabIndex={-1} className="pf-card" style={{ display: 'grid', gap: 10, scrollMarginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="pf-h2">Shift handoff</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="pf-pill">quick passdown</span>
                <CopyAnchorLinkButton anchorId="shift-handoff" title="Copy shift handoff link" />
                <CopyBriefButton
                  text={operatorHandoff}
                  idleLabel="COPY HANDOFF"
                  successLabel="HANDOFF COPIED"
                  title="Copy shift handoff"
                />
              </div>
            </div>
            <div className="pf-dim" style={{ fontSize: 11 }}>
              One glance for the next operator: feed state, regime, pulse, top task, and readiness.
            </div>
            <div style={{ border: '2px dashed rgba(0,0,0,.22)', borderRadius: 14, padding: '12px 14px', background: 'rgba(255,255,255,.78)', display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>SHIFT HANDOFF</div>
                {topPriorityTask ? (
                  <span
                    className="pf-pill"
                    style={{
                      borderColor:
                        topPriorityTask.tone === 'urgent'
                          ? 'var(--alert)'
                          : topPriorityTask.tone === 'ready'
                            ? 'var(--primary)'
                            : '#b45309',
                      color:
                        topPriorityTask.tone === 'urgent'
                          ? 'var(--alert)'
                          : topPriorityTask.tone === 'ready'
                            ? 'var(--primary)'
                            : '#b45309',
                    }}
                  >
                    top task: {topPriorityTask.label}
                  </span>
                ) : null}
              </div>
              <div className="pf-dim" style={{ fontSize: 11, whiteSpace: 'pre-line' }}>{operatorHandoff}</div>
              {topPriorityTask ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Link href={topPriorityTask.href} className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>
                    {topPriorityTask.cta}
                  </Link>
                  <span className="pf-pill">next move: {topPriorityTask.detail}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div id="operator-priority-queue" tabIndex={-1} className="pf-card" style={{ display: 'grid', gap: 10, scrollMarginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="pf-h2">Operator priority queue</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="pf-pill">top 3 tasks</span>
                <CopyAnchorLinkButton anchorId="operator-priority-queue" title="Copy operator priority queue link" />
                <CopyBriefButton
                  text={operatorActionPlan}
                  idleLabel="COPY QUEUE"
                  successLabel="QUEUE COPIED"
                  title="Copy operator priority queue"
                />
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

          <div id="operator-checklist" tabIndex={-1} className="pf-card" style={{ display: 'grid', gap: 10, scrollMarginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="pf-h2">Operator checklist</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="pf-pill">3-step readiness</span>
                <CopyAnchorLinkButton anchorId="operator-checklist" title="Copy operator checklist link" />
                <CopyBriefButton
                  text={operatorChecklist.map((item) => `${item.label}: ${item.detail}`).join('\n')}
                  idleLabel="COPY CHECKLIST"
                  successLabel="CHECKLIST COPIED"
                  title="Copy operator checklist"
                />
              </div>
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

          <div id="operator-radar" tabIndex={-1} className="pf-card" style={{ display: 'grid', gap: 10, scrollMarginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="pf-h2">Operator radar</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="pf-pill">top 3 signals</span>
                <CopyAnchorLinkButton anchorId="operator-radar" title="Copy operator radar link" />
                <CopyBriefButton
                  text={operatorRadarBrief}
                  idleLabel="COPY RADAR"
                  successLabel="RADAR COPIED"
                  title="Copy operator radar"
                />
              </div>
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

          <div id="pulse-board" tabIndex={-1} className="pf-card" style={{ display: 'grid', gap: 10, scrollMarginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="pf-h2">Pulse board</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="pf-pill" style={{ color: pulseTone, borderColor: pulseTone }}>{pulseLabel}</span>
                <CopyAnchorLinkButton anchorId="pulse-board" title="Copy pulse board link" />
                <CopyBriefButton
                  text={pulseBoardBrief}
                  idleLabel="COPY PULSE"
                  successLabel="PULSE COPIED"
                  title="Copy pulse board"
                />
              </div>
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

          <div id="desk-participation" tabIndex={-1} className="pf-card" style={{ display: 'grid', gap: 10, scrollMarginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="pf-h2">Desk participation</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="pf-pill" style={{ color: participationTone, borderColor: participationTone }}>{participationLabel}</span>
                <CopyAnchorLinkButton anchorId="desk-participation" title="Copy desk participation link" />
                <CopyBriefButton
                  text={participationBrief}
                  idleLabel="COPY DESKS"
                  successLabel="DESKS COPIED"
                  title="Copy desk participation"
                />
              </div>
            </div>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
              <div>
                <div className="pf-dim" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.12em' }}>Active desks</div>
                <div style={{ fontWeight: 900, fontSize: 22 }}>{activeDeskCount}</div>
              </div>
              <div>
                <div className="pf-dim" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.12em' }}>Coverage</div>
                <div style={{ fontWeight: 900, fontSize: 22 }}>{agentsCount > 0 ? `${Math.round(participationRatio * 100)}%` : '—'}</div>
              </div>
              <div>
                <div className="pf-dim" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.12em' }}>Roster</div>
                <div style={{ fontWeight: 900, fontSize: 22 }}>{agentsCount}</div>
              </div>
            </div>
            <div className="pf-dim" style={{ fontSize: 11 }}>{participationDetail}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="pf-pill">recent desks: {activeDeskCount}/{agentsCount}</span>
              <Link href={participationHref} className="pf-btn" style={{ display: 'inline-flex', fontSize: 11, padding: '6px 10px' }}>
                {participationCta}
              </Link>
            </div>
          </div>

          <div id="market-regime" tabIndex={-1} className="pf-card" style={{ display: 'grid', gap: 10, scrollMarginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="pf-h2">Market regime</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="pf-pill" style={{ color: regime.tone, borderColor: regime.tone }}>{regime.label}</span>
                <CopyAnchorLinkButton anchorId="market-regime" title="Copy market regime link" />
                <CopyBriefButton
                  text={regimeBrief}
                  idleLabel="COPY REGIME"
                  successLabel="REGIME COPIED"
                  title="Copy market regime"
                />
              </div>
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

          <div id="desk-watchlist" tabIndex={-1} className="pf-card" style={{ display: 'grid', gap: 10, scrollMarginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="pf-h2">Desk watchlist</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="pf-pill">top 3 desks</span>
                <CopyAnchorLinkButton anchorId="desk-watchlist" title="Copy desk watchlist link" />
                <CopyBriefButton
                  text={deskWatchlistBrief}
                  idleLabel="COPY WATCHLIST"
                  successLabel="WATCHLIST COPIED"
                  title="Copy desk watchlist"
                />
              </div>
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
                const parsedTickTs = desk.last_tick_ts ? new Date(desk.last_tick_ts).getTime() : null;
                const latestTickAgeMs = parsedTickTs ? nowTickTs - parsedTickTs : null;
                const watchSignal = getDeskWatchSignal({
                  tradeCount,
                  hasMemo: Boolean(reason),
                  latestTickAgeMs,
                  totalDeskCount: agentsCount,
                });
                const watchTone =
                  watchSignal.tone === 'danger'
                    ? 'var(--alert)'
                    : watchSignal.tone === 'warning'
                      ? '#b45309'
                      : 'var(--ink)';

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
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <span className="pf-pill" style={{ borderColor: sideTone, color: sideTone }}>
                          {desk.last_side ?? 'NO SIGNAL'}
                        </span>
                        <span className="pf-pill" style={{ borderColor: watchTone, color: watchTone }}>
                          {watchSignal.label}
                        </span>
                      </div>
                    </div>
                    <div className="pf-dim" style={{ fontSize: 11 }}>
                      {reason
                        ? `Latest memo: "${reason.slice(0, 120)}${reason.length > 120 ? '…' : ''}"`
                        : 'No trade memo yet. Run a fresh tick to get a signal.'}
                    </div>
                    <div className="pf-dim" style={{ fontSize: 11 }}>{watchSignal.note}</div>
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

          <div id="leaderboard-top" tabIndex={-1} className="pf-card" style={{ scrollMarginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <div className="pf-h2">Leaderboard (top)</div>
              <CopyAnchorLinkButton anchorId="leaderboard-top" title="Copy leaderboard link" />
            </div>
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
