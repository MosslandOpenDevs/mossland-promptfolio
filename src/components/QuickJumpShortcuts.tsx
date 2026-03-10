"use client";

import { useEffect, useMemo, useState, type CSSProperties } from 'react';

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
  const itemIds = useMemo(() => new Set(items.map((item) => item.anchorId)), [items]);

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
    let resetTimer: number | undefined;

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

      event.preventDefault();
      if (!jumpToAnchor(matched.anchorId)) return;

      setActiveKey(matched.keyLabel);
      setActiveAnchorId(matched.anchorId);
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => setActiveKey((current) => (current === matched.keyLabel ? null : current)), 1200);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.clearTimeout(resetTimer);
    };
  }, [items]);

  return (
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
            title={`Jump to ${item.label} (Alt+${item.keyLabel})`}
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
  );
}
