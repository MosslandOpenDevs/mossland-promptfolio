"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

function buildAnchorUrl(anchorId: string) {
  if (typeof window === 'undefined') {
    return `#${anchorId}`;
  }

  const url = new URL(window.location.href);
  url.hash = anchorId;
  return url.toString();
}

async function copyAnchorLink(anchorId: string) {
  await navigator.clipboard.writeText(buildAnchorUrl(anchorId));
}

function openAnchorLink(anchorId: string) {
  const href = buildAnchorUrl(anchorId);
  if (typeof window === 'undefined') {
    return false;
  }

  window.open(href, '_blank', 'noopener,noreferrer');
  return true;
}

type ShortcutItem = {
  keyLabel: string;
  anchorId: string;
  label: string;
};

function getHashAnchor() {
  return typeof window === 'undefined' ? null : window.location.hash.replace(/^#/, '') || null;
}

function jumpToAnchor(anchorId: string) {
  const nextSection = document.getElementById(anchorId);
  if (!nextSection) return false;

  nextSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.history.replaceState(null, '', `#${anchorId}`);
  setTimeout(() => {
    nextSection.focus({ preventScroll: true });
  }, 220);

  return true;
}

export default function QuickJumpShortcuts({ items }: { items: ShortcutItem[] }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'error'>('idle');
  const [copiedAnchorId, setCopiedAnchorId] = useState<string | null>(null);
  const clearActiveKeyTimeoutRef = useRef<number | null>(null);
  const clearCopyStateTimeoutRef = useRef<number | null>(null);
  const itemIds = useMemo(() => new Set(items.map((item) => item.anchorId)), [items]);
  const activeIndex = useMemo(() => items.findIndex((item) => item.anchorId === activeAnchorId), [activeAnchorId, items]);
  const activeItem = activeIndex >= 0 ? items[activeIndex] : items[0] ?? null;
  const activeAnchorForCopy = activeItem?.anchorId ?? 'home-top';

  useEffect(() => {
    const syncFromHash = () => {
      const hashAnchor = getHashAnchor();
      setActiveAnchorId(hashAnchor && itemIds.has(hashAnchor) ? hashAnchor : null);
    };

    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);

    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [itemIds]);

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.anchorId))
      .filter((section): section is HTMLElement => Boolean(section));

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        const nextActiveId = visibleEntries[0]?.target.id;
        if (!nextActiveId) return;

        setActiveAnchorId((current) => (current === nextActiveId ? current : nextActiveId));
      },
      {
        rootMargin: '-20% 0px -55% 0px',
        threshold: [0.2, 0.4, 0.6, 0.8],
      }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [items]);

  useEffect(() => {
    const clearActiveKey = () => {
      if (clearActiveKeyTimeoutRef.current !== null) {
        window.clearTimeout(clearActiveKeyTimeoutRef.current);
      }
      clearActiveKeyTimeoutRef.current = window.setTimeout(() => setActiveKey(null), 1200);
    };

    const clearCopyState = (nextState: 'done' | 'error') => {
      if (clearCopyStateTimeoutRef.current !== null) {
        window.clearTimeout(clearCopyStateTimeoutRef.current);
      }
      clearCopyStateTimeoutRef.current = window.setTimeout(() => {
        setCopyState('idle');
        setCopiedAnchorId(null);
      }, nextState === 'done' ? 1600 : 2200);
    };

    const copySectionLink = async (anchorId: string) => {
      try {
        await copyAnchorLink(anchorId);
        setCopiedAnchorId(anchorId);
        setCopyState('done');
        clearCopyState('done');
      } catch {
        setCopiedAnchorId(anchorId);
        setCopyState('error');
        clearCopyState('error');
      }
    };

    const copyCurrentSection = async () => {
      await copySectionLink(activeAnchorForCopy);
    };

    const moveByOffset = (offset: number, visualKey: string) => {
      if (items.length === 0) return false;

      const currentIndex = items.findIndex((item) => item.anchorId === activeAnchorId);
      const baseIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex = Math.min(items.length - 1, Math.max(0, baseIndex + offset));
      const nextItem = items[nextIndex];
      if (!nextItem || nextItem.anchorId === activeAnchorId) return false;
      if (!jumpToAnchor(nextItem.anchorId)) return false;

      setActiveKey(visualKey);
      setActiveAnchorId(nextItem.anchorId);
      clearActiveKey();
      return true;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      const isTypingTarget =
        target?.isContentEditable ||
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT';

      if (isTypingTarget || event.metaKey || event.ctrlKey) {
        return;
      }

      if (event.altKey) {
        const matched = items.find((item) => item.keyLabel.toLowerCase() === event.key.toLowerCase());
        if (!matched) return;

        event.preventDefault();

        if (event.shiftKey) {
          void copySectionLink(matched.anchorId);
          setActiveKey(`copy:${matched.keyLabel}`);
          setActiveAnchorId(matched.anchorId);
          clearActiveKey();
          return;
        }

        if (!jumpToAnchor(matched.anchorId)) return;

        setActiveKey(matched.keyLabel);
        setActiveAnchorId(matched.anchorId);
        clearActiveKey();
        return;
      }

      if (event.shiftKey) {
        return;
      }

      if (event.key === '[' || event.key.toLowerCase() === 'k') {
        event.preventDefault();
        moveByOffset(-1, event.key === '[' ? '[ ]' : 'J / K');
        return;
      }

      if (event.key === ']' || event.key.toLowerCase() === 'j') {
        event.preventDefault();
        moveByOffset(1, event.key === ']' ? '[ ]' : 'J / K');
        return;
      }

      if (event.key === 'Home' && items[0]) {
        event.preventDefault();
        if (!jumpToAnchor(items[0].anchorId)) return;
        setActiveKey('Home');
        setActiveAnchorId(items[0].anchorId);
        clearActiveKey();
        return;
      }

      if (event.key === 'End' && items[items.length - 1]) {
        event.preventDefault();
        const lastItem = items[items.length - 1];
        if (!jumpToAnchor(lastItem.anchorId)) return;
        setActiveKey('End');
        setActiveAnchorId(lastItem.anchorId);
        clearActiveKey();
        return;
      }

      if (event.key.toLowerCase() === 'c') {
        event.preventDefault();
        void copyCurrentSection();
        return;
      }

      if (event.key.toLowerCase() === 'o') {
        event.preventDefault();
        openAnchorLink(activeAnchorForCopy);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (clearActiveKeyTimeoutRef.current !== null) {
        window.clearTimeout(clearActiveKeyTimeoutRef.current);
      }
      if (clearCopyStateTimeoutRef.current !== null) {
        window.clearTimeout(clearCopyStateTimeoutRef.current);
      }
    };
  }, [activeAnchorForCopy, activeAnchorId, items]);

  const canJumpPrev = activeIndex > 0;
  const canJumpNext = activeIndex >= 0 && activeIndex < items.length - 1;
  const hasItems = items.length > 0;
  const sectionPosition = activeIndex >= 0 ? `${activeIndex + 1}/${items.length}` : hasItems ? `1/${items.length}` : '0/0';
  const activeHashLabel = activeItem ? `#${activeItem.anchorId}` : '#home-top';
  const activeHashHref = activeItem ? buildAnchorUrl(activeItem.anchorId) : null;
  const copiedItem = copiedAnchorId ? items.find((item) => item.anchorId === copiedAnchorId) ?? null : null;
  const copyLabel =
    copyState === 'done'
      ? copiedItem
        ? `COPIED ${copiedItem.label.toUpperCase()} LINK`
        : 'LINK COPIED'
      : copyState === 'error'
        ? copiedItem
          ? `COPY FAILED · ${copiedItem.label.toUpperCase()}`
          : 'COPY FAILED'
        : activeItem
          ? `COPY ${activeItem.label.toUpperCase()} LINK`
          : 'COPY CURRENT LINK';

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div className="pf-dim" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, alignItems: 'center' }}>
        <button
          type="button"
          className="pf-pill"
          disabled={!hasItems}
          aria-label="Jump to first section (Home)"
          title="Jump to first section (Home)"
          onClick={() => {
            if (!items[0]) return;
            setActiveKey('Home');
            setActiveAnchorId(items[0].anchorId);
            jumpToAnchor(items[0].anchorId);
            window.setTimeout(() => {
              setActiveKey((current) => (current === 'Home' ? null : current));
            }, 1200);
          }}
          style={{ cursor: hasItems ? 'pointer' : 'not-allowed', opacity: hasItems ? 1 : 0.55 }}
        >
          Home
        </button>
        <button
          type="button"
          className="pf-pill"
          disabled={!canJumpPrev}
          aria-label="Jump to previous section ([)"
          title="Jump to previous section ([)"
          onClick={() => {
            if (!canJumpPrev || !items[activeIndex - 1]) return;
            const previousItem = items[activeIndex - 1];
            setActiveKey('[ ]');
            setActiveAnchorId(previousItem.anchorId);
            jumpToAnchor(previousItem.anchorId);
            window.setTimeout(() => {
              setActiveKey((current) => (current === '[ ]' ? null : current));
            }, 1200);
          }}
          style={{ cursor: canJumpPrev ? 'pointer' : 'not-allowed', opacity: canJumpPrev ? 1 : 0.55 }}
        >
          [ Prev
        </button>
        <span className="pf-pill" aria-live="polite" style={{ borderColor: 'var(--primary)', color: 'var(--primary)', background: 'rgba(255,255,255,.92)' }}>
          {activeItem ? `Now viewing · ${activeItem.label}` : 'Now viewing · Top'}
        </span>
        <span className="pf-pill" aria-live="polite">
          Section {sectionPosition}
        </span>
        {activeHashHref ? (
          <button
            type="button"
            className="pf-pill"
            aria-label={activeItem ? `Open ${activeItem.label} link in a new tab (O)` : 'Open current section link in a new tab (O)'}
            title={activeItem ? `Open ${activeItem.label} link in a new tab (O)` : 'Open current section link in a new tab (O)'}
            onClick={() => {
              openAnchorLink(activeAnchorForCopy);
            }}
            style={{ cursor: 'pointer' }}
          >
            {activeHashLabel}
          </button>
        ) : (
          <span className="pf-pill">{activeHashLabel}</span>
        )}
        <button
          type="button"
          className="pf-pill"
          aria-live="polite"
          aria-label={activeItem ? `Copy ${activeItem.label} link (C)` : 'Copy current section link (C)'}
          title={activeItem ? `Copy ${activeItem.label} link (C)` : 'Copy current section link (C)'}
          onClick={() => {
            void copyAnchorLink(activeAnchorForCopy)
              .then(() => {
                setCopiedAnchorId(activeAnchorForCopy);
                setCopyState('done');
                if (clearCopyStateTimeoutRef.current !== null) {
                  window.clearTimeout(clearCopyStateTimeoutRef.current);
                }
                clearCopyStateTimeoutRef.current = window.setTimeout(() => {
                  setCopyState('idle');
                  setCopiedAnchorId(null);
                }, 1600);
              })
              .catch(() => {
                setCopiedAnchorId(activeAnchorForCopy);
                setCopyState('error');
                if (clearCopyStateTimeoutRef.current !== null) {
                  window.clearTimeout(clearCopyStateTimeoutRef.current);
                }
                clearCopyStateTimeoutRef.current = window.setTimeout(() => {
                  setCopyState('idle');
                  setCopiedAnchorId(null);
                }, 2200);
              });
          }}
          style={{ cursor: 'pointer' }}
        >
          {copyLabel}
        </button>
        <button
          type="button"
          className="pf-pill"
          disabled={!canJumpNext}
          aria-label="Jump to next section (])"
          title="Jump to next section (])"
          onClick={() => {
            if (!canJumpNext || !items[activeIndex + 1]) return;
            const nextItem = items[activeIndex + 1];
            setActiveKey('[ ]');
            setActiveAnchorId(nextItem.anchorId);
            jumpToAnchor(nextItem.anchorId);
            window.setTimeout(() => {
              setActiveKey((current) => (current === '[ ]' ? null : current));
            }, 1200);
          }}
          style={{ cursor: canJumpNext ? 'pointer' : 'not-allowed', opacity: canJumpNext ? 1 : 0.55 }}
        >
          Next ]
        </button>
        <button
          type="button"
          className="pf-pill"
          disabled={!hasItems}
          aria-label="Jump to last section (End)"
          title="Jump to last section (End)"
          onClick={() => {
            const lastItem = items[items.length - 1];
            if (!lastItem) return;
            setActiveKey('End');
            setActiveAnchorId(lastItem.anchorId);
            jumpToAnchor(lastItem.anchorId);
            window.setTimeout(() => {
              setActiveKey((current) => (current === 'End' ? null : current));
            }, 1200);
          }}
          style={{ cursor: hasItems ? 'pointer' : 'not-allowed', opacity: hasItems ? 1 : 0.55 }}
        >
          End
        </button>
      </div>
      <div className="pf-dim" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
        {items.map((item) => {
          const isActive = activeAnchorId === item.anchorId;
          const isPressed = activeKey === item.keyLabel;
          const interactiveStyle: CSSProperties = {
            borderColor: isPressed || isActive ? 'var(--primary)' : undefined,
            color: isPressed || isActive ? 'var(--primary)' : undefined,
            background: isActive ? 'rgba(255, 255, 255, 0.92)' : undefined,
            boxShadow: isActive ? '0 0 0 2px rgba(17, 153, 68, 0.12)' : undefined,
            cursor: 'pointer',
          };

          return (
            <button
              key={item.anchorId}
              type="button"
              className="pf-pill"
              aria-current={isActive ? 'true' : undefined}
              aria-label={`Jump to ${item.label} (Alt+${item.keyLabel})`}
              title={`Jump to ${item.label} (Alt+${item.keyLabel}) · copy direct link with Alt+Shift+${item.keyLabel} · use [ ] or J/K for previous/next section`}
              onClick={() => {
                setActiveKey(item.keyLabel);
                setActiveAnchorId(item.anchorId);
                jumpToAnchor(item.anchorId);
                window.setTimeout(() => {
                  setActiveKey((current) => (current === item.keyLabel ? null : current));
                }, 1200);
              }}
              style={interactiveStyle}
            >
              Alt+{item.keyLabel} {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
