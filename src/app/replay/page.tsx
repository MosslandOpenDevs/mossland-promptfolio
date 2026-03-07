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
  const maxEqParam = Array.isArray(searchParams?.maxEq) ? searchParams?.maxEq[0] : searchParams?.maxEq;
  const parsedMaxEq = Number(maxEqParam ?? '');
  const maxEq = Number.isFinite(parsedMaxEq) && parsedMaxEq > 0 ? parsedMaxEq : 0;
  const isEqRangeAutoCorrected = minEq > 0 && maxEq > 0 && minEq > maxEq;
  const [effectiveMinEq, effectiveMaxEq] = isEqRangeAutoCorrected
    ? [maxEq, minEq]
    : [minEq, maxEq];

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
    .filter((agent) => agent.equity >= effectiveMinEq)
    .filter((agent) => (effectiveMaxEq > 0 ? agent.equity <= effectiveMaxEq : true))
    .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : b.equity - a.equity));

  const buildReplayHref = (
    nextSort: 'name' | 'equity',
    nextMinEq: number = effectiveMinEq,
    nextMaxEq: number = effectiveMaxEq,
    nextQuery: string = query
  ) => {
    const params = new URLSearchParams();
    params.set('sort', nextSort);
    const trimmedQuery = nextQuery.trim();
    if (trimmedQuery) params.set('q', trimmedQuery);
    if (nextMinEq > 0) params.set('minEq', String(nextMinEq));
    if (nextMaxEq > 0) params.set('maxEq', String(nextMaxEq));
    return `/replay?${params.toString()}`;
  };

  const minEqPresets = [100, 500, 1_000, 5_000];
  const maxEqPresets = [100, 500, 1_000, 5_000];

  const equityValues = rankedAgents
    .map((agent) => agent.equity)
    .sort((a, b) => b - a);
  const topEquity = equityValues[0] ?? null;
  const bottomEquity = equityValues.length > 0 ? equityValues[equityValues.length - 1] : null;
  const medianEquity =
    equityValues.length === 0
      ? null
      : equityValues.length % 2 === 1
        ? equityValues[Math.floor(equityValues.length / 2)]
        : (equityValues[equityValues.length / 2 - 1] + equityValues[equityValues.length / 2]) / 2;
  const averageEquity =
    equityValues.length === 0 ? null : equityValues.reduce((sum, value) => sum + value, 0) / equityValues.length;
  const equitySpread = topEquity !== null && bottomEquity !== null ? topEquity - bottomEquity : null;
  const equitySpreadRatio =
    equitySpread !== null && medianEquity !== null && medianEquity > 0 ? (equitySpread / medianEquity) * 100 : null;

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
          defaultValue={effectiveMinEq > 0 ? effectiveMinEq : ''}
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
        <input
          name="maxEq"
          type="number"
          min={0}
          step="10"
          defaultValue={effectiveMaxEq > 0 ? effectiveMaxEq : ''}
          placeholder="max equity"
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
        {(query || effectiveMinEq > 0 || effectiveMaxEq > 0) && (
          <Link href={buildReplayHref(sort, 0, 0)} style={{ color: '#9ab', fontSize: 12 }}>
            clear
          </Link>
        )}
      </form>

      {(query || effectiveMinEq > 0 || effectiveMaxEq > 0) && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
          <span style={{ opacity: 0.7 }}>active filters:</span>
          {query && (
            <Link href={buildReplayHref(sort, effectiveMinEq, effectiveMaxEq, '')} style={activeFilterChip}>
              q: {query} ✕
            </Link>
          )}
          {effectiveMinEq > 0 && (
            <Link href={buildReplayHref(sort, 0, effectiveMaxEq)} style={activeFilterChip}>
              min ≥ ${effectiveMinEq.toLocaleString()} ✕
            </Link>
          )}
          {effectiveMaxEq > 0 && (
            <Link href={buildReplayHref(sort, effectiveMinEq, 0)} style={activeFilterChip}>
              max ≤ ${effectiveMaxEq.toLocaleString()} ✕
            </Link>
          )}
        </div>
      )}

      {isEqRangeAutoCorrected && (
        <div style={{ fontSize: 12, opacity: 0.75, color: '#ffd38f' }}>
          min/max equity values were reversed, so the range was auto-corrected.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, opacity: 0.9 }}>
        <span style={{ opacity: 0.75 }}>quick min equity:</span>
        {minEqPresets.map((preset) => {
          const active = effectiveMinEq === preset;
          return (
            <Link
              key={preset}
              href={buildReplayHref(sort, active ? 0 : preset, effectiveMaxEq)}
              style={{
                border: `1px solid ${active ? '#2a6b3f' : '#253042'}`,
                background: active ? '#10311d' : '#0b0f14',
                color: active ? '#7ee787' : '#9ab',
                borderRadius: 999,
                padding: '4px 10px',
                fontWeight: 700,
              }}
              aria-current={active ? 'true' : undefined}
              title={active ? 'disable min equity filter' : 'apply min equity filter'}
            >
              ≥ ${preset.toLocaleString()}
            </Link>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, opacity: 0.9 }}>
        <span style={{ opacity: 0.75 }}>quick max equity:</span>
        {maxEqPresets.map((preset) => {
          const active = effectiveMaxEq === preset;
          return (
            <Link
              key={preset}
              href={buildReplayHref(sort, effectiveMinEq, active ? 0 : preset)}
              style={{
                border: `1px solid ${active ? '#6b4f2a' : '#253042'}`,
                background: active ? '#2f2413' : '#0b0f14',
                color: active ? '#ffd38f' : '#9ab',
                borderRadius: 999,
                padding: '4px 10px',
                fontWeight: 700,
              }}
              aria-current={active ? 'true' : undefined}
              title={active ? 'disable max equity filter' : 'apply max equity filter'}
            >
              ≤ ${preset.toLocaleString()}
            </Link>
          );
        })}
      </div>

      {rankedAgents.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            fontSize: 12,
            opacity: 0.9,
          }}
        >
          <span style={summaryBadge}>top ${topEquity!.toFixed(2)}</span>
          <span style={summaryBadge}>median ${medianEquity!.toFixed(2)}</span>
          <span style={summaryBadge}>avg ${averageEquity!.toFixed(2)}</span>
          <span style={summaryBadge}>bottom ${bottomEquity!.toFixed(2)}</span>
          {equitySpread !== null && <span style={summaryBadge}>spread ${equitySpread.toFixed(2)}</span>}
          {equitySpreadRatio !== null && <span style={summaryBadge}>spread {equitySpreadRatio.toFixed(1)}%</span>}
        </div>
      )}

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
              <Link
                href={`/agents/${agent.id}/replay?from=${encodeURIComponent(buildReplayHref(sort, effectiveMinEq, effectiveMaxEq))}`}
                style={{ color: '#7ee787' }}
              >
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
          {query || effectiveMinEq > 0 || effectiveMaxEq > 0 ? `No agents matched current filters.` : 'No agents yet.'}
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

const summaryBadge: React.CSSProperties = {
  border: '1px solid #253042',
  borderRadius: 999,
  padding: '4px 10px',
  background: '#0b0f14',
  color: '#9ab',
  fontWeight: 700,
};

const activeFilterChip: React.CSSProperties = {
  border: '1px solid #253042',
  borderRadius: 999,
  padding: '4px 10px',
  background: '#131a24',
  color: '#c2d4ea',
  textDecoration: 'none',
  fontWeight: 600,
};
