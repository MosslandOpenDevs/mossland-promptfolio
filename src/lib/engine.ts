import { db } from './db';
import { id, nowIso } from './ids';

export type TradeSide = 'BUY' | 'SELL' | 'HOLD';

// Meme-simple default strategy (no LLM yet):
// - If prompt contains 'degen' => go 90% MOC
// - If prompt contains 'monk' => go 0% MOC
// - Else 50/50 rebalance
export function decideTargetMocRatio(prompt: string): number {
  const p = prompt.toLowerCase();
  if (p.includes('degen') || p.includes('all in') || p.includes('올인')) return 0.9;
  if (p.includes('monk') || p.includes('no trade') || p.includes('금욕')) return 0.0;
  return 0.5;
}

export function runTick(seasonId: string, mocUsd: number) {
  const d = db();
  const tickId = id('tick');
  const ts = nowIso();

  d.prepare(
    `INSERT INTO ticks (id, season_id, ts, moc_usd, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(tickId, seasonId, ts, mocUsd, ts);

  const agents = d.prepare(`SELECT id, name, prompt FROM agents`).all() as Array<{id:string; name:string; prompt:string}>;

  const upsertPortfolio = d.prepare(
    `INSERT INTO portfolios (season_id, agent_id, cash_usd, moc_units, updated_at)
     VALUES (@season_id, @agent_id, @cash_usd, @moc_units, @updated_at)
     ON CONFLICT(season_id, agent_id) DO UPDATE SET
       cash_usd=excluded.cash_usd,
       moc_units=excluded.moc_units,
       updated_at=excluded.updated_at`
  );

  const getPortfolio = d.prepare(
    `SELECT season_id, agent_id, cash_usd, moc_units FROM portfolios WHERE season_id=? AND agent_id=?`
  );

  const getSeason = d.prepare(`SELECT starting_cash_usd FROM seasons WHERE id=?`).get(seasonId) as any;
  if (!getSeason) throw new Error('season not found');

  for (const a of agents) {
    const existing = getPortfolio.get(seasonId, a.id) as any;
    let cash = existing?.cash_usd ?? getSeason.starting_cash_usd;
    let moc = existing?.moc_units ?? 0;

    const equity = cash + moc * mocUsd;
    const targetRatio = decideTargetMocRatio(a.prompt);
    const targetMocUsd = equity * targetRatio;
    const targetMocUnits = targetMocUsd / mocUsd;
    const deltaUnits = targetMocUnits - moc;

    let side: TradeSide = 'HOLD';
    let tradeUnits = 0;
    let reason = 'holding';

    // dead-simple: rebalance if > 2% equity drift
    const driftUsd = Math.abs(deltaUnits * mocUsd);
    if (equity > 0 && driftUsd / equity > 0.02) {
      tradeUnits = deltaUnits;
      if (tradeUnits > 0) {
        side = 'BUY';
        const cost = tradeUnits * mocUsd;
        const spend = Math.min(cost, cash); // no leverage
        const units = spend / mocUsd;
        cash -= spend;
        moc += units;
        tradeUnits = units;
        reason = `rebalance to ${(targetRatio*100).toFixed(0)}% MOC (meme strategy from prompt)`;
      } else {
        side = 'SELL';
        const units = Math.min(-tradeUnits, moc);
        cash += units * mocUsd;
        moc -= units;
        tradeUnits = units;
        reason = `rebalance to ${(targetRatio*100).toFixed(0)}% MOC (meme strategy from prompt)`;
      }

      d.prepare(
        `INSERT INTO trades (id, season_id, agent_id, tick_id, side, moc_units, price_usd, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id('trade'), seasonId, a.id, tickId, side, tradeUnits, mocUsd, reason, ts);
    }

    upsertPortfolio.run({
      season_id: seasonId,
      agent_id: a.id,
      cash_usd: cash,
      moc_units: moc,
      updated_at: ts,
    });
  }

  return { tickId, ts, mocUsd, agents: agents.length };
}
