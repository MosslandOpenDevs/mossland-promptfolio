import Link from 'next/link';
import { db } from '../lib/db';
import { getLocale, t } from '../lib/i18n';
import TerminalLog, { type TerminalRow } from '../components/TerminalLog';
import ZineStamp from '../components/ZineStamp';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const locale = getLocale();
  const d = db();

  const season = d.prepare(`SELECT * FROM seasons ORDER BY created_at DESC LIMIT 1`).get() as any;
  const lastTick = season
    ? (d.prepare(`SELECT * FROM ticks WHERE season_id=? ORDER BY ts DESC LIMIT 1`).get(season.id) as any)
    : null;

  const mocUsd = lastTick?.moc_usd ?? null;

  const trades = season
    ? (d.prepare(
        `SELECT tr.*, tk.ts as tick_ts, a.name as agent_name
         FROM trades tr
         JOIN ticks tk ON tk.id = tr.tick_id
         JOIN agents a ON a.id = tr.agent_id
         WHERE tr.season_id=?
         ORDER BY tk.ts DESC, tr.created_at DESC
         LIMIT 8`
      ).all(season.id) as any[])
    : [];

  const rows: TerminalRow[] = trades.map((tr: any) => ({
    ts: String(tr.tick_ts).slice(11, 19),
    kind: tr.side,
    title: `${tr.agent_name}`,
    lines: [`> ${tr.side} ${Number(tr.moc_units).toFixed(2)} MOC @ $${Number(tr.price_usd).toFixed(6)}`, `"${tr.reason}"`],
    highlight: tr.side === 'BUY' ? 'primary' : tr.side === 'SELL' ? 'tape' : undefined,
  }));

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
              <span className="pf-pill">ticks: {season ? d.prepare(`SELECT count(*) as c FROM ticks WHERE season_id=?`).get(season.id).c : 0}</span>
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

            <form action="/api/tick" method="post">
              <button className="pf-btn pf-btn--primary" style={{ width: '100%', padding: '14px 12px', fontSize: 16 }} type="submit" disabled={!season}>
                EXECUTE TICK
              </button>
              {!season && <div className="pf-dim" style={{ fontSize: 11, marginTop: 8 }}>{t(locale, 'createSeasonFirst')}</div>}
            </form>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link href="/agents" className="pf-btn" style={{ flex: 1 }}>AGENT LAB</Link>
              <Link href="/leaderboard" className="pf-btn" style={{ flex: 1 }}>RANK</Link>
            </div>

            <div className="pf-dim" style={{ fontSize: 10, textAlign: 'center' }}>
              * WARNING: Unregulated paper trading zone.
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
