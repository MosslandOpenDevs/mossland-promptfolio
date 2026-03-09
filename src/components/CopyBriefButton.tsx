"use client";

import { useState } from 'react';

export default function CopyBriefButton({ text }: { text: string }) {
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

  return (
    <button
      type="button"
      className="pf-btn"
      onClick={handleCopy}
      aria-live="polite"
      title={state === 'done' ? 'Brief copied' : state === 'error' ? 'Copy failed' : 'Copy operator brief'}
    >
      {state === 'done' ? 'BRIEF COPIED' : state === 'error' ? 'COPY FAILED' : 'COPY BRIEF'}
    </button>
  );
}
