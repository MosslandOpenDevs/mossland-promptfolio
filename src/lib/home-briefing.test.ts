import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHomeBriefing, buildOperatorChecklist } from './home-briefing.ts';

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
