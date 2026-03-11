"use client";

import { useEffect, useId, useRef, useState } from 'react';

const SHORTCUT_GUIDE_STORAGE_KEY = 'promptfolio-keyboard-shortcuts-open';

function buildAnchorUrl(anchorId: string) {
  if (typeof window === 'undefined') {
    return `#${anchorId}`;
  }

  const url = new URL(window.location.href);
  url.hash = anchorId;
  return url.toString();
}

async function copyShortcutMap(items: ShortcutItem[]) {
  const lines = [
    'Promptfolio quick-jump map',
    '',
    '? → Open or close the keyboard shortcuts guide',
    'Home / End → Jump to the first or last operator section',
    '[ / ] → Move to previous or next section',
    'J / K → Vim-style next or previous section jump',
    'C → Copy the link for the current section',
    'O → Open the direct link for the current section in a new tab',
    'R / Resume → Jump back to the last saved section',
    '',
    ...items.flatMap((item) => [
      `Alt+${item.keyLabel} → ${item.label}`,
      `Alt+Shift+${item.keyLabel} → Copy direct link`,
      `  ${buildAnchorUrl(item.anchorId)}`,
    ]),
  ];

  await navigator.clipboard.writeText(lines.join('\n'));
}

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

function jumpToAnchor(anchorId: string) {
  const nextSection = document.getElementById(anchorId);
  if (!nextSection) return false;

  nextSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.history.replaceState(null, '', `#${anchorId}`);
  window.setTimeout(() => {
    nextSection.focus({ preventScroll: true });
  }, 220);

  return true;
}

export default function KeyboardShortcutsGuide({ items }: { items: ShortcutItem[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'error'>('idle');
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const clearCopyStateTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const storedPreference = window.localStorage.getItem(SHORTCUT_GUIDE_STORAGE_KEY);
      if (storedPreference === 'open') {
        setIsOpen(true);
      }
    } catch {
      // Ignore storage read failures and fall back to closed-by-default.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(SHORTCUT_GUIDE_STORAGE_KEY, isOpen ? 'open' : 'closed');
    } catch {
      // Ignore storage write failures so the guide still works normally.
    }
  }, [isOpen]);

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
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (clearCopyStateTimeoutRef.current !== null) {
        window.clearTimeout(clearCopyStateTimeoutRef.current);
      }
    };
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="pf-pill" style={{ minWidth: 74, justifyContent: 'center' }}>?</span>
              <span className="pf-dim" style={{ fontSize: 11 }}>Open or close this guide</span>
            </div>
            <button
              type="button"
              className="pf-pill"
              onClick={() => {
                void copyShortcutMap(items)
                  .then(() => {
                    setCopyState('done');
                    if (clearCopyStateTimeoutRef.current !== null) {
                      window.clearTimeout(clearCopyStateTimeoutRef.current);
                    }
                    clearCopyStateTimeoutRef.current = window.setTimeout(() => setCopyState('idle'), 1800);
                  })
                  .catch(() => {
                    setCopyState('error');
                    if (clearCopyStateTimeoutRef.current !== null) {
                      window.clearTimeout(clearCopyStateTimeoutRef.current);
                    }
                    clearCopyStateTimeoutRef.current = window.setTimeout(() => setCopyState('idle'), 2200);
                  });
              }}
              style={{ cursor: 'pointer', fontWeight: 800 }}
              aria-label="Copy the full quick-jump map"
              title="Copy the full quick-jump map"
            >
              {copyState === 'done' ? 'Jump map copied' : copyState === 'error' ? 'Copy failed' : 'Copy jump map'}
            </button>
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
            <span className="pf-pill" style={{ minWidth: 74, justifyContent: 'center' }}>J / K</span>
            <span className="pf-dim" style={{ fontSize: 11 }}>Vim-style next or previous section jump</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="pf-pill" style={{ minWidth: 74, justifyContent: 'center' }}>C</span>
            <span className="pf-dim" style={{ fontSize: 11 }}>Copy the link for the section you are currently viewing</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="pf-pill" style={{ minWidth: 74, justifyContent: 'center' }}>O</span>
            <span className="pf-dim" style={{ fontSize: 11 }}>Open the direct link for the section you are currently viewing in a new tab</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="pf-pill" style={{ minWidth: 74, justifyContent: 'center' }}>R / Resume</span>
            <span className="pf-dim" style={{ fontSize: 11 }}>Jump back to the last section you were viewing on your previous visit</span>
          </div>
          {items.map((item) => (
            <button
              key={item.anchorId}
              type="button"
              className="pf-pill"
              onClick={() => {
                if (!jumpToAnchor(item.anchorId)) return;
                setIsOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                cursor: 'pointer',
                justifyContent: 'flex-start',
                textAlign: 'left',
              }}
              aria-label={`Jump to ${item.label} (Alt+${item.keyLabel})`}
              title={`Jump to ${item.label} (Alt+${item.keyLabel}) · copy direct link with Alt+Shift+${item.keyLabel}`}
            >
              <span className="pf-pill" style={{ minWidth: 74, justifyContent: 'center' }}>Alt+{item.keyLabel}</span>
              <span className="pf-dim" style={{ fontSize: 11 }}>{item.label}</span>
              <span className="pf-pill" style={{ minWidth: 108, justifyContent: 'center' }}>Alt+Shift+{item.keyLabel}</span>
              <span className="pf-dim" style={{ fontSize: 11 }}>Copy direct link</span>
            </button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="pf-pill" style={{ minWidth: 74, justifyContent: 'center' }}>Esc</span>
            <span className="pf-dim" style={{ fontSize: 11 }}>Close the guide from anywhere</span>
          </div>
          <div className="pf-dim" style={{ fontSize: 10 }}>
            Tip: click any shortcut row to jump straight to that section, or click outside the guide to dismiss it without losing your place.
          </div>
        </div>
      ) : null}
    </div>
  );
}
