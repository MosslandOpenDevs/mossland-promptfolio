"use client";

import { useState } from 'react';

export default function CopyUrlButton({
  href,
  idleLabel = 'COPY VIEW LINK',
  successLabel = 'VIEW LINK COPIED',
  errorLabel = 'COPY FAILED',
  title = 'Copy direct replay view link',
}: {
  href: string;
  idleLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  title?: string;
}) {
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle');

  const handleCopy = async () => {
    try {
      const url = new URL(href, window.location.origin).toString();
      await navigator.clipboard.writeText(url);
      setState('done');
      window.setTimeout(() => setState('idle'), 1800);
    } catch {
      setState('error');
      window.setTimeout(() => setState('idle'), 2200);
    }
  };

  const label = state === 'done' ? successLabel : state === 'error' ? errorLabel : idleLabel;
  const buttonTitle = state === 'idle' ? title : label;

  return (
    <button type="button" className="pf-btn" onClick={handleCopy} aria-live="polite" title={buttonTitle} aria-label={buttonTitle}>
      {label}
    </button>
  );
}
