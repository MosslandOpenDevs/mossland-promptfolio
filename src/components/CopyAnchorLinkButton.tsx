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
    const url = new URL(window.location.href);
    url.hash = anchorId;
    const textToCopy = url.toString();

    try {
      if (window.isSecureContext && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
        setState('done');
        window.setTimeout(() => setState('idle'), 1800);
        return;
      }
    } catch {
      // fall through to legacy fallback
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);

      if (ok) {
        setState('done');
        window.setTimeout(() => setState('idle'), 1800);
      } else {
        setState('error');
        window.setTimeout(() => setState('idle'), 2200);
      }
    } catch {
      setState('error');
      window.setTimeout(() => setState('idle'), 2200);
    }
  };

  const label = state === 'done' ? doneLabel : state === 'error' ? errorLabel : idleLabel;
  const buttonLabel = state === 'idle' ? (title ?? 'Copy direct section link') : label;

  return (
    <button
      type="button"
      className="pf-btn"
      onClick={handleCopy}
      aria-live="polite"
      aria-label={buttonLabel}
      title={buttonLabel}
    >
      {label}
    </button>
  );
}
