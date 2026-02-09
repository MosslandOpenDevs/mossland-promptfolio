'use client';

import { useState } from 'react';

export default function LocaleToggle({ locale }: { locale: 'en' | 'ko' }) {
  const [pending, setPending] = useState(false);

  async function setLocale(next: 'en' | 'ko') {
    setPending(true);
    try {
      await fetch('/api/locale', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ locale: next }),
      });
      window.location.reload();
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span className="pf-pill">Lang</span>
      <button onClick={() => setLocale('en')} disabled={pending || locale === 'en'} className="pf-btn" style={small(locale === 'en')}>
        EN
      </button>
      <button onClick={() => setLocale('ko')} disabled={pending || locale === 'ko'} className="pf-btn" style={small(locale === 'ko')}>
        KO
      </button>
    </div>
  );
}

function small(active: boolean): React.CSSProperties {
  return {
    padding: '6px 10px',
    borderRadius: 999,
    borderColor: active ? 'rgba(126,231,135,.55)' : 'rgba(27,42,61,.95)',
    opacity: active ? 1 : 0.85,
  };
}
