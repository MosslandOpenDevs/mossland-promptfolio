"use client";

import { useState } from 'react';

export default function CopyAnchorLinkButton({
  anchorId,
  idleLabel = 'COPY LINK',
  doneLabel = 'LINK COPIED',
  errorLabel = 'COPY FAILED',
  title,
}: {
  anchorId: string;
  idleLabel?: string;
  doneLabel?: string;
  errorLabel?: string;
  title?: string;
}) {
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle');

  const handleCopy = async () => {
    try {
      const url = new URL(window.location.href);
      url.hash = anchorId;
      await navigator.clipboard.writeText(url.toString());
      setState('done');
      window.setTimeout(() => setState('idle'), 1800);
    } catch {
      setState('error');
      window.setTimeout(() => setState('idle'), 2200);
    }
  };

  const label = state === 'done' ? doneLabel : state === 'error' ? errorLabel : idleLabel;

  return (
    <button
      type="button"
      className="pf-btn"
      onClick={handleCopy}
      aria-live="polite"
      title={state === 'idle' ? (title ?? 'Copy direct section link') : label}
    >
      {label}
    </button>
  );
}
