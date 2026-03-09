import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHomeBriefing } from './home-briefing.ts';

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
  });

  assert.match(summary, /PROMPTFOLIO BRIEF/);
  assert.match(summary, /Season: Week 11/);
  assert.match(summary, /MOC: \$0\.123457/);
  assert.match(summary, /Feed: FRESH · freshness 9m left · cadence 5m/);
  assert.match(summary, /Regime: RISK-ON · Buy pressure and upward streak are aligned\./);
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
  });

  assert.match(summary, /MOC: —/);
  assert.match(summary, /Feed: EMPTY · freshness — · cadence —/);
});
