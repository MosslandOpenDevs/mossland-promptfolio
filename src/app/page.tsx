import Link from 'next/link';
import { db } from '../lib/db';
import { ensureWeeklySeason } from '../lib/weekly';
import { getLocale, t } from '../lib/i18n';
import TerminalLog, { type TerminalRow } from '../components/TerminalLog';
import ZineStamp from '../components/ZineStamp';
import ExecuteTickButton from '../components/ExecuteTickButton';
import { memeLine } from '../lib/meme';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const locale = getLocale();
  const d = db();

  // Auto-create weekly season so the product always feels "alive".
  const season = ensureWeeklySeason();
  const lastTick = d.prepare(`SELECT * FROM ticks WHERE season_id=? ORDER BY ts DESC LIMIT 1`).get(season.id) as any;

  const mocUsd = lastTick?.moc_usd ?? null;

  const ticksCountRow = d.prepare(`SELECT count(*) as c FROM ticks WHERE season_id=?`).get(season.id) as any;
  const ticksCount = Number(ticksCountRow?.c ?? 0);

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
  const recentHeadline = latestTrade
    ? `${latestTrade.agent_name} ${latestTrade.side} ${Number(latestTrade.moc_units).toFixed(2)} MOC`
    : 'No trade headlines yet';
  const recentAgents = Array.from(new Set(trades.map((tr) => String(tr.agent_name)).filter(Boolean))).slice(0, 4);

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
              {recentAgents.length > 0 ? (
                recentAgents.map((name) => (
                  <span key={name} className="pf-pill">desk: {name}</span>
                ))
              ) : (
                <span className="pf-pill">desk: waiting for agents</span>
              )}
            </div>
          </div>

          <div className="pf-card">
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
