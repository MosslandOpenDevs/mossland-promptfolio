"use client";

import { useEffect, useRef, useState } from 'react';

async function copyTextWithFallback(text: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard API unavailable');
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error('execCommand copy failed');
  }
}

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
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const scheduleReset = (delayMs: number) => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setState('idle');
      resetTimerRef.current = null;
    }, delayMs);
  };

  const handleCopy = async () => {
    try {
      await copyTextWithFallback(text);
      setState('done');
      scheduleReset(1800);
    } catch {
      setState('error');
      scheduleReset(2200);
    }
  };

  const buttonTitle = state === 'done' ? successLabel : state === 'error' ? 'Copy failed' : title;
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
