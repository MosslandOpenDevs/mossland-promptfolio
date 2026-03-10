"use client";

import { useEffect, useState } from 'react';

type ShortcutItem = {
  keyLabel: string;
  anchorId: string;
  label: string;
};

export default function QuickJumpShortcuts({ items }: { items: ShortcutItem[] }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      const isTypingTarget =
        target?.isContentEditable ||
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT';

      if (isTypingTarget || !event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) {
        return;
      }

      const matched = items.find((item) => item.keyLabel === event.key);
      if (!matched) return;

      const nextSection = document.getElementById(matched.anchorId);
      if (!nextSection) return;

      event.preventDefault();
      setActiveKey(matched.keyLabel);
      nextSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.replaceState(null, '', `#${matched.anchorId}`);
      window.setTimeout(() => setActiveKey((current) => (current === matched.keyLabel ? null : current)), 1200);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items]);

  return (
    <div className="pf-dim" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
      {items.map((item) => (
        <span
          key={item.anchorId}
          className="pf-pill"
          style={{
            borderColor: activeKey === item.keyLabel ? 'var(--primary)' : undefined,
            color: activeKey === item.keyLabel ? 'var(--primary)' : undefined,
          }}
        >
          Alt+{item.keyLabel} {item.label}
        </span>
      ))}
    </div>
  );
}
