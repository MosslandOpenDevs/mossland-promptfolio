'use client';

import { useState } from 'react';

export default function LocaleToggle({ locale }: { locale: 'en' | 'ko' }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function setLocale(next: 'en' | 'ko') {
    if (pending || next === locale) return;
    setPending(true);
    setError(false);
    try {
      const res = await fetch('/api/locale', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ locale: next }),
      });

      if (!res.ok) {
        throw new Error(`Locale switch failed with ${res.status}`);
      }

      window.location.reload();
    } catch {
      setError(true);
      setPending(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span className="pf-pill">Lang</span>
      <button
        onClick={() => setLocale('en')}
        type="button"
        disabled={pending || locale === 'en'}
        className="pf-btn"
        style={small(locale === 'en')}
        aria-pressed={locale === 'en'}
        aria-label={locale === 'en' ? 'Current language: English' : 'Switch language to English'}
        title={locale === 'en' ? 'Current language: English' : 'Switch language to English'}
      >
        EN
      </button>
      <button
        onClick={() => setLocale('ko')}
        type="button"
        disabled={pending || locale === 'ko'}
        className="pf-btn"
        style={small(locale === 'ko')}
        aria-pressed={locale === 'ko'}
        aria-label={locale === 'ko' ? '현재 언어: 한국어' : '한국어로 전환'}
        title={locale === 'ko' ? '현재 언어: 한국어' : '한국어로 전환'}
      >
        KO
      </button>
      <span
        className={`pf-dim ${error ? 'pf-error' : ''}`}
        role="status"
        aria-live="polite"
      >
        {pending ? 'saving…' : error ? 'locale switch failed' : ''}
      </span>
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
