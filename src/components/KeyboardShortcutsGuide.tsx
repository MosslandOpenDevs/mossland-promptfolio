"use client";

import { useEffect, useId, useRef, useState } from 'react';

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
  const panelRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!isOpen) return;

    panelRef.current?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      if (!panelRef.current) return;
      if (panelRef.current.contains(event.target as Node)) return;
      setIsOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

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
          ref={panelRef}
          role="dialog"
          aria-label="Keyboard shortcuts guide"
          aria-modal="false"
          tabIndex={-1}
          style={{
            border: '1px dashed rgba(26, 26, 26, 0.45)',
            background: 'rgba(255, 255, 255, 0.7)',
            padding: 10,
            display: 'grid',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div className="pf-h2" style={{ fontSize: 12 }}>Keyboard shortcuts</div>
            <button
              type="button"
              className="pf-pill"
              onClick={() => setIsOpen(false)}
              style={{ cursor: 'pointer', fontWeight: 800 }}
              aria-label="Close keyboard shortcuts guide"
              title="Close keyboard shortcuts guide (Esc)"
            >
              Close (Esc)
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="pf-pill" style={{ minWidth: 74, justifyContent: 'center' }}>?</span>
            <span className="pf-dim" style={{ fontSize: 11 }}>Open or close this guide</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="pf-pill" style={{ minWidth: 74, justifyContent: 'center' }}>Home / End</span>
            <span className="pf-dim" style={{ fontSize: 11 }}>Jump to the first or last operator section</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="pf-pill" style={{ minWidth: 74, justifyContent: 'center' }}>[ / ]</span>
            <span className="pf-dim" style={{ fontSize: 11 }}>Move to previous or next section</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="pf-pill" style={{ minWidth: 74, justifyContent: 'center' }}>C</span>
            <span className="pf-dim" style={{ fontSize: 11 }}>Copy the link for the section you are currently viewing</span>
          </div>
          {items.map((item) => (
            <div key={item.anchorId} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="pf-pill" style={{ minWidth: 74, justifyContent: 'center' }}>Alt+{item.keyLabel}</span>
              <span className="pf-dim" style={{ fontSize: 11 }}>{item.label}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="pf-pill" style={{ minWidth: 74, justifyContent: 'center' }}>Esc</span>
            <span className="pf-dim" style={{ fontSize: 11 }}>Close the guide from anywhere</span>
          </div>
          <div className="pf-dim" style={{ fontSize: 10 }}>
            Tip: click outside the guide to dismiss it without losing your place.
          </div>
        </div>
      ) : null}
    </div>
  );
}
