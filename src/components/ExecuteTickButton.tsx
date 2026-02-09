'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Spinner from './Spinner';

export default function ExecuteTickButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [seed, setSeed] = useState(() => String(Date.now()));

  async function run() {
    if (disabled || busy) return;
    setBusy(true);
    setSeed(String(Date.now()));
    try {
      const res = await fetch('/api/tick', {
        method: 'POST',
        headers: {
          'x-pf-ajax': '1',
        },
      });
      if (!res.ok) throw new Error('tick failed');
      router.refresh();
    } catch {
      // let it fail silently for now; terminal feed will show stale state
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
    </div>
  );
}
