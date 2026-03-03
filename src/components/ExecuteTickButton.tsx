'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Spinner from './Spinner';
import { buildTickErrorMessage, buildTickRetryHint, buildTickSuccessMessage } from '../lib/tick-feedback';

export default function ExecuteTickButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [seed, setSeed] = useState(() => String(Date.now()));
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string; hint?: string | null } | null>(null);

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
        setNotice({
          type: 'error',
          text: buildTickErrorMessage({
            status: res.status,
            bodyText,
            contentType: res.headers.get('content-type'),
          }),
          hint: buildTickRetryHint({
            status: res.status,
            bodyText,
            contentType: res.headers.get('content-type'),
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
      >
        {busy ? <Spinner seed={seed} label="EXECUTING" /> : 'EXECUTE TICK'}
      </button>
      {busy && (
        <div className="pf-dim" style={{ fontSize: 10 }}>
          tip: this is paper trading. if it breaks, it’s lore.
        </div>
      )}
      {notice && (
        <div
          className="pf-dim"
          style={{
            fontSize: 11,
            color: notice.type === 'error' ? 'var(--alert)' : 'var(--primary)',
            display: 'grid',
            gap: 4,
          }}
        >
          <div>{notice.text}</div>
          {notice.hint && <div style={{ opacity: 0.9 }}>{notice.hint}</div>}
        </div>
      )}
    </div>
  );
}
