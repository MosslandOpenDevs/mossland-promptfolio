'use client';

import { useEffect, useMemo, useState } from 'react';
import { pickSpinnerVerb } from '../lib/spinner';

export default function Spinner({ seed, label }: { seed: string; label?: string }) {
  const base = useMemo(() => pickSpinnerVerb(seed), [seed]);
  const [dots, setDots] = useState('');

  useEffect(() => {
    const t = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 350);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span className="pf-spinner" aria-hidden />
      <span style={{ fontWeight: 900, letterSpacing: '.08em' }}>{label ?? base}{dots}</span>
    </div>
  );
}
