import Link from 'next/link';
import CopyUrlButton from '../../components/CopyUrlButton';
import { db } from '../../lib/db';
import { getLocale } from '../../lib/i18n';
import { ensureWeeklySeason } from '../../lib/weekly';

export const dynamic = 'force-dynamic';

export default async function ReplayIndexPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await getLocale();
  const sp = await searchParams;
  const d = db();

  const season = ensureWeeklySeason();
  const lastTick = season
    ? (d.prepare(`SELECT * FROM ticks WHERE season_id=? ORDER BY ts DESC LIMIT 1`).get(season.id) as any)
    : null;
  const mocUsd = Number(lastTick?.moc_usd ?? 0);

  const sortParam = Array.isArray(sp?.sort) ? sp?.sort[0] : sp?.sort;
  const sort = sortParam === 'name' || sortParam === 'pnl' || sortParam === 'roi' ? sortParam : 'equity';
  const qParam = Array.isArray(sp?.q) ? sp?.q[0] : sp?.q;
  const query = (qParam ?? '').trim();
  const queryLower = query.toLowerCase();
  const minEqParam = Array.isArray(sp?.minEq) ? sp?.minEq[0] : sp?.minEq;
  const parsedMinEq = Number(minEqParam ?? '');
  const minEq = Number.isFinite(parsedMinEq) && parsedMinEq > 0 ? parsedMinEq : 0;
  const maxEqParam = Array.isArray(sp?.maxEq) ? sp?.maxEq[0] : sp?.maxEq;
  const parsedMaxEq = Number(maxEqParam ?? '');
  const maxEq = Number.isFinite(parsedMaxEq) && parsedMaxEq > 0 ? parsedMaxEq : 0;
  const profitableParam = Array.isArray(sp?.profitable) ? sp?.profitable[0] : sp?.profitable;
  const profitableOnly = profitableParam === '1' || profitableParam === 'true';
  const lossOnlyParam = Array.isArray(sp?.lossOnly) ? sp?.lossOnly[0] : sp?.lossOnly;
  const requestedLossOnly = lossOnlyParam === '1' || lossOnlyParam === 'true';
  const lossOnly = !profitableOnly && requestedLossOnly;
  const isProfitFilterConflict = profitableOnly && requestedLossOnly;
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

  const startingCashUsd = Number(season?.starting_cash_usd ?? 0);

  const computedAgents = agents.map((agent) => {
    const cash = Number(agent.cash_usd ?? startingCashUsd);
    const units = Number(agent.moc_units ?? 0);
    const equity = cash + units * mocUsd;
    const pnl = equity - startingCashUsd;
    const roi = startingCashUsd > 0 ? (pnl / startingCashUsd) * 100 : 0;
    return { ...agent, cash, units, equity, pnl, roi };
  });

  const rankedAgents = computedAgents
    .filter((agent) => {
      if (!queryLower) return true;
      const haystack = `${agent.name ?? ''} ${agent.id ?? ''}`.toLowerCase();
      return haystack.includes(queryLower);
    })
    .filter((agent) => agent.equity >= effectiveMinEq)
    .filter((agent) => (effectiveMaxEq > 0 ? agent.equity <= effectiveMaxEq : true))
    .filter((agent) => (profitableOnly ? agent.pnl > 0 : true))
    .filter((agent) => (lossOnly ? agent.pnl < 0 : true))
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'pnl') return b.pnl - a.pnl;
      if (sort === 'roi') return b.roi - a.roi;
      return b.equity - a.equity;
    });

  const fullEquityValues = computedAgents
    .map((agent) => agent.equity)
    .sort((a, b) => b - a);
  const liveTopEquity = fullEquityValues[0] ?? null;
  const liveBottomEquity = fullEquityValues.length > 0 ? fullEquityValues[fullEquityValues.length - 1] : null;
  const isMinEqAboveLiveRange = effectiveMinEq > 0 && liveTopEquity !== null && effectiveMinEq > liveTopEquity;
  const isMaxEqBelowLiveRange = effectiveMaxEq > 0 && liveBottomEquity !== null && effectiveMaxEq < liveBottomEquity;
  const canSnapToLiveRange = liveTopEquity !== null && liveBottomEquity !== null && liveBottomEquity <= liveTopEquity;

  const buildReplayHref = (
    nextSort: 'name' | 'equity' | 'pnl' | 'roi',
    nextMinEq: number = effectiveMinEq,
    nextMaxEq: number = effectiveMaxEq,
    nextQuery: string = query,
    nextProfitableOnly: boolean = profitableOnly,
    nextLossOnly: boolean = requestedLossOnly
  ) => {
    const params = new URLSearchParams();
    params.set('sort', nextSort);
    const trimmedQuery = nextQuery.trim();
    if (trimmedQuery) params.set('q', trimmedQuery);
    if (nextMinEq > 0) params.set('minEq', String(nextMinEq));
    if (nextMaxEq > 0) params.set('maxEq', String(nextMaxEq));
    if (nextProfitableOnly) params.set('profitable', '1');
    if (nextLossOnly) params.set('lossOnly', '1');
    const queryString = params.toString();
    return queryString ? `/replay?${queryString}` : '/replay';
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
  const profitableCount = rankedAgents.filter((agent) => agent.pnl > 0).length;
  const profitableRatio = rankedAgents.length > 0 ? (profitableCount / rankedAgents.length) * 100 : null;
  const averagePnl =
    rankedAgents.length === 0
      ? null
      : rankedAgents.reduce((sum, agent) => sum + agent.pnl, 0) / rankedAgents.length;

  const dynamicEquityBands = [
    averageEquity !== null ? { key: 'avg', label: `avg+ · ≥ $${averageEquity.toFixed(0)}`, min: Math.ceil(averageEquity), max: 0 } : null,
    medianEquity !== null ? { key: 'median', label: `median+ · ≥ $${medianEquity.toFixed(0)}`, min: Math.ceil(medianEquity), max: 0 } : null,
    averageEquity !== null ? { key: 'below-avg', label: `below avg · ≤ $${averageEquity.toFixed(0)}`, min: 0, max: Math.floor(averageEquity) } : null,
  ].filter((band): band is { key: string; label: string; min: number; max: number } => Boolean(band));

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
        <Link href={buildReplayHref('pnl')} style={{ color: sort === 'pnl' ? '#7ee787' : '#9ab' }}>
          pnl
        </Link>
        <Link href={buildReplayHref('name')} style={{ color: sort === 'name' ? '#7ee787' : '#9ab' }}>
          name
        </Link>
        <Link href={buildReplayHref('roi')} style={{ color: sort === 'roi' ? '#7ee787' : '#9ab' }}>
          roi
        </Link>
        <span style={{ opacity: 0.7 }}>
          {rankedAgents.length}/{computedAgents.length} shown
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <CopyUrlButton href={buildReplayHref(sort, effectiveMinEq, effectiveMaxEq, query, profitableOnly, requestedLossOnly)} />
        <Link href={buildReplayHref(sort, effectiveMinEq, effectiveMaxEq, query, true, false)} style={quickActionLink(profitableOnly && !requestedLossOnly)}>
          winners only
        </Link>
        <Link href={buildReplayHref(sort, effectiveMinEq, effectiveMaxEq, query, false, true)} style={quickActionLink(lossOnly)}>
          underwater only
        </Link>
        <Link href={buildReplayHref(sort, 0, 0, '', false, false)} style={quickActionLink(false)}>
          reset view
        </Link>
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
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12, opacity: 0.85 }}>
          <input name="profitable" type="checkbox" value="1" defaultChecked={profitableOnly} />
          profitable only
        </label>
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12, opacity: 0.85 }}>
          <input name="lossOnly" type="checkbox" value="1" defaultChecked={requestedLossOnly} />
          loss only
        </label>
        <button type="submit" style={filterButton}>apply</button>
        {(query || effectiveMinEq > 0 || effectiveMaxEq > 0 || profitableOnly || requestedLossOnly) && (
          <Link href={buildReplayHref(sort, 0, 0, '', false, false)} style={{ color: '#9ab', fontSize: 12 }}>
            clear
          </Link>
        )}
      </form>

      {(query || effectiveMinEq > 0 || effectiveMaxEq > 0 || profitableOnly || requestedLossOnly) && (
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
          {profitableOnly && (
            <Link
              href={buildReplayHref(sort, effectiveMinEq, effectiveMaxEq, query, false, requestedLossOnly)}
              style={activeFilterChip}
            >
              profitable only ✕
            </Link>
          )}
          {requestedLossOnly && (
            <Link href={buildReplayHref(sort, effectiveMinEq, effectiveMaxEq, query, profitableOnly, false)} style={activeFilterChip}>
              loss only ✕
            </Link>
          )}
        </div>
      )}

      {isEqRangeAutoCorrected && (
        <div style={{ fontSize: 12, opacity: 0.75, color: '#ffd38f' }}>
          min/max equity values were reversed, so the range was auto-corrected.
        </div>
      )}

      {isProfitFilterConflict && (
        <div style={{ fontSize: 12, opacity: 0.75, color: '#ffd38f' }}>
          both “profitable only” and “loss only” were selected; showing profitable-only results.
        </div>
      )}

      {(isMinEqAboveLiveRange || isMaxEqBelowLiveRange) && canSnapToLiveRange && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 12, opacity: 0.8, color: '#b8cbff' }}>
            current equity range sits outside the live desk window (${liveBottomEquity!.toFixed(2)} – ${liveTopEquity!.toFixed(2)}).
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
            {isMinEqAboveLiveRange && (
              <Link
                href={buildReplayHref(sort, Math.ceil(liveTopEquity!), effectiveMaxEq, query, profitableOnly, requestedLossOnly)}
                style={quickActionLink(false)}
              >
                snap min to live top
              </Link>
            )}
            {isMaxEqBelowLiveRange && (
              <Link
                href={buildReplayHref(sort, effectiveMinEq, Math.floor(liveBottomEquity!), query, profitableOnly, requestedLossOnly)}
                style={quickActionLink(false)}
              >
                snap max to live floor
              </Link>
            )}
            <Link
              href={buildReplayHref(sort, Math.floor(liveBottomEquity!), Math.ceil(liveTopEquity!), query, profitableOnly, requestedLossOnly)}
              style={quickActionLink(false)}
            >
              fit live range
            </Link>
          </div>
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

      {dynamicEquityBands.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, opacity: 0.9 }}>
          <span style={{ opacity: 0.75 }}>live equity bands:</span>
          {dynamicEquityBands.map((band) => {
            const active = effectiveMinEq === band.min && effectiveMaxEq === band.max;
            return (
              <Link
                key={band.key}
                href={buildReplayHref(sort, active ? 0 : band.min, active ? 0 : band.max, query, profitableOnly, requestedLossOnly)}
                style={{
                  border: `1px solid ${active ? '#2f5fff' : '#253042'}`,
                  background: active ? '#10204b' : '#0b0f14',
                  color: active ? '#b8cbff' : '#9ab',
                  borderRadius: 999,
                  padding: '4px 10px',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
                aria-current={active ? 'true' : undefined}
                title={active ? 'disable live equity band filter' : `apply ${band.label} filter`}
              >
                {band.label}
              </Link>
            );
          })}
        </div>
      )}

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
          {averagePnl !== null && (
            <span style={summaryBadge}>avg pnl {averagePnl >= 0 ? '+' : '-'}${Math.abs(averagePnl).toFixed(2)}</span>
          )}
          {profitableRatio !== null && (
            <span style={summaryBadge}>profitable {profitableCount}/{rankedAgents.length} ({profitableRatio.toFixed(1)}%)</span>
          )}
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
                {(sort === 'equity' || sort === 'pnl' || sort === 'roi') && (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>#{index + 1}</div>
                )}
              </div>
              <Link
                href={`/agents/${agent.id}/replay?from=${encodeURIComponent(
                  buildReplayHref(sort, effectiveMinEq, effectiveMaxEq, query, profitableOnly, requestedLossOnly)
                )}`}
                style={{ color: '#7ee787' }}
              >
                open timeline →
              </Link>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8, opacity: 0.8, fontSize: 13, flexWrap: 'wrap' }}>
              <div>equity ${agent.equity.toFixed(2)}</div>
              <div>
                pnl {agent.pnl >= 0 ? '+' : '-'}${Math.abs(agent.pnl).toFixed(2)}
              </div>
              <div>
                roi {agent.roi >= 0 ? '+' : '-'}{Math.abs(agent.roi).toFixed(2)}%
              </div>
              <div>cash ${agent.cash.toFixed(2)}</div>
              <div>MOC {agent.units.toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>

      {rankedAgents.length === 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ opacity: 0.7 }}>
            {query || effectiveMinEq > 0 || effectiveMaxEq > 0 || profitableOnly || lossOnly
              ? `No agents matched current filters.`
              : 'No agents yet.'}
          </div>

          {(query || effectiveMinEq > 0 || effectiveMaxEq > 0 || profitableOnly || requestedLossOnly) && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
              <span style={{ opacity: 0.7 }}>recovery:</span>
              {query && (
                <Link href={buildReplayHref(sort, effectiveMinEq, effectiveMaxEq, '', profitableOnly, requestedLossOnly)} style={activeFilterChip}>
                  clear query
                </Link>
              )}
              {effectiveMinEq > 0 && (
                <Link href={buildReplayHref(sort, 0, effectiveMaxEq, query, profitableOnly, requestedLossOnly)} style={activeFilterChip}>
                  remove min
                </Link>
              )}
              {effectiveMaxEq > 0 && (
                <Link href={buildReplayHref(sort, effectiveMinEq, 0, query, profitableOnly, requestedLossOnly)} style={activeFilterChip}>
                  remove max
                </Link>
              )}
              {profitableOnly && (
                <Link href={buildReplayHref(sort, effectiveMinEq, effectiveMaxEq, query, false, requestedLossOnly)} style={activeFilterChip}>
                  disable winners only
                </Link>
              )}
              {requestedLossOnly && (
                <Link href={buildReplayHref(sort, effectiveMinEq, effectiveMaxEq, query, profitableOnly, false)} style={activeFilterChip}>
                  disable underwater only
                </Link>
              )}
              <Link href={buildReplayHref(sort, 0, 0, '', false, false)} style={quickActionLink(false)}>
                reset view
              </Link>
            </div>
          )}
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

function quickActionLink(active: boolean): React.CSSProperties {
  return {
    border: `1px solid ${active ? '#2a6b3f' : '#253042'}`,
    borderRadius: 999,
    padding: '6px 10px',
    background: active ? '#10311d' : '#0b0f14',
    color: active ? '#7ee787' : '#9ab',
    textDecoration: 'none',
    fontSize: 12,
    fontWeight: 700,
  };
}
