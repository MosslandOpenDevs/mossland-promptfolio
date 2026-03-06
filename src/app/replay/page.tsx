import Link from 'next/link';
import { db } from '../../lib/db';
import { getLocale } from '../../lib/i18n';

export const dynamic = 'force-dynamic';

export default async function ReplayIndexPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  getLocale();
  const d = db();

  const season = d.prepare(`SELECT * FROM seasons ORDER BY created_at DESC LIMIT 1`).get() as any;
  const lastTick = season
    ? (d.prepare(`SELECT * FROM ticks WHERE season_id=? ORDER BY ts DESC LIMIT 1`).get(season.id) as any)
    : null;
  const mocUsd = Number(lastTick?.moc_usd ?? 0);

  const sortParam = Array.isArray(searchParams?.sort) ? searchParams?.sort[0] : searchParams?.sort;
  const sort = sortParam === 'name' ? 'name' : 'equity';

  const agents = d
    .prepare(
      `SELECT a.id, a.name, a.avatar_emoji, p.cash_usd, p.moc_units
       FROM agents a
       LEFT JOIN portfolios p ON p.agent_id=a.id AND p.season_id=?
       ORDER BY a.created_at DESC`
    )
    .all(season?.id ?? '') as any[];

  const rankedAgents = agents
    .map((agent) => {
      const cash = Number(agent.cash_usd ?? season?.starting_cash_usd ?? 0);
      const units = Number(agent.moc_units ?? 0);
      const equity = cash + units * mocUsd;
      return { ...agent, cash, units, equity };
    })
    .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : b.equity - a.equity));

  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Replay</h2>
        <div style={{ opacity: 0.7, fontSize: 12 }}>
          season {season?.name ?? '—'} | moc_usd {mocUsd ? `$${mocUsd.toFixed(6)}` : 'run a tick'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12, opacity: 0.85 }}>
        <span>sort:</span>
        <Link href="/replay?sort=equity" style={{ color: sort === 'equity' ? '#7ee787' : '#9ab' }}>
          equity
        </Link>
        <Link href="/replay?sort=name" style={{ color: sort === 'name' ? '#7ee787' : '#9ab' }}>
          name
        </Link>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {rankedAgents.map((agent, index) => (
          <div key={agent.id} style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 22 }}>{agent.avatar_emoji}</div>
                <div style={{ fontWeight: 800 }}>{agent.name}</div>
                {sort === 'equity' && (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>#{index + 1}</div>
                )}
              </div>
              <Link href={`/agents/${agent.id}/replay`} style={{ color: '#7ee787' }}>
                open timeline →
              </Link>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8, opacity: 0.8, fontSize: 13, flexWrap: 'wrap' }}>
              <div>equity ${agent.equity.toFixed(2)}</div>
              <div>cash ${agent.cash.toFixed(2)}</div>
              <div>MOC {agent.units.toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>

      {rankedAgents.length === 0 && <div style={{ opacity: 0.7 }}>No agents yet.</div>}
    </main>
  );
}

const card: React.CSSProperties = {
  border: '1px solid #253042',
  borderRadius: 12,
  padding: 12,
  background: '#0f1720',
};
