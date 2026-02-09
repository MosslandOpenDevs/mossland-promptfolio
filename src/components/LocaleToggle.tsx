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
      <span style={{ opacity: 0.65, fontSize: 12 }}>Lang</span>
      <button onClick={() => setLocale('en')} disabled={pending || locale === 'en'} style={btn(locale === 'en')}>
        EN
      </button>
      <button onClick={() => setLocale('ko')} disabled={pending || locale === 'ko'} style={btn(locale === 'ko')}>
        KO
      </button>
    </div>
  );
}

function btn(active: boolean): React.CSSProperties {
  return {
    padding: '6px 8px',
    borderRadius: 10,
    border: '1px solid #253042',
    background: active ? '#132033' : '#0f1720',
    color: '#e6edf3',
    fontWeight: 800,
    cursor: 'pointer',
    opacity: active ? 1 : 0.8,
  };
}
