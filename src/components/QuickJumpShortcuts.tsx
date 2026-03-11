"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';

const LAST_ACTIVE_SECTION_STORAGE_KEY = 'promptfolio-last-active-section';
const RECENT_SECTION_TRAIL_STORAGE_KEY = 'promptfolio-recent-section-trail';
const PINNED_SECTION_STORAGE_KEY = 'promptfolio-pinned-sections';
const MAX_RECENT_SECTION_TRAIL = 3;
const MAX_PINNED_SECTIONS = 4;

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

type ShortcutItemMatchMeta = {
  item: ShortcutItem;
  matchedFields: string[];
};

function getShortcutItemMatchMeta(item: ShortcutItem, normalizedSearchQuery: string): ShortcutItemMatchMeta | null {
  if (!normalizedSearchQuery) {
    return { item, matchedFields: [] };
  }

  const matchedFields: string[] = [];
  if (item.label.toLowerCase().includes(normalizedSearchQuery)) {
    matchedFields.push('label');
  }
  if (item.anchorId.toLowerCase().includes(normalizedSearchQuery)) {
    matchedFields.push('section id');
  }
  if (item.keyLabel.toLowerCase().includes(normalizedSearchQuery)) {
    matchedFields.push('shortcut');
  }

  return matchedFields.length > 0 ? { item, matchedFields } : null;
}

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

function clearStoredLastStop() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(LAST_ACTIVE_SECTION_STORAGE_KEY);
  } catch {
    // Ignore storage write failures and keep the reset action non-blocking.
  }
}

function loadRecentSectionTrail() {
  if (typeof window === 'undefined') {
    return [] as string[];
  }

  try {
    const storedTrail = window.localStorage.getItem(RECENT_SECTION_TRAIL_STORAGE_KEY);
    if (!storedTrail) return [] as string[];

    const parsedTrail = JSON.parse(storedTrail);
    if (!Array.isArray(parsedTrail)) return [] as string[];

    return parsedTrail.filter((value): value is string => typeof value === 'string');
  } catch {
    return [] as string[];
  }
}

function saveRecentSectionTrail(anchorIds: string[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(RECENT_SECTION_TRAIL_STORAGE_KEY, JSON.stringify(anchorIds.slice(0, MAX_RECENT_SECTION_TRAIL)));
  } catch {
    // Ignore storage write failures so the jump rail still works.
  }
}

function loadPinnedSections() {
  if (typeof window === 'undefined') {
    return [] as string[];
  }

  try {
    const storedPinned = window.localStorage.getItem(PINNED_SECTION_STORAGE_KEY);
    if (!storedPinned) return [] as string[];

    const parsedPinned = JSON.parse(storedPinned);
    if (!Array.isArray(parsedPinned)) return [] as string[];

    return parsedPinned.filter((value): value is string => typeof value === 'string');
  } catch {
    return [] as string[];
  }
}

function savePinnedSections(anchorIds: string[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(PINNED_SECTION_STORAGE_KEY, JSON.stringify(anchorIds.slice(0, MAX_PINNED_SECTIONS)));
  } catch {
    // Ignore storage write failures so the pinboard stays optional.
  }
}

export default function QuickJumpShortcuts({ items }: { items: ShortcutItem[] }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(null);
  const [resumeAnchorId, setResumeAnchorId] = useState<string | null>(null);
  const [recentAnchorTrail, setRecentAnchorTrail] = useState<string[]>([]);
  const [pinnedAnchorIds, setPinnedAnchorIds] = useState<string[]>([]);
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'error'>('idle');
  const [copiedAnchorId, setCopiedAnchorId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilteredIndex, setSelectedFilteredIndex] = useState(0);
  const clearActiveKeyTimeoutRef = useRef<number | null>(null);
  const clearCopyStateTimeoutRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const itemIds = useMemo(() => new Set(items.map((item) => item.anchorId)), [items]);
  const activeIndex = useMemo(() => items.findIndex((item) => item.anchorId === activeAnchorId), [activeAnchorId, items]);
  const activeItem = activeIndex >= 0 ? items[activeIndex] : items[0] ?? null;
  const activeAnchorForCopy = activeItem?.anchorId ?? 'home-top';
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredItemMatches = useMemo(() => {
    if (!normalizedSearchQuery) {
      return items.map((item) => ({ item, matchedFields: [] }));
    }

    return items
      .map((item) => getShortcutItemMatchMeta(item, normalizedSearchQuery))
      .filter((match): match is ShortcutItemMatchMeta => Boolean(match));
  }, [items, normalizedSearchQuery]);
  const filteredItems = filteredItemMatches.map((match) => match.item);
  const selectedFilteredItem = filteredItems[Math.min(selectedFilteredIndex, Math.max(filteredItems.length - 1, 0))] ?? null;
  const selectedFilteredMatch = filteredItemMatches[Math.min(selectedFilteredIndex, Math.max(filteredItemMatches.length - 1, 0))] ?? null;

  useEffect(() => {
    setSelectedFilteredIndex(0);
  }, [normalizedSearchQuery]);

  useEffect(() => {
    if (!filteredItems.length) {
      setSelectedFilteredIndex(0);
      return;
    }

    setSelectedFilteredIndex((current) => Math.min(current, filteredItems.length - 1));
  }, [filteredItems]);

  useEffect(() => {
    setRecentAnchorTrail((current) => {
      const nextTrail = loadRecentSectionTrail().filter((anchorId) => itemIds.has(anchorId)).slice(0, MAX_RECENT_SECTION_TRAIL);
      return JSON.stringify(current) === JSON.stringify(nextTrail) ? current : nextTrail;
    });
    setPinnedAnchorIds((current) => {
      const nextPinned = loadPinnedSections().filter((anchorId) => itemIds.has(anchorId)).slice(0, MAX_PINNED_SECTIONS);
      return JSON.stringify(current) === JSON.stringify(nextPinned) ? current : nextPinned;
    });

    const syncFromHash = () => {
      const hashAnchor = getHashAnchor();
      if (hashAnchor && itemIds.has(hashAnchor)) {
        setActiveAnchorId(hashAnchor);
        setResumeAnchorId(hashAnchor);
        return;
      }

      try {
        const storedAnchor = window.localStorage.getItem(LAST_ACTIVE_SECTION_STORAGE_KEY);
        if (storedAnchor && itemIds.has(storedAnchor)) {
          setResumeAnchorId(storedAnchor);
          setActiveAnchorId((current) => current ?? storedAnchor);
          return;
        }
      } catch {
        // Ignore storage read failures and keep hash-only behavior.
      }

      setActiveAnchorId(null);
      setResumeAnchorId(null);
    };

    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);

    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [itemIds]);

  useEffect(() => {
    if (!activeAnchorId) {
      return;
    }

    try {
      window.localStorage.setItem(LAST_ACTIVE_SECTION_STORAGE_KEY, activeAnchorId);
      setResumeAnchorId(activeAnchorId);
    } catch {
      // Ignore storage write failures and keep navigation interactive.
    }

    setRecentAnchorTrail((current) => {
      const nextTrail = [activeAnchorId, ...current.filter((anchorId) => anchorId !== activeAnchorId)].slice(0, MAX_RECENT_SECTION_TRAIL);
      saveRecentSectionTrail(nextTrail);
      return nextTrail;
    });
  }, [activeAnchorId]);

  const togglePinnedSection = useCallback((anchorId: string) => {
    setPinnedAnchorIds((current) => {
      const nextPinned = current.includes(anchorId)
        ? current.filter((value) => value !== anchorId)
        : [anchorId, ...current.filter((value) => value !== anchorId)].slice(0, MAX_PINNED_SECTIONS);
      savePinnedSections(nextPinned);
      return nextPinned;
    });
  }, []);

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

      if (event.key === '/' && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (event.key === 'Escape' && !event.altKey && !event.metaKey && !event.ctrlKey) {
        if (document.activeElement === searchInputRef.current || searchQuery) {
          event.preventDefault();
          setSearchQuery('');
          setSelectedFilteredIndex(0);
          searchInputRef.current?.blur();
        }
        return;
      }

      const isSearchFocused = document.activeElement === searchInputRef.current;
      if (isSearchFocused && filteredItems.length > 0) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setSelectedFilteredIndex((current) => (current + 1) % filteredItems.length);
          return;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setSelectedFilteredIndex((current) => (current - 1 + filteredItems.length) % filteredItems.length);
          return;
        }
      }

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

      if (!event.shiftKey && /^[1-4]$/.test(event.key)) {
        const pinnedIndex = Number(event.key) - 1;
        const pinnedAnchorId = pinnedAnchorIds[pinnedIndex];
        const pinnedItem = pinnedAnchorId ? items.find((item) => item.anchorId === pinnedAnchorId) ?? null : null;
        if (!pinnedItem) return;

        event.preventDefault();
        if (!jumpToAnchor(pinnedItem.anchorId)) return;

        setActiveKey(`pin:${pinnedIndex + 1}`);
        setActiveAnchorId(pinnedItem.anchorId);
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
        return;
      }

      if (event.key.toLowerCase() === 'r' && resumeAnchorId) {
        event.preventDefault();
        if (!jumpToAnchor(resumeAnchorId)) return;
        setActiveKey('Resume');
        setActiveAnchorId(resumeAnchorId);
        clearActiveKey();
        return;
      }

      if (event.key.toLowerCase() === 'f' && activeAnchorForCopy) {
        event.preventDefault();
        togglePinnedSection(activeAnchorForCopy);
        setActiveKey('Pin');
        clearActiveKey();
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
  }, [activeAnchorForCopy, activeAnchorId, filteredItems.length, items, pinnedAnchorIds, resumeAnchorId, searchQuery, togglePinnedSection]);

  const hasItems = items.length > 0;
  const resumeItem = resumeAnchorId ? items.find((item) => item.anchorId === resumeAnchorId) ?? null : null;
  const showResumeButton = Boolean(resumeItem) && resumeItem?.anchorId !== activeItem?.anchorId;
  const effectiveActiveIndex = activeIndex >= 0 ? activeIndex : hasItems ? 0 : -1;
  const canJumpPrev = effectiveActiveIndex > 0;
  const canJumpNext = effectiveActiveIndex >= 0 && effectiveActiveIndex < items.length - 1;
  const sectionPosition = effectiveActiveIndex >= 0 ? `${effectiveActiveIndex + 1}/${items.length}` : '0/0';
  const progressPercent =
    items.length > 1 && effectiveActiveIndex >= 0 ? Math.round((effectiveActiveIndex / (items.length - 1)) * 100) : hasItems ? 100 : 0;
  const previousItem = canJumpPrev ? items[effectiveActiveIndex - 1] : null;
  const nextItem = canJumpNext ? items[effectiveActiveIndex + 1] : null;
  const lastStopLabel = resumeItem ? `#${resumeItem.anchorId}` : null;
  const activeHashLabel = activeItem ? `#${activeItem.anchorId}` : '#home-top';
  const copiedItem = copiedAnchorId ? items.find((item) => item.anchorId === copiedAnchorId) ?? null : null;
  const recentTrailItems = recentAnchorTrail
    .map((anchorId) => items.find((item) => item.anchorId === anchorId) ?? null)
    .filter((item): item is ShortcutItem => Boolean(item));
  const pinnedItems = pinnedAnchorIds
    .map((anchorId) => items.find((item) => item.anchorId === anchorId) ?? null)
    .filter((item): item is ShortcutItem => Boolean(item));
  const isActiveSectionPinned = activeAnchorForCopy ? pinnedAnchorIds.includes(activeAnchorForCopy) : false;
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
        {showResumeButton && resumeItem ? (
          <button
            type="button"
            className="pf-pill"
            aria-label={`Resume ${resumeItem.label}`}
            title={`Resume ${resumeItem.label} from your last visit`}
            onClick={() => {
              setActiveKey('Resume');
              setActiveAnchorId(resumeItem.anchorId);
              jumpToAnchor(resumeItem.anchorId);
              window.setTimeout(() => {
                setActiveKey((current) => (current === 'Resume' ? null : current));
              }, 1200);
            }}
            style={{ cursor: 'pointer', borderColor: 'var(--primary)', color: 'var(--primary)', background: 'rgba(255,255,255,.92)' }}
          >
            Resume {resumeItem.label}
          </button>
        ) : null}
        <button
          type="button"
          className="pf-pill"
          disabled={!canJumpPrev}
          aria-label="Jump to previous section ([)"
          title="Jump to previous section ([)"
          onClick={() => {
            const previousItem = effectiveActiveIndex > 0 ? items[effectiveActiveIndex - 1] : null;
            if (!canJumpPrev || !previousItem) return;
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
          Open link {activeHashLabel}
        </button>
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
          aria-live="polite"
          aria-label={activeItem ? `${isActiveSectionPinned ? 'Unpin' : 'Pin'} ${activeItem.label} (F)` : 'Pin current section (F)'}
          title={activeItem ? `${isActiveSectionPinned ? 'Unpin' : 'Pin'} ${activeItem.label} (F)` : 'Pin current section (F)'}
          onClick={() => {
            togglePinnedSection(activeAnchorForCopy);
          }}
          style={{
            cursor: 'pointer',
            borderColor: isActiveSectionPinned ? 'var(--primary)' : undefined,
            color: isActiveSectionPinned ? 'var(--primary)' : undefined,
            background: isActiveSectionPinned ? 'rgba(255,255,255,.92)' : undefined,
          }}
        >
          {isActiveSectionPinned ? `Pinned · ${activeItem?.label ?? 'Current'}` : `Pin current · ${activeItem?.label ?? 'Section'}`}
        </button>
        <button
          type="button"
          className="pf-pill"
          disabled={!canJumpNext}
          aria-label="Jump to next section (])"
          title="Jump to next section (])"
          onClick={() => {
            const nextItem = canJumpNext ? items[effectiveActiveIndex + 1] : null;
            if (!canJumpNext || !nextItem) return;
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
      <div className="pf-dim" style={{ display: 'grid', gap: 6, fontSize: 11 }}>
        <div style={{ height: 6, borderRadius: 999, background: 'rgba(15,23,42,0.12)', overflow: 'hidden' }} aria-hidden="true">
          <div
            style={{
              width: `${progressPercent}%`,
              height: '100%',
              background: 'var(--primary)',
              transition: 'width 220ms ease',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="pf-pill" aria-live="polite">
            Progress {progressPercent}%
          </span>
          <span className="pf-pill" aria-live="polite">
            Prev {previousItem ? previousItem.label : '—'}
          </span>
          <span className="pf-pill" aria-live="polite">
            Next {nextItem ? nextItem.label : '—'}
          </span>
          <span className="pf-pill" aria-live="polite">
            Last stop {resumeItem ? resumeItem.label : '—'}
          </span>
          {resumeItem ? (
            <>
              <button
                type="button"
                className="pf-pill"
                aria-label={`Open last stop ${resumeItem.label} in a new tab`}
                title={`Open last stop ${resumeItem.label} in a new tab`}
                onClick={() => {
                  openAnchorLink(resumeItem.anchorId);
                }}
                style={{ cursor: 'pointer' }}
              >
                Open last stop {lastStopLabel}
              </button>
              <button
                type="button"
                className="pf-pill"
                aria-label={`Copy last stop link for ${resumeItem.label}`}
                title={`Copy last stop link for ${resumeItem.label}`}
                onClick={() => {
                  void copyAnchorLink(resumeItem.anchorId)
                    .then(() => {
                      setCopiedAnchorId(resumeItem.anchorId);
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
                      setCopiedAnchorId(resumeItem.anchorId);
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
                Copy last stop {lastStopLabel}
              </button>
              <button
                type="button"
                className="pf-pill"
                aria-label={`Forget saved last stop ${resumeItem.label}`}
                title={`Forget saved last stop ${resumeItem.label}`}
                onClick={() => {
                  clearStoredLastStop();
                  setResumeAnchorId(null);
                }}
                style={{ cursor: 'pointer' }}
              >
                Forget last stop
              </button>
            </>
          ) : null}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {pinnedItems.length > 0 ? (
          <div style={{ display: 'grid', gap: 6 }}>
            <div className="pf-dim" style={{ fontSize: 11 }}>
              Pinboard: keep up to four favorite sections ready for one-tap jumps. Press F to pin or unpin the section currently in view.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {pinnedItems.map((item, index) => {
                const isActive = activeAnchorId === item.anchorId;
                return (
                  <button
                    key={`pinned-${item.anchorId}`}
                    type="button"
                    className="pf-pill"
                    aria-label={`Jump to pinned section ${item.label} (${index + 1})`}
                    title={`Jump to pinned section ${item.label} (${index + 1})`}
                    onClick={() => {
                      setActiveKey(`pin:${index + 1}`);
                      setActiveAnchorId(item.anchorId);
                      jumpToAnchor(item.anchorId);
                      window.setTimeout(() => {
                        setActiveKey((current) => (current === `pin:${index + 1}` ? null : current));
                      }, 1200);
                    }}
                    style={{
                      cursor: 'pointer',
                      borderColor: isActive ? 'var(--primary)' : undefined,
                      color: isActive ? 'var(--primary)' : undefined,
                      background: isActive ? 'rgba(255,255,255,.92)' : undefined,
                    }}
                  >
                    {index + 1} · {item.label}
                  </button>
                );
              })}
              <button
                type="button"
                className="pf-pill"
                aria-label="Clear pinned sections"
                title="Clear pinned sections"
                onClick={() => {
                  setPinnedAnchorIds([]);
                  savePinnedSections([]);
                }}
                style={{ cursor: 'pointer' }}
              >
                Clear pinboard
              </button>
            </div>
          </div>
        ) : null}
        {recentTrailItems.length > 0 ? (
          <div style={{ display: 'grid', gap: 6 }}>
            <div className="pf-dim" style={{ fontSize: 11 }}>
              Recent trail: jump back into the last few sections you touched without losing the filtered route.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {recentTrailItems.map((item, index) => {
                const isActive = activeAnchorId === item.anchorId;
                return (
                  <button
                    key={`trail-${item.anchorId}`}
                    type="button"
                    className="pf-pill"
                    aria-label={`Jump to recent section ${item.label}`}
                    title={`Jump to recent section ${item.label}`}
                    onClick={() => {
                      setActiveKey(`trail:${index + 1}`);
                      setActiveAnchorId(item.anchorId);
                      jumpToAnchor(item.anchorId);
                      window.setTimeout(() => {
                        setActiveKey((current) => (current === `trail:${index + 1}` ? null : current));
                      }, 1200);
                    }}
                    style={{
                      cursor: 'pointer',
                      borderColor: isActive ? 'var(--primary)' : undefined,
                      color: isActive ? 'var(--primary)' : undefined,
                      background: isActive ? 'rgba(255,255,255,.92)' : undefined,
                    }}
                  >
                    Trail {index + 1} · {item.label}
                  </button>
                );
              })}
              <button
                type="button"
                className="pf-pill"
                aria-label="Clear recent section trail"
                title="Clear recent section trail"
                onClick={() => {
                  setRecentAnchorTrail([]);
                  saveRecentSectionTrail([]);
                }}
                style={{ cursor: 'pointer' }}
              >
                Clear trail
              </button>
            </div>
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
              if (event.key === 'Enter' && selectedFilteredItem) {
                event.preventDefault();
                setActiveKey('/');
                setActiveAnchorId(selectedFilteredItem.anchorId);
                jumpToAnchor(selectedFilteredItem.anchorId);
                window.setTimeout(() => {
                  setActiveKey((current) => (current === '/' ? null : current));
                }, 1200);
              }
            }}
            placeholder="Filter sections (/ to focus, ↑/↓ choose, Enter to jump)"
            aria-label="Filter quick jump sections"
            className="pf-pill"
            style={{ minWidth: 240, flex: '1 1 280px', textAlign: 'left', background: 'rgba(255,255,255,.92)' }}
          />
          <span className="pf-pill" aria-live="polite">
            Matches {filteredItems.length}/{items.length}
          </span>
          {searchQuery && selectedFilteredItem ? (
            <>
              <span className="pf-pill" aria-live="polite" style={{ borderColor: 'var(--primary)', color: 'var(--primary)', background: 'rgba(255,255,255,.92)' }}>
                Selected match {selectedFilteredIndex + 1}/{filteredItems.length} · {selectedFilteredItem.label}
                {selectedFilteredMatch?.matchedFields.length ? ` · via ${selectedFilteredMatch.matchedFields.join(', ')}` : ''}
              </span>
              <button
                type="button"
                className="pf-pill"
                aria-label={`Jump to selected match ${selectedFilteredItem.label}`}
                title={`Jump to selected match ${selectedFilteredItem.label}`}
                onClick={() => {
                  setActiveKey('/');
                  setActiveAnchorId(selectedFilteredItem.anchorId);
                  jumpToAnchor(selectedFilteredItem.anchorId);
                  window.setTimeout(() => {
                    setActiveKey((current) => (current === '/' ? null : current));
                  }, 1200);
                }}
                style={{ cursor: 'pointer', borderColor: 'var(--primary)', color: 'var(--primary)', background: 'rgba(255,255,255,.92)' }}
              >
                Jump selected → {selectedFilteredItem.label}
              </button>
              <button
                type="button"
                className="pf-pill"
                aria-label={`Open selected match ${selectedFilteredItem.label}`}
                title={`Open selected match ${selectedFilteredItem.label}`}
                onClick={() => {
                  openAnchorLink(selectedFilteredItem.anchorId);
                }}
                style={{ cursor: 'pointer' }}
              >
                Open selected #{selectedFilteredItem.anchorId}
              </button>
              <button
                type="button"
                className="pf-pill"
                aria-label={`Copy selected match link for ${selectedFilteredItem.label}`}
                title={`Copy selected match link for ${selectedFilteredItem.label}`}
                onClick={() => {
                  void copyAnchorLink(selectedFilteredItem.anchorId)
                    .then(() => {
                      setCopiedAnchorId(selectedFilteredItem.anchorId);
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
                      setCopiedAnchorId(selectedFilteredItem.anchorId);
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
                Copy selected #{selectedFilteredItem.anchorId}
              </button>
            </>
          ) : null}
          {searchQuery ? (
            <button
              type="button"
              className="pf-pill"
              onClick={() => {
                setSearchQuery('');
                searchInputRef.current?.focus();
              }}
              style={{ cursor: 'pointer' }}
            >
              Clear filter
            </button>
          ) : null}
        </div>
        {normalizedSearchQuery && filteredItems.length > 0 ? (
          <div style={{ display: 'grid', gap: 6 }}>
            <div className="pf-dim" style={{ fontSize: 11 }}>
              Filtered route: click any result to jump, or use the side actions to open/copy the direct section link.
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {filteredItemMatches.slice(0, 5).map((match, index) => {
                const { item, matchedFields } = match;
                const isSelected = selectedFilteredItem?.anchorId === item.anchorId;
                const isActive = activeAnchorId === item.anchorId;
                return (
                  <div
                    key={`filtered-${item.anchorId}`}
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      padding: '8px 10px',
                      borderRadius: 14,
                      border: `2px solid ${isSelected ? 'var(--primary)' : 'rgba(15,23,42,0.12)'}`,
                      background: isSelected ? 'rgba(255,255,255,.96)' : 'rgba(255,255,255,.78)',
                    }}
                  >
                    <button
                      type="button"
                      className="pf-pill"
                      aria-label={`Jump to filtered result ${item.label}`}
                      title={`Jump to filtered result ${item.label}`}
                      onClick={() => {
                        setSelectedFilteredIndex(index);
                        setActiveKey('/');
                        setActiveAnchorId(item.anchorId);
                        jumpToAnchor(item.anchorId);
                        window.setTimeout(() => {
                          setActiveKey((current) => (current === '/' ? null : current));
                        }, 1200);
                      }}
                      style={{
                        cursor: 'pointer',
                        borderColor: isSelected ? 'var(--primary)' : undefined,
                        color: isSelected ? 'var(--primary)' : undefined,
                        background: isSelected ? 'rgba(255,255,255,.92)' : undefined,
                      }}
                    >
                      #{index + 1} Alt+{item.keyLabel} · {item.label}
                    </button>
                    <span className="pf-pill" aria-live="polite">
                      #{item.anchorId}
                    </span>
                    {matchedFields.map((field) => (
                      <span key={`${item.anchorId}-${field}`} className="pf-pill" aria-live="polite">
                        match {field}
                      </span>
                    ))}
                    {isActive ? (
                      <span className="pf-pill" style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                        live section
                      </span>
                    ) : null}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
                      <button
                        type="button"
                        className="pf-pill"
                        aria-label={`Open filtered result ${item.label}`}
                        title={`Open filtered result ${item.label}`}
                        onClick={() => {
                          setSelectedFilteredIndex(index);
                          openAnchorLink(item.anchorId);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        className="pf-pill"
                        aria-label={`${pinnedAnchorIds.includes(item.anchorId) ? 'Unpin' : 'Pin'} filtered result ${item.label}`}
                        title={`${pinnedAnchorIds.includes(item.anchorId) ? 'Unpin' : 'Pin'} filtered result ${item.label}`}
                        onClick={() => {
                          setSelectedFilteredIndex(index);
                          togglePinnedSection(item.anchorId);
                        }}
                        style={{
                          cursor: 'pointer',
                          borderColor: pinnedAnchorIds.includes(item.anchorId) ? 'var(--primary)' : undefined,
                          color: pinnedAnchorIds.includes(item.anchorId) ? 'var(--primary)' : undefined,
                        }}
                      >
                        {pinnedAnchorIds.includes(item.anchorId) ? 'Unpin' : 'Pin'}
                      </button>
                      <button
                        type="button"
                        className="pf-pill"
                        aria-label={`Copy filtered result link for ${item.label}`}
                        title={`Copy filtered result link for ${item.label}`}
                        onClick={() => {
                          setSelectedFilteredIndex(index);
                          void copyAnchorLink(item.anchorId)
                            .then(() => {
                              setCopiedAnchorId(item.anchorId);
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
                              setCopiedAnchorId(item.anchorId);
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
                        Copy link
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {filteredItems.length > 5 ? (
              <div className="pf-dim" style={{ fontSize: 11 }}>
                Showing top 5 matches. Use ↑ / ↓ to move through the full result set, then Enter to jump.
              </div>
            ) : null}
          </div>
        ) : null}
        {normalizedSearchQuery && filteredItems.length === 0 ? (
          <div className="pf-dim" style={{ fontSize: 11 }}>
            No section matches that filter yet. Try label words like market, desk, operator, or leaderboard.
          </div>
        ) : null}
      </div>
      <div className="pf-dim" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
        {filteredItems.map((item) => {
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
