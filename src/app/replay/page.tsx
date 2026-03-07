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
  const qParam = Array.isArray(searchParams?.q) ? searchParams?.q[0] : searchParams?.q;
  const query = (qParam ?? '').trim();
  const queryLower = query.toLowerCase();
  const minEqParam = Array.isArray(searchParams?.minEq) ? searchParams?.minEq[0] : searchParams?.minEq;
  const parsedMinEq = Number(minEqParam ?? '');
  const minEq = Number.isFinite(parsedMinEq) && parsedMinEq > 0 ? parsedMinEq : 0;

  const agents = d
    .prepare(
      `SELECT a.id, a.name, a.avatar_emoji, p.cash_usd, p.moc_units
       FROM agents a
       LEFT JOIN portfolios p ON p.agent_id=a.id AND p.season_id=?
       ORDER BY a.created_at DESC`
    )
    .all(season?.id ?? '') as any[];

  const computedAgents = agents.map((agent) => {
    const cash = Number(agent.cash_usd ?? season?.starting_cash_usd ?? 0);
    const units = Number(agent.moc_units ?? 0);
    const equity = cash + units * mocUsd;
    return { ...agent, cash, units, equity };
  });

  const rankedAgents = computedAgents
    .filter((agent) => {
      if (!queryLower) return true;
      const haystack = `${agent.name ?? ''} ${agent.id ?? ''}`.toLowerCase();
      return haystack.includes(queryLower);
    })
    .filter((agent) => agent.equity >= minEq)
    .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : b.equity - a.equity));

  const buildReplayHref = (nextSort: 'name' | 'equity', nextMinEq: number = minEq) => {
    const params = new URLSearchParams();
    params.set('sort', nextSort);
    if (query) params.set('q', query);
    if (nextMinEq > 0) params.set('minEq', String(nextMinEq));
    return `/replay?${params.toString()}`;
  };

  const minEqPresets = [100, 500, 1_000, 5_000];

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
        <Link href={buildReplayHref('equity')} style={{ color: sort === 'equity' ? '#7ee787' : '#9ab' }}>
          equity
        </Link>
        <Link href={buildReplayHref('name')} style={{ color: sort === 'name' ? '#7ee787' : '#9ab' }}>
          name
        </Link>
        <span style={{ opacity: 0.7 }}>
          {rankedAgents.length}/{computedAgents.length} shown
        </span>
      </div>

      <form method="get" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="hidden" name="sort" value={sort} />
        <input
          name="q"
          defaultValue={query}
          placeholder="filter by agent name or id"
          style={{
            background: '#0b0f14',
            border: '1px solid #253042',
            color: '#e6edf3',
            borderRadius: 8,
            padding: '8px 10px',
            minWidth: 220,
          }}
        />
        <input
          name="minEq"
          type="number"
          min={0}
          step="10"
          defaultValue={minEq > 0 ? minEq : ''}
          placeholder="min equity"
          style={{
            background: '#0b0f14',
            border: '1px solid #253042',
            color: '#e6edf3',
            borderRadius: 8,
            padding: '8px 10px',
            width: 130,
          }}
        />
        <button type="submit" style={filterButton}>apply</button>
        {(query || minEq > 0) && (
          <Link href={buildReplayHref(sort, 0)} style={{ color: '#9ab', fontSize: 12 }}>
            clear
          </Link>
        )}
      </form>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, opacity: 0.9 }}>
        <span style={{ opacity: 0.75 }}>quick min equity:</span>
        {minEqPresets.map((preset) => {
          const active = minEq === preset;
          return (
            <Link
              key={preset}
              href={buildReplayHref(sort, preset)}
              style={{
                border: `1px solid ${active ? '#2a6b3f' : '#253042'}`,
                background: active ? '#10311d' : '#0b0f14',
                color: active ? '#7ee787' : '#9ab',
                borderRadius: 999,
                padding: '4px 10px',
                fontWeight: 700,
              }}
            >
              ≥ ${preset.toLocaleString()}
            </Link>
          );
        })}
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

      {rankedAgents.length === 0 && (
        <div style={{ opacity: 0.7 }}>
          {query || minEq > 0 ? `No agents matched current filters.` : 'No agents yet.'}
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

const filterButton: React.CSSProperties = {
  border: '1px solid #2a6b3f',
  borderRadius: 8,
  padding: '8px 12px',
  background: '#10311d',
  color: '#7ee787',
  fontWeight: 700,
  cursor: 'pointer',
};
