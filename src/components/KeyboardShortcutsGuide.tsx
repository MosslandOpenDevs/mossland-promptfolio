"use client";

import { useEffect, useId, useState } from 'react';

type ShortcutItem = {
  keyLabel: string;
  anchorId: string;
  label: string;
};

function isTypingTarget(target: EventTarget | null) {
  const node = target as HTMLElement | null;
  const tagName = node?.tagName;

  return (
    node?.isContentEditable ||
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT'
  );
}

function isQuestionMarkToggle(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  return event.key === '?' || (event.key === '/' && event.shiftKey);
}

export default function KeyboardShortcutsGuide({ items }: { items: ShortcutItem[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      if (isQuestionMarkToggle(event)) {
        event.preventDefault();
        setIsOpen((current) => !current);
        return;
      }

      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <button
        type="button"
        className="pf-pill"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((current) => !current)}
        style={{ cursor: 'pointer', fontWeight: 900 }}
        title="Show keyboard shortcuts (?)"
      >
        {isOpen ? 'Hide shortcuts (?)' : 'Shortcuts (?)'}
      </button>

      {isOpen ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Keyboard shortcuts guide"
          style={{
            border: '1px dashed rgba(26, 26, 26, 0.45)',
            background: 'rgba(255, 255, 255, 0.7)',
            padding: 10,
            display: 'grid',
            gap: 6,
          }}
        >
          <div className="pf-h2" style={{ fontSize: 12 }}>Keyboard shortcuts</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="pf-pill" style={{ minWidth: 74, justifyContent: 'center' }}>?</span>
            <span className="pf-dim" style={{ fontSize: 11 }}>Open or close this guide</span>
          </div>
          {items.map((item) => (
            <div key={item.anchorId} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="pf-pill" style={{ minWidth: 74, justifyContent: 'center' }}>Alt+{item.keyLabel}</span>
              <span className="pf-dim" style={{ fontSize: 11 }}>{item.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
