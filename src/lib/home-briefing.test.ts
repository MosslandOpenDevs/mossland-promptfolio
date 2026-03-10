import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHomeBriefing, buildLeaderboardBriefing, buildOperatorActionPlan, buildOperatorChecklist, buildOperatorHandoff, buildOperatorPriorityQueue, buildOperatorRadarBrief } from './home-briefing.ts';

test('buildHomeBriefing formats a concise operator snapshot', () => {
  const summary = buildHomeBriefing({
    seasonName: 'Week 11',
    mocUsd: 0.1234567,
    feedState: 'FRESH',
    freshnessLabel: '9m left',
    cadenceLabel: '5m',
    regimeLabel: 'RISK-ON',
    regimeNote: 'Buy pressure and upward streak are aligned.',
    pulseLabel: 'BUY PRESSURE',
    briefHeadline: 'Opportunity: fresh',
    briefDetail: 'Feed is fresh enough for quick operator checks.',
    nextActionTitle: 'Review leaders',
    nextActionCta: 'Open leaderboard',
    activeDeskCount: 3,
    tradeMixLabel: 'BUY 5 · SELL 2 · HOLD 1',
    watchlistNames: ['Desk Alpha', 'Desk Beta', 'Desk Gamma'],
  });

  assert.match(summary, /PROMPTFOLIO BRIEF/);
  assert.match(summary, /Season: Week 11/);
  assert.match(summary, /MOC: \$0\.123457/);
  assert.match(summary, /Feed: FRESH · freshness 9m left · cadence 5m/);
  assert.match(summary, /Regime: RISK-ON · Buy pressure and upward streak are aligned\./);
  assert.match(summary, /Coverage: 3 active desks/);
  assert.match(summary, /Trade mix: BUY 5 · SELL 2 · HOLD 1/);
  assert.match(summary, /Watchlist: Desk Alpha, Desk Beta, Desk Gamma/);
  assert.match(summary, /Next action: Review leaders \(Open leaderboard\)/);
});

test('buildHomeBriefing falls back when price is missing', () => {
  const summary = buildHomeBriefing({
    seasonName: 'Week 12',
    mocUsd: null,
    feedState: 'EMPTY',
    freshnessLabel: '—',
    cadenceLabel: '—',
    regimeLabel: 'NO FLOW',
    regimeNote: 'Need a fresh tick before the desk can read market posture.',
    pulseLabel: 'AWAITING SIGNAL',
    briefHeadline: 'Watch now: data',
    briefDetail: 'Run EXECUTE TICK to unlock live telemetry.',
    nextActionTitle: 'Run the first tick',
    nextActionCta: 'Open Season HQ',
    activeDeskCount: 0,
    watchlistNames: [],
  });

  assert.match(summary, /MOC: —/);
  assert.match(summary, /Feed: EMPTY · freshness — · cadence —/);
  assert.match(summary, /Coverage: No active desks/);
  assert.match(summary, /Watchlist: No desk watchlist yet/);
});



test('buildLeaderboardBriefing formats a compact standings handoff', () => {
  const summary = buildLeaderboardBriefing({
    seasonName: 'Week 11',
    mocUsd: 0.1234567,
    totalDesks: 4,
    leaderName: 'Desk Alpha',
    leaderEquity: 143.42,
    leaderGap: 8.2,
    spread: 17.55,
    averageEquity: 132.18,
    latestPortfolioUpdate: '2026-03-10T06:45:00.000Z',
    topDeskNames: ['Desk Alpha', 'Desk Beta', 'Desk Gamma'],
  });

  assert.match(summary, /LEADERBOARD BRIEF/);
  assert.match(summary, /Season: Week 11/);
  assert.match(summary, /MOC: \$0\.123457/);
  assert.match(summary, /Active desks: 4/);
  assert.match(summary, /Leader: Desk Alpha leads at \$143\.42/);
  assert.match(summary, /Leader gap: \$8\.20/);
  assert.match(summary, /Field spread: \$17\.55/);
  assert.match(summary, /Average equity: \$132\.18/);
  assert.match(summary, /Top desks: Desk Alpha, Desk Beta, Desk Gamma/);
  assert.match(summary, /Latest rebalance: 2026-03-10T06:45:00\.000Z/);
});

test('buildOperatorChecklist marks ready, watch, and action states', () => {
  assert.deepEqual(
    buildOperatorChecklist({
      agentsCount: 3,
      ticksCount: 5,
      feedState: 'FRESH',
      activeDeskCount: 1,
    }),
    [
      {
        id: 'agent-coverage',
        status: 'ready',
        label: 'Desk coverage',
        detail: '3 desks online and ready for the next cycle.',
        href: '/agents',
        cta: 'Review desks',
      },
      {
        id: 'feed-readiness',
        status: 'ready',
        label: 'Feed readiness',
        detail: 'Fresh tick data is live, so the dashboard is safe for quick operator checks.',
        href: '/season',
        cta: 'Open Season HQ',
      },
      {
        id: 'signal-diversity',
        status: 'watch',
        label: 'Signal diversity',
        detail: 'Only one desk is driving the recent tape. Watch concentration risk.',
        href: '/agents',
        cta: 'Review desk mix',
      },
    ]
  );
});

test('buildOperatorChecklist escalates missing setup and empty feed', () => {
  assert.deepEqual(
    buildOperatorChecklist({
      agentsCount: 0,
      ticksCount: 0,
      feedState: 'EMPTY',
      activeDeskCount: 0,
    }).map((item) => ({ id: item.id, status: item.status, cta: item.cta })),
    [
      { id: 'agent-coverage', status: 'action', cta: 'Open Agent Lab' },
      { id: 'feed-readiness', status: 'action', cta: 'Run first tick' },
      { id: 'signal-diversity', status: 'watch', cta: 'Monitor replay' },
    ]
  );
});

test('buildOperatorPriorityQueue surfaces urgent desk actions before trend work', () => {
  assert.deepEqual(
    buildOperatorPriorityQueue({
      agentsCount: 2,
      ticksCount: 7,
      feedState: 'STALE',
      activeDeskCount: 1,
      directionStreak: 4,
      streakDirection: 'up',
      buyCount: 5,
      sellCount: 1,
    }).map((item) => ({ id: item.id, tone: item.tone, cta: item.cta })),
    [
      { id: 'refresh-feed', tone: 'urgent', cta: 'Refresh feed' },
      { id: 'broaden-coverage', tone: 'watch', cta: 'Review desk mix' },
      { id: 'press-uptrend', tone: 'ready', cta: 'Review leaders' },
    ]
  );
});

test('buildOperatorPriorityQueue falls back to a steady monitoring task', () => {
  assert.deepEqual(
    buildOperatorPriorityQueue({
      agentsCount: 3,
      ticksCount: 6,
      feedState: 'FRESH',
      activeDeskCount: 3,
      directionStreak: 1,
      streakDirection: null,
      buyCount: 2,
      sellCount: 1,
    }),
    [
      {
        id: 'monitor-quiet-board',
        tone: 'ready',
        label: 'Board is steady',
        detail: 'No urgent operator tasks right now. Monitor replay or leaderboard for the next edge.',
        href: '/replay',
        cta: 'Monitor replay',
      },
    ]
  );
});

test('buildOperatorActionPlan formats queue and readiness into a copyable plan', () => {
  const plan = buildOperatorActionPlan({
    queue: [
      {
        id: 'refresh-feed',
        tone: 'urgent',
        label: 'Refresh the feed',
        detail: 'Current tape is stale. Pull a fresh tick before making desk decisions.',
        href: '/season',
        cta: 'Refresh feed',
      },
      {
        id: 'press-uptrend',
        tone: 'ready',
        label: 'Press the leaders',
        detail: 'Momentum is up for 4 ticks. Review top desks before the next rebalance.',
        href: '/leaderboard',
        cta: 'Review leaders',
      },
    ],
    checklist: [
      {
        id: 'agent-coverage',
        status: 'ready',
        label: 'Desk coverage',
        detail: '3 desks online and ready for the next cycle.',
        href: '/agents',
        cta: 'Review desks',
      },
      {
        id: 'feed-readiness',
        status: 'action',
        label: 'Feed readiness',
        detail: 'Tick data exists, but the feed is stale. Refresh it before making decisions.',
        href: '/season',
        cta: 'Refresh feed',
      },
    ],
  });

  assert.match(plan, /OPERATOR ACTION PLAN/);
  assert.match(plan, /1\. Refresh the feed — Current tape is stale\./);
  assert.match(plan, /2\. Press the leaders — Momentum is up for 4 ticks\./);
  assert.match(plan, /READINESS/);
  assert.match(plan, /- READY: Desk coverage — 3 desks online and ready for the next cycle\./);
  assert.match(plan, /- ACTION: Feed readiness — Tick data exists, but the feed is stale\./);
});

test('buildOperatorHandoff creates a concise shift summary', () => {
  const handoff = buildOperatorHandoff({
    seasonName: 'Week 11',
    feedState: 'STALE',
    freshnessLabel: '12m late',
    regimeLabel: 'RISK-OFF',
    pulseLabel: 'SELL PRESSURE',
    topTask: {
      id: 'refresh-feed',
      tone: 'urgent',
      label: 'Refresh the feed',
      detail: 'Current tape is stale. Pull a fresh tick before making desk decisions.',
      href: '/season',
      cta: 'Refresh feed',
    },
    checklist: [
      {
        id: 'agent-coverage',
        status: 'ready',
        label: 'Desk coverage',
        detail: '3 desks online and ready for the next cycle.',
        href: '/agents',
        cta: 'Review desks',
      },
      {
        id: 'feed-readiness',
        status: 'action',
        label: 'Feed readiness',
        detail: 'Tick data exists, but the feed is stale. Refresh it before making decisions.',
        href: '/season',
        cta: 'Refresh feed',
      },
    ],
  });

  assert.match(handoff, /SHIFT HANDOFF/);
  assert.match(handoff, /Season: Week 11/);
  assert.match(handoff, /Feed: STALE \(12m late\)/);
  assert.match(handoff, /Regime: RISK-OFF/);
  assert.match(handoff, /Pulse: SELL PRESSURE/);
  assert.match(handoff, /Top task: Refresh the feed \(Refresh feed\)/);
  assert.match(handoff, /Readiness: Desk coverage: READY · Feed readiness: ACTION/);
});

test('buildOperatorRadarBrief formats top alerts into a copyable summary', () => {
  const radar = buildOperatorRadarBrief({
    seasonName: 'Week 11',
    feedState: 'FRESH',
    alerts: [
      {
        label: 'Feed freshness',
        message: 'Fresh tick data is live, so the dashboard is safe for quick operator checks.',
        cta: 'Open Season HQ',
      },
      {
        label: 'Momentum',
        message: 'BUY flow is dominating the recent tape. Confirm the move is not just one desk chasing.',
        cta: 'Open replay tape',
      },
    ],
  });

  assert.match(radar, /OPERATOR RADAR/);
  assert.match(radar, /Season: Week 11/);
  assert.match(radar, /Feed: FRESH/);
  assert.match(radar, /1\. Feed freshness — Fresh tick data is live/);
  assert.match(radar, /2\. Momentum — BUY flow is dominating the recent tape\./);
});
