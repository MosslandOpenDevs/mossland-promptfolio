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
    'K / J → Vim-style previous or next section jump',
    '/ → Focus the jump rail filter',
    '↑ / ↓ → Move through filtered matches',
    'Enter → Jump to the selected filtered match',
    'Cmd/Ctrl+Enter → Open the selected filtered match in a new tab',
    'Alt+Enter → Copy the selected filtered match link',
    'Esc → Clear the filter or close the guide',
    'C → Copy the link for the current section',
    'O → Open the direct link for the current section in a new tab',
    'B → Copy the reusable navigation bundle',
    'R / Resume → Jump back to the last saved section',
    'F → Pin or unpin the current section',
    '1-4 → Jump to the matching pinned section from the pinboard',
    '5-7 → Re-open one of the last few sections you touched from the jump rail',
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
  const panelLabelId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const didMountRef = useRef(false);
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
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    if (isOpen) {
      return;
    }

    if (!triggerButtonRef.current) return;
    triggerButtonRef.current.focus();
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
        ref={triggerButtonRef}
        className="pf-pill"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((current) => !current)}
        style={{ cursor: 'pointer', fontWeight: 900 }}
        title="Show keyboard shortcuts (?)"
        aria-label={isOpen ? 'Hide keyboard shortcuts panel' : 'Show keyboard shortcuts panel'}
      >
        {isOpen ? 'Hide shortcuts (?)' : 'Shortcuts (?)'}
      </button>

      {isOpen ? (
        <div
          id={panelId}
          ref={panelRef}
          role="dialog"
          aria-labelledby={panelLabelId}
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
            <div id={panelLabelId} className="pf-h2" style={{ fontSize: 12 }}>Keyboard shortcuts</div>
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
            <span className="pf-pill" style={{ minWidth: 74, justifyContent: 'center' }}>K / J</span>
            <span className="pf-dim" style={{ fontSize: 11 }}>Vim-style previous or next section jump</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="pf-pill" style={{ minWidth: 74, justifyContent: 'center' }}>/</span>
            <span className="pf-dim" style={{ fontSize: 11 }}>Focus the jump rail filter</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="pf-pill" style={{ minWidth: 74, justifyContent: 'center' }}>↑ / ↓</span>
            <span className="pf-dim" style={{ fontSize: 11 }}>Move through filtered matches</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="pf-pill" style={{ minWidth: 74, justifyContent: 'center' }}>Enter</span>
            <span className="pf-dim" style={{ fontSize: 11 }}>Jump to the selected filtered match</span>
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
            <span className="pf-pill" style={{ minWidth: 74, justifyContent: 'center' }}>B</span>
            <span className="pf-dim" style={{ fontSize: 11 }}>Copy the reusable navigation bundle with the current section, pinboard, and recent trail</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="pf-pill" style={{ minWidth: 74, justifyContent: 'center' }}>R / Resume</span>
            <span className="pf-dim" style={{ fontSize: 11 }}>Jump back to the last section you were viewing on your previous visit</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="pf-pill" style={{ minWidth: 74, justifyContent: 'center' }}>F</span>
            <span className="pf-dim" style={{ fontSize: 11 }}>Pin or unpin the section you are currently viewing</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="pf-pill" style={{ minWidth: 74, justifyContent: 'center' }}>1-4</span>
            <span className="pf-dim" style={{ fontSize: 11 }}>Jump directly to the matching pinned section from the pinboard</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="pf-pill" style={{ minWidth: 74, justifyContent: 'center' }}>5-7</span>
            <span className="pf-dim" style={{ fontSize: 11 }}>Re-open one of the last few sections you touched from the quick-jump rail</span>
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
