"use client";

import { useState } from 'react';

export default function CopyBriefButton({
  text,
  idleLabel = 'COPY BRIEF',
  successLabel = 'BRIEF COPIED',
  title = 'Copy operator brief',
}: {
  text: string;
  idleLabel?: string;
  successLabel?: string;
  title?: string;
}) {
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState('done');
      window.setTimeout(() => setState('idle'), 1800);
    } catch {
      setState('error');
      window.setTimeout(() => setState('idle'), 2200);
    }
  };

  const buttonTitle = state === 'done' ? `${successLabel.toLowerCase()}` : state === 'error' ? 'Copy failed' : title;
  const buttonLabel = state === 'done' ? successLabel : state === 'error' ? 'COPY FAILED' : idleLabel;

  return (
    <button
      type="button"
      className="pf-btn"
      onClick={handleCopy}
      aria-live="polite"
      title={buttonTitle}
      aria-label={buttonTitle}
    >
      {buttonLabel}
    </button>
  );
}
