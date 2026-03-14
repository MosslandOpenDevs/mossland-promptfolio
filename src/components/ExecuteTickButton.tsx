'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Spinner from './Spinner';
import { buildNetworkRetryHint, buildTickErrorCode, buildTickErrorMessage, buildTickRetryHint, buildTickSuccessMessage } from '../lib/tick-feedback';

export default function ExecuteTickButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [seed, setSeed] = useState(() => String(Date.now()));
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string; hint?: string | null; code?: string | null } | null>(null);

  async function run() {
    if (disabled || busy) return;
    setBusy(true);
    setSeed(String(Date.now()));
    setNotice(null);
    try {
      const res = await fetch('/api/tick', {
        method: 'POST',
        headers: {
          'x-pf-ajax': '1',
        },
      });
      const bodyText = await res.text();
      if (!res.ok) {
        const contentType = res.headers.get('content-type');
        setNotice({
          type: 'error',
          text: buildTickErrorMessage({
            status: res.status,
            bodyText,
            contentType,
          }),
          hint: buildTickRetryHint(
            {
              status: res.status,
              bodyText,
              contentType,
            },
            res.headers.get('retry-after')
          ),
          code: buildTickErrorCode({
            status: res.status,
            bodyText,
            contentType,
          }),
        });
        return;
      }
      let mocUsd = Number.NaN;
      try {
        const parsed = JSON.parse(bodyText) as { mocUsd?: unknown };
        if (typeof parsed.mocUsd === 'number') {
          mocUsd = parsed.mocUsd;
        }
      } catch {
        // Keep fallback success message if body is not JSON.
      }
      setNotice({ type: 'success', text: buildTickSuccessMessage(mocUsd) });
      router.refresh();
    } catch {
      setNotice({
        type: 'error',
        text: 'Network error while executing tick. Please retry.',
        hint: buildNetworkRetryHint(),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <button
        className="pf-btn pf-btn--primary"
        style={{ width: '100%', padding: '14px 12px', fontSize: 16, opacity: disabled ? 0.6 : 1 }}
        type="button"
        onClick={run}
        disabled={disabled || busy}
        aria-busy={busy}
        aria-label={busy ? 'Executing market tick' : 'Execute market tick'}
      >
        {busy ? <Spinner seed={seed} label="EXECUTING" /> : 'EXECUTE TICK'}
      </button>
      <div aria-live="polite" role="status" className="pf-dim" style={{ fontSize: 10 }}>
        {busy ? 'tip: this is paper trading. if it breaks, it’s lore.' : null}
      </div>
      {notice && (
        <div
          className="pf-dim"
          role="status"
          aria-live="polite"
          style={{
            fontSize: 11,
            color: notice.type === 'error' ? 'var(--alert)' : 'var(--primary)',
            display: 'grid',
            gap: 4,
          }}
        >
          <div>
            {notice.text}
            {notice.type === 'error' && notice.code && (
              <span style={{ marginLeft: 6, opacity: 0.85, fontSize: 10 }}>[{notice.code}]</span>
            )}
          </div>
          {notice.hint && <div style={{ opacity: 0.9 }}>{notice.hint}</div>}
        </div>
      )}
    </div>
  );
}
