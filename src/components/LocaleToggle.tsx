'use client';

import { useId, useState } from 'react';

type Locale = 'en' | 'ko';

type LocaleToggleProps = {
  locale: Locale;
  label: string;
  currentLanguageLabel: string;
  switchLanguageLabel: string;
  savingLabel: string;
  errorLabel: string;
  englishLabel: string;
  koreanLabel: string;
};

export default function LocaleToggle({
  locale,
  label,
  currentLanguageLabel,
  switchLanguageLabel,
  savingLabel,
  errorLabel,
  englishLabel,
  koreanLabel,
}: LocaleToggleProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const statusId = useId();

  async function setLocale(next: Locale) {
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
    <div
      style={{ display: 'flex', gap: 8, alignItems: 'center' }}
      role="group"
      aria-label={label}
      aria-busy={pending}
      aria-describedby={statusId}
    >
      <span className="pf-pill">Lang</span>
      <button
        onClick={() => setLocale('en')}
        type="button"
        disabled={pending || locale === 'en'}
        className="pf-btn"
        style={small(locale === 'en')}
        aria-pressed={locale === 'en'}
        aria-label={locale === 'en' ? `${currentLanguageLabel}: ${englishLabel}` : `${switchLanguageLabel}: ${englishLabel}`}
        title={locale === 'en' ? `${currentLanguageLabel}: ${englishLabel}` : `${switchLanguageLabel}: ${englishLabel}`}
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
        aria-label={locale === 'ko' ? `${currentLanguageLabel}: ${koreanLabel}` : `${switchLanguageLabel}: ${koreanLabel}`}
        title={locale === 'ko' ? `${currentLanguageLabel}: ${koreanLabel}` : `${switchLanguageLabel}: ${koreanLabel}`}
      >
        KO
      </button>
      <span
        id={statusId}
        className={`pf-dim ${error ? 'pf-error' : ''}`}
        role="status"
        aria-live="polite"
      >
        {pending ? savingLabel : error ? errorLabel : ''}
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
