"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';

import { buildBulkPinnedAnchorIds, buildQuickJumpNoMatchSuggestions, buildRouteContextAnchorIds, buildVisibleQuickJumpMatchIndexes, getQuickJumpFilteredSelectionIndex, getQuickJumpNoMatchEnterAction, getQuickJumpRelevanceScore, MAX_PINNED_SECTIONS, sortQuickJumpItemMatches } from '../lib/quick-jump';

const LAST_ACTIVE_SECTION_STORAGE_KEY = 'promptfolio-last-active-section';
const RECENT_SECTION_TRAIL_STORAGE_KEY = 'promptfolio-recent-section-trail';
const PINNED_SECTION_STORAGE_KEY = 'promptfolio-pinned-sections';
const SHORTCUT_GUIDE_STORAGE_KEY = 'promptfolio-shortcut-guide';
const FILTER_QUERY_STORAGE_KEY = 'promptfolio-section-filter-query';
const SHOW_ALL_FILTERED_RESULTS_STORAGE_KEY = 'promptfolio-show-all-filtered-results';
const FILTER_QUERY_SEARCH_PARAM = 'jump';
const MAX_RECENT_SECTION_TRAIL = 3;

function buildAnchorUrl(anchorId: string) {
  if (typeof window === 'undefined') {
    return `#${anchorId}`;
  }

  const url = new URL(window.location.href);
  url.hash = anchorId;
  return url.toString();
}

function buildFilteredViewUrl(query: string, anchorId?: string | null) {
  if (typeof window === 'undefined') {
    const normalizedQuery = query.trim();
    const search = normalizedQuery ? `?${FILTER_QUERY_SEARCH_PARAM}=${encodeURIComponent(normalizedQuery)}` : '';
    const hash = anchorId ? `#${anchorId}` : '';
    return `${search}${hash}` || '#';
  }

  const url = new URL(window.location.href);
  const normalizedQuery = query.trim();

  if (normalizedQuery) {
    url.searchParams.set(FILTER_QUERY_SEARCH_PARAM, normalizedQuery);
  } else {
    url.searchParams.delete(FILTER_QUERY_SEARCH_PARAM);
  }

  url.hash = anchorId ?? '';
  return url.toString();
}

async function copyAnchorLink(anchorId: string) {
  await navigator.clipboard.writeText(buildAnchorUrl(anchorId));
}

async function copyFilteredViewLink(query: string, anchorId?: string | null) {
  await navigator.clipboard.writeText(buildFilteredViewUrl(query, anchorId));
}

function openFilteredViewLink(query: string, anchorId?: string | null) {
  const href = buildFilteredViewUrl(query, anchorId);
  if (typeof window === 'undefined') {
    return false;
  }

  const opened = window.open(href, '_blank', 'noopener,noreferrer');
  if (!opened) {
    window.location.href = href;
  }

  return true;
}

function openAnchorLink(anchorId: string) {
  const href = buildAnchorUrl(anchorId);
  if (typeof window === 'undefined') {
    return false;
  }

  const opened = window.open(href, '_blank', 'noopener,noreferrer');
  if (!opened) {
    window.location.href = href;
  }

  return true;
}

async function copyShortcutGuide(items: ShortcutItem[]) {
  const lines = [
    'Promptfolio quick jump shortcuts',
    '',
    '? → Open or close the shortcuts guide',
    '/ → Focus the section filter',
    '↑ / ↓ / PgUp / PgDn → Move through filtered matches',
    'Home / End (while filter is focused) → Jump to the first or last filtered match',
    'Enter → Jump to the selected filtered match',
    'Cmd/Ctrl+Enter → Open the selected filtered match in a new tab',
    'Alt+Enter → Copy the selected filtered match link',
    'Esc → Clear the filter or close the guide',
    'Click outside the guide → Close it without losing your current section',
    '[ / ] → Move to the previous or next section',
    'J / K → Vim-style next or previous section jump',
    'Home / End → Jump to the first or last section',
    'C → Copy the current section link',
    'O → Open the current section link in a new tab',
    'B → Copy the reusable navigation bundle',
    'R → Resume the last saved section',
    'Shift+R → Reset saved nav state (pins, trail, last stop, filter)',
    'F → Pin or unpin the current section',
    '1-4 → Jump to pinned sections',
    '5-7 → Jump to the recent trail',
    'Shift+P → Copy the pinned section bundle',
    'Shift+T → Copy the recent trail bundle',
    'Shift+C (while filter is focused) → Copy the filtered result bundle',
    'Shift+L (while filter is focused) → Copy the current filtered view link',
    'Shift+O (while filter is focused) → Open the current filtered view in a new tab',
    'Shift+F (while filter is focused) → Pin or unpin all filtered matches',
    '. (while filter is focused) → Toggle between top matches and the full filtered list',
    'Alt+key → Jump to a section directly',
    'Alt+Shift+key → Copy a direct section link',
    '',
    ...items.map((item) => `Alt+${item.keyLabel} → ${item.label} (${buildAnchorUrl(item.anchorId)})`),
  ];

  await navigator.clipboard.writeText(lines.join('\n'));
}

async function copyNavigationBundle({
  items,
  activeItem,
  resumeItem,
  pinnedItems,
  recentTrailItems,
}: {
  items: ShortcutItem[];
  activeItem: ShortcutItem | null;
  resumeItem: ShortcutItem | null;
  pinnedItems: ShortcutItem[];
  recentTrailItems: ShortcutItem[];
}) {
  const lines = [
    'Promptfolio navigation bundle',
    '',
    `Current section: ${activeItem ? `${activeItem.label} (${buildAnchorUrl(activeItem.anchorId)})` : 'Top'}`,
    `Last stop: ${resumeItem ? `${resumeItem.label} (${buildAnchorUrl(resumeItem.anchorId)})` : '—'}`,
    '',
    'Pinned sections:',
    ...(pinnedItems.length
      ? pinnedItems.map((item, index) => `${index + 1}. ${item.label} (${buildAnchorUrl(item.anchorId)})`)
      : ['—']),
    '',
    'Recent trail:',
    ...(recentTrailItems.length
      ? recentTrailItems.map((item, index) => `${index + 1}. ${item.label} (${buildAnchorUrl(item.anchorId)})`)
      : ['—']),
    '',
    'All direct jumps:',
    ...items.map((item) => `Alt+${item.keyLabel} → ${item.label} (${buildAnchorUrl(item.anchorId)})`),
  ];

  await navigator.clipboard.writeText(lines.join('\n'));
}


async function copyRouteContextBundle({
  query,
  selectedItem,
  contextItems,
}: {
  query: string;
  selectedItem: ShortcutItem;
  contextItems: ShortcutItem[];
}) {
  const lines = [
    'Promptfolio route context bundle',
    '',
    `Filter query: ${query || '—'}`,
    `Selected section: ${selectedItem.label} (${buildAnchorUrl(selectedItem.anchorId)})`,
    '',
    'Route context:',
    ...contextItems.map((item, index) => {
      const role = item.anchorId === selectedItem.anchorId ? 'current' : index < contextItems.findIndex((contextItem) => contextItem.anchorId === selectedItem.anchorId) ? 'before' : 'after';
      return `- ${role.toUpperCase()} · ${item.label} (${buildAnchorUrl(item.anchorId)}) · Alt+${item.keyLabel}`;
    }),
  ];

  await navigator.clipboard.writeText(lines.join('\n'));
}

async function copyFilteredResultsBundle({
  query,
  items,
}: {
  query: string;
  items: ShortcutItem[];
}) {
  const lines = [
    'Promptfolio filtered quick jump bundle',
    '',
    `Filter query: ${query || '—'}`,
    `Match count: ${items.length}`,
    '',
    ...(items.length
      ? items.map((item, index) => `${index + 1}. ${item.label} (${buildAnchorUrl(item.anchorId)}) · Alt+${item.keyLabel}`)
      : ['No matched sections.']),
  ];

  await navigator.clipboard.writeText(lines.join('\n'));
}

async function copyRescueBundle({
  query,
  activeItem,
  fallbackItems,
}: {
  query: string;
  activeItem: ShortcutItem | null;
  fallbackItems: ShortcutItem[];
}) {
  const lines = [
    'Promptfolio rescue quick jump bundle',
    '',
    `Missed filter: ${query || '—'}`,
    `Current section: ${activeItem ? `${activeItem.label} (${buildAnchorUrl(activeItem.anchorId)})` : 'Top'}`,
    '',
    'Suggested recovery jumps:',
    ...(fallbackItems.length
      ? fallbackItems.map((item, index) => `${index + 1}. ${item.label} (${buildAnchorUrl(item.anchorId)}) · Alt+${item.keyLabel}`)
      : ['No recovery jumps saved yet.']),
  ];

  await navigator.clipboard.writeText(lines.join('\n'));
}


async function copyPinnedSectionsBundle(items: ShortcutItem[]) {
  const lines = [
    'Promptfolio pinned quick jump bundle',
    '',
    `Pinned count: ${items.length}`,
    '',
    ...(items.length
      ? items.map((item, index) => `${index + 1}. ${item.label} (${buildAnchorUrl(item.anchorId)}) · Alt+${item.keyLabel}`)
      : ['No pinned sections.']),
  ];

  await navigator.clipboard.writeText(lines.join('\n'));
}

async function copyRecentTrailBundle(items: ShortcutItem[]) {
  const lines = [
    'Promptfolio recent quick jump trail',
    '',
    `Recent count: ${items.length}`,
    '',
    ...(items.length
      ? items.map((item, index) => `${index + 1}. ${item.label} (${buildAnchorUrl(item.anchorId)}) · Alt+${item.keyLabel}`)
      : ['No recent sections.']),
  ];

  await navigator.clipboard.writeText(lines.join('\n'));
}

type ShortcutItem = {
  keyLabel: string;
  anchorId: string;
  label: string;
};

type ShortcutItemMatchMeta = {
  item: ShortcutItem;
  matchedFields: string[];
  relevanceScore?: number;
};

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokenizeSearchText(value: string) {
  return normalizeSearchText(value).split(/\s+/).filter(Boolean);
}

function buildShortcutAliases(item: ShortcutItem) {
  const labelTokens = tokenizeSearchText(item.label);
  const anchorTokens = tokenizeSearchText(item.anchorId);
  const acronym = labelTokens.map((token) => token[0]).join('');

  return Array.from(new Set([
    item.label,
    item.anchorId,
    item.keyLabel,
    labelTokens.join(' '),
    labelTokens.join(''),
    anchorTokens.join(' '),
    anchorTokens.join(''),
    acronym,
    `${item.keyLabel} ${labelTokens.join(' ')}`,
  ].filter(Boolean)));
}

function includesAllSearchTokens(haystacks: string[], searchTokens: string[]) {
  if (searchTokens.length === 0) {
    return false;
  }

  return searchTokens.every((token) => haystacks.some((haystack) => haystack.includes(token)));
}

function getShortcutItemMatchMeta(item: ShortcutItem, normalizedSearchQuery: string): ShortcutItemMatchMeta | null {
  if (!normalizedSearchQuery) {
    return { item, matchedFields: [] };
  }

  const searchTokens = tokenizeSearchText(normalizedSearchQuery);
  const normalizedLabel = normalizeSearchText(item.label);
  const normalizedAnchorId = normalizeSearchText(item.anchorId);
  const normalizedShortcut = normalizeSearchText(item.keyLabel);
  const normalizedAliases = buildShortcutAliases(item).map((alias) => normalizeSearchText(alias));
  const matchedFields: string[] = [];

  if (normalizedLabel.includes(normalizedSearchQuery) || includesAllSearchTokens([normalizedLabel], searchTokens)) {
    matchedFields.push('label');
  }
  if (normalizedAnchorId.includes(normalizedSearchQuery) || includesAllSearchTokens([normalizedAnchorId], searchTokens)) {
    matchedFields.push('section id');
  }
  if (normalizedShortcut.includes(normalizedSearchQuery) || includesAllSearchTokens([normalizedShortcut], searchTokens)) {
    matchedFields.push('shortcut');
  }
  if (includesAllSearchTokens(normalizedAliases, searchTokens)) {
    matchedFields.push('aliases');
  }

  if (matchedFields.length === 0) {
    return null;
  }

  return {
    item,
    matchedFields: Array.from(new Set(matchedFields)),
    relevanceScore: getQuickJumpRelevanceScore({
      normalizedSearchQuery,
      haystacks: [normalizedLabel, normalizedAnchorId, normalizedShortcut, ...normalizedAliases],
    }),
  };
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

function clearStoredNavigationState() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(LAST_ACTIVE_SECTION_STORAGE_KEY);
    window.localStorage.removeItem(RECENT_SECTION_TRAIL_STORAGE_KEY);
    window.localStorage.removeItem(PINNED_SECTION_STORAGE_KEY);
    window.localStorage.removeItem(FILTER_QUERY_STORAGE_KEY);
    window.localStorage.removeItem(SHOW_ALL_FILTERED_RESULTS_STORAGE_KEY);
  } catch {
    // Ignore storage write failures and keep reset actions non-blocking.
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

function loadFilterQueryFromUrl() {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    const url = new URL(window.location.href);
    return url.searchParams.get(FILTER_QUERY_SEARCH_PARAM) ?? '';
  } catch {
    return '';
  }
}

function loadStoredFilterQuery() {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return window.localStorage.getItem(FILTER_QUERY_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveStoredFilterQuery(value: string) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (value) {
      window.localStorage.setItem(FILTER_QUERY_STORAGE_KEY, value);
      return;
    }

    window.localStorage.removeItem(FILTER_QUERY_STORAGE_KEY);
  } catch {
    // Ignore storage write failures so the filter stays interactive.
  }
}

function loadStoredShowAllFilteredResults() {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem(SHOW_ALL_FILTERED_RESULTS_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function saveStoredShowAllFilteredResults(value: boolean) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (value) {
      window.localStorage.setItem(SHOW_ALL_FILTERED_RESULTS_STORAGE_KEY, 'true');
      return;
    }

    window.localStorage.removeItem(SHOW_ALL_FILTERED_RESULTS_STORAGE_KEY);
  } catch {
    // Ignore storage write failures so the expanded results view stays optional.
  }
}

function syncFilterQueryToUrl(value: string) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const url = new URL(window.location.href);
    const normalizedValue = value.trim();

    if (normalizedValue) {
      url.searchParams.set(FILTER_QUERY_SEARCH_PARAM, normalizedValue);
    } else {
      url.searchParams.delete(FILTER_QUERY_SEARCH_PARAM);
    }

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(null, '', nextUrl);
  } catch {
    // Ignore history failures so the filter remains usable.
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
  const [navigationBundleCopyState, setNavigationBundleCopyState] = useState<'idle' | 'done' | 'error'>('idle');
  const [filteredResultsCopyState, setFilteredResultsCopyState] = useState<'idle' | 'done' | 'error'>('idle');
  const [filteredViewLinkCopyState, setFilteredViewLinkCopyState] = useState<'idle' | 'done' | 'error'>('idle');
  const [filteredRouteCopyState, setFilteredRouteCopyState] = useState<'idle' | 'done' | 'error'>('idle');
  const [activeRouteBundleCopyState, setActiveRouteBundleCopyState] = useState<'idle' | 'done' | 'error'>('idle');
  const [pinnedBundleCopyState, setPinnedBundleCopyState] = useState<'idle' | 'done' | 'error'>('idle');
  const [recentTrailBundleCopyState, setRecentTrailBundleCopyState] = useState<'idle' | 'done' | 'error'>('idle');
  const [rescueBundleCopyState, setRescueBundleCopyState] = useState<'idle' | 'done' | 'error'>('idle');
  const [shortcutGuideOpen, setShortcutGuideOpen] = useState(false);
  const [shortcutGuideCopyState, setShortcutGuideCopyState] = useState<'idle' | 'done' | 'error'>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilteredIndex, setSelectedFilteredIndex] = useState(0);
  const [showAllFilteredResults, setShowAllFilteredResults] = useState(false);
  const clearActiveKeyTimeoutRef = useRef<number | null>(null);
  const clearCopyStateTimeoutRef = useRef<number | null>(null);
  const clearNavigationBundleCopyStateTimeoutRef = useRef<number | null>(null);
  const clearFilteredResultsCopyStateTimeoutRef = useRef<number | null>(null);
  const clearFilteredViewLinkCopyStateTimeoutRef = useRef<number | null>(null);
  const clearFilteredRouteCopyStateTimeoutRef = useRef<number | null>(null);
  const clearActiveRouteBundleCopyStateTimeoutRef = useRef<number | null>(null);
  const clearPinnedBundleCopyStateTimeoutRef = useRef<number | null>(null);
  const clearRecentTrailBundleCopyStateTimeoutRef = useRef<number | null>(null);
  const clearRescueBundleCopyStateTimeoutRef = useRef<number | null>(null);
  const clearShortcutGuideCopyStateTimeoutRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const shortcutGuidePanelRef = useRef<HTMLDivElement | null>(null);
  const previousNormalizedSearchQueryRef = useRef('');
  const itemIds = useMemo(() => new Set(items.map((item) => item.anchorId)), [items]);
  const activeIndex = useMemo(() => items.findIndex((item) => item.anchorId === activeAnchorId), [activeAnchorId, items]);
  const activeItem = activeIndex >= 0 ? items[activeIndex] : items[0] ?? null;
  const activeAnchorForCopy = activeItem?.anchorId ?? 'home-top';
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredItemMatches = useMemo(() => {
    if (!normalizedSearchQuery) {
      return items.map((item) => ({ item, matchedFields: [] }));
    }

    const matches = items
      .map((item) => getShortcutItemMatchMeta(item, normalizedSearchQuery))
      .filter((match): match is ShortcutItemMatchMeta => Boolean(match));

    return sortQuickJumpItemMatches({
      matches,
      anchorIdsInRouteOrder: items.map((item) => item.anchorId),
    });
  }, [items, normalizedSearchQuery]);
  const filteredItems = filteredItemMatches.map((match) => match.item);
  const selectedFilteredItem = filteredItems[Math.min(selectedFilteredIndex, Math.max(filteredItems.length - 1, 0))] ?? null;
  const selectedFilteredMatch = filteredItemMatches[Math.min(selectedFilteredIndex, Math.max(filteredItemMatches.length - 1, 0))] ?? null;
  const everyFilteredItemPinned = filteredItems.length > 0 && filteredItems.every((item) => pinnedAnchorIds.includes(item.anchorId));
  const filteredPinPreview = buildBulkPinnedAnchorIds({
    currentPinnedAnchorIds: pinnedAnchorIds,
    filteredAnchorIds: filteredItems.map((item) => item.anchorId),
    selectedAnchorId: selectedFilteredItem?.anchorId ?? null,
  });
  const willTrimFilteredPins = !everyFilteredItemPinned && filteredItems.length > MAX_PINNED_SECTIONS;
  const visibleFilteredMatchIndexes = showAllFilteredResults
    ? filteredItemMatches.map((_, index) => index)
    : buildVisibleQuickJumpMatchIndexes({
        totalMatches: filteredItemMatches.length,
        selectedIndex: selectedFilteredIndex,
      });
  const visibleFilteredMatches = visibleFilteredMatchIndexes.map((index) => ({
    match: filteredItemMatches[index],
    index,
  }));
  const selectedFilteredRouteContextItems = buildRouteContextAnchorIds({
    anchorIds: items.map((item) => item.anchorId),
    selectedAnchorId: selectedFilteredItem?.anchorId ?? null,
  })
    .map((anchorId) => items.find((item) => item.anchorId === anchorId) ?? null)
    .filter((item): item is ShortcutItem => Boolean(item));
  const selectedFilteredPrevItem = selectedFilteredRouteContextItems[0]?.anchorId !== selectedFilteredItem?.anchorId
    ? selectedFilteredRouteContextItems[0] ?? null
    : null;
  const selectedFilteredNextItem = selectedFilteredRouteContextItems[selectedFilteredRouteContextItems.length - 1]?.anchorId !== selectedFilteredItem?.anchorId
    ? selectedFilteredRouteContextItems[selectedFilteredRouteContextItems.length - 1] ?? null
    : null;

  useEffect(() => {
    setSelectedFilteredIndex((current) => getQuickJumpFilteredSelectionIndex({
      anchorIds: filteredItems.map((item) => item.anchorId),
      selectedAnchorId: activeAnchorId,
      currentQuery: normalizedSearchQuery,
      previousQuery: previousNormalizedSearchQueryRef.current,
      previousIndex: current,
    }));
    previousNormalizedSearchQueryRef.current = normalizedSearchQuery;
    setShowAllFilteredResults(false);
  }, [activeAnchorId, filteredItems, normalizedSearchQuery]);

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

    try {
      setShortcutGuideOpen(window.localStorage.getItem(SHORTCUT_GUIDE_STORAGE_KEY) === 'open');
    } catch {
      // Ignore storage read failures and keep the guide collapsed by default.
    }

    const filterQueryFromUrl = loadFilterQueryFromUrl().trim();
    const storedFilterQuery = loadStoredFilterQuery().trim();
    const initialFilterQuery = filterQueryFromUrl || storedFilterQuery;
    if (initialFilterQuery) {
      setSearchQuery((current) => current || initialFilterQuery);
    }

    setShowAllFilteredResults(loadStoredShowAllFilteredResults());

    const syncFromHash = () => {
      const queryFromUrl = loadFilterQueryFromUrl().trim();
      setSearchQuery((current) => (current === queryFromUrl ? current : queryFromUrl));

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
    window.addEventListener('popstate', syncFromHash);

    return () => {
      window.removeEventListener('hashchange', syncFromHash);
      window.removeEventListener('popstate', syncFromHash);
    };
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

  useEffect(() => {
    try {
      window.localStorage.setItem(SHORTCUT_GUIDE_STORAGE_KEY, shortcutGuideOpen ? 'open' : 'closed');
    } catch {
      // Ignore storage write failures and keep the guide optional.
    }
  }, [shortcutGuideOpen]);

  useEffect(() => {
    if (!shortcutGuideOpen) {
      return;
    }

    shortcutGuidePanelRef.current?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      if (!shortcutGuidePanelRef.current) return;
      if (shortcutGuidePanelRef.current.contains(event.target as Node)) return;
      setShortcutGuideOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [shortcutGuideOpen]);

  useEffect(() => {
    const normalizedQuery = searchQuery.trim();
    saveStoredFilterQuery(normalizedQuery);
    syncFilterQueryToUrl(normalizedQuery);
  }, [searchQuery]);

  useEffect(() => {
    saveStoredShowAllFilteredResults(showAllFilteredResults && normalizedSearchQuery.length > 0);
  }, [normalizedSearchQuery, showAllFilteredResults]);

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
    const currentActiveItem = items.find((item) => item.anchorId === activeAnchorForCopy) ?? items[0] ?? null;
    const currentResumeItem = resumeAnchorId ? items.find((item) => item.anchorId === resumeAnchorId) ?? null : null;
    const currentPinnedItems = pinnedAnchorIds
      .map((anchorId) => items.find((item) => item.anchorId === anchorId) ?? null)
      .filter((item): item is ShortcutItem => Boolean(item));
    const currentRecentTrailItems = recentAnchorTrail
      .filter((anchorId) => anchorId !== activeAnchorId)
      .map((anchorId) => items.find((item) => item.anchorId === anchorId) ?? null)
      .filter((item): item is ShortcutItem => Boolean(item));

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

      const isSearchFocused = document.activeElement === searchInputRef.current;

      if ((event.key === '?' || (event.key === '/' && event.shiftKey)) && !event.altKey && !event.metaKey && !event.ctrlKey && !isTypingTarget) {
        event.preventDefault();
        setShortcutGuideOpen((current) => !current);
        return;
      }

      if (event.key === '/' && !event.altKey && !event.shiftKey && (!isTypingTarget || isSearchFocused)) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (event.key === 'Escape' && !event.altKey && !event.metaKey && !event.ctrlKey) {
        if (shortcutGuideOpen) {
          event.preventDefault();
          setShortcutGuideOpen(false);
          return;
        }

        if (document.activeElement === searchInputRef.current || searchQuery) {
          event.preventDefault();
          setSearchQuery('');
          setSelectedFilteredIndex(0);
          searchInputRef.current?.blur();
        }
        return;
      }

      if (isSearchFocused && filteredItems.length > 0) {
        if (event.key === 'ArrowDown' || event.key === 'PageDown') {
          event.preventDefault();
          setSelectedFilteredIndex((current) => (current + 1) % filteredItems.length);
          return;
        }

        if (event.key === 'ArrowUp' || event.key === 'PageUp') {
          event.preventDefault();
          setSelectedFilteredIndex((current) => (current - 1 + filteredItems.length) % filteredItems.length);
          return;
        }

        if (event.key === 'Home') {
          event.preventDefault();
          setSelectedFilteredIndex(0);
          return;
        }

        if (event.key === 'End') {
          event.preventDefault();
          setSelectedFilteredIndex(filteredItems.length - 1);
          return;
        }

        if (event.key === '.' && filteredItems.length > 5 && !event.altKey && !event.shiftKey) {
          event.preventDefault();
          setShowAllFilteredResults((current) => !current);
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

      if (!event.shiftKey && /^[5-7]$/.test(event.key)) {
        const trailIndex = Number(event.key) - 5;
        const trailAnchorId = recentAnchorTrail.filter((anchorId) => anchorId !== activeAnchorId)[trailIndex] ?? null;
        const trailItem = trailAnchorId ? items.find((item) => item.anchorId === trailAnchorId) ?? null : null;
        if (!trailItem) return;

        event.preventDefault();
        if (!jumpToAnchor(trailItem.anchorId)) return;

        setActiveKey(`trail:${trailIndex + 1}`);
        setActiveAnchorId(trailItem.anchorId);
        clearActiveKey();
        return;
      }

      if (event.shiftKey) {
        if (event.key.toLowerCase() === 'c' && isSearchFocused && normalizedSearchQuery && filteredItems.length > 0) {
          event.preventDefault();
          void copyFilteredResultsBundle({
            query: searchQuery.trim(),
            items: filteredItems,
          })
            .then(() => {
              setFilteredResultsCopyState('done');
              if (clearFilteredResultsCopyStateTimeoutRef.current !== null) {
                window.clearTimeout(clearFilteredResultsCopyStateTimeoutRef.current);
              }
              clearFilteredResultsCopyStateTimeoutRef.current = window.setTimeout(() => {
                setFilteredResultsCopyState('idle');
              }, 1600);
            })
            .catch(() => {
              setFilteredResultsCopyState('error');
              if (clearFilteredResultsCopyStateTimeoutRef.current !== null) {
                window.clearTimeout(clearFilteredResultsCopyStateTimeoutRef.current);
              }
              clearFilteredResultsCopyStateTimeoutRef.current = window.setTimeout(() => {
                setFilteredResultsCopyState('idle');
              }, 2200);
            });
          return;
        }

        if (event.key.toLowerCase() === 'l' && isSearchFocused && normalizedSearchQuery) {
          event.preventDefault();
          void copyFilteredViewLink(searchQuery.trim(), selectedFilteredItem?.anchorId ?? activeAnchorId)
            .then(() => {
              setFilteredViewLinkCopyState('done');
              if (clearFilteredViewLinkCopyStateTimeoutRef.current !== null) {
                window.clearTimeout(clearFilteredViewLinkCopyStateTimeoutRef.current);
              }
              clearFilteredViewLinkCopyStateTimeoutRef.current = window.setTimeout(() => {
                setFilteredViewLinkCopyState('idle');
              }, 1600);
            })
            .catch(() => {
              setFilteredViewLinkCopyState('error');
              if (clearFilteredViewLinkCopyStateTimeoutRef.current !== null) {
                window.clearTimeout(clearFilteredViewLinkCopyStateTimeoutRef.current);
              }
              clearFilteredViewLinkCopyStateTimeoutRef.current = window.setTimeout(() => {
                setFilteredViewLinkCopyState('idle');
              }, 2200);
            });
          return;
        }

        if (event.key.toLowerCase() === 'o' && isSearchFocused && normalizedSearchQuery) {
          event.preventDefault();
          openFilteredViewLink(searchQuery.trim(), selectedFilteredItem?.anchorId ?? activeAnchorId);
          return;
        }

        if (event.key.toLowerCase() === 'f' && isSearchFocused && filteredItems.length > 0) {
          event.preventDefault();
          setPinnedAnchorIds((current) => {
            const nextPinned = everyFilteredItemPinned
              ? current.filter((anchorId) => !filteredItems.some((item) => item.anchorId === anchorId))
              : buildBulkPinnedAnchorIds({
                  currentPinnedAnchorIds: current,
                  filteredAnchorIds: filteredItems.map((item) => item.anchorId),
                  selectedAnchorId: selectedFilteredItem?.anchorId ?? null,
                });
            savePinnedSections(nextPinned);
            return nextPinned;
          });
          return;
        }

        if (event.key.toLowerCase() === 'p' && currentPinnedItems.length > 0) {
          event.preventDefault();
          void copyPinnedSectionsBundle(currentPinnedItems)
            .then(() => {
              setPinnedBundleCopyState('done');
              if (clearPinnedBundleCopyStateTimeoutRef.current !== null) {
                window.clearTimeout(clearPinnedBundleCopyStateTimeoutRef.current);
              }
              clearPinnedBundleCopyStateTimeoutRef.current = window.setTimeout(() => {
                setPinnedBundleCopyState('idle');
              }, 1800);
            })
            .catch(() => {
              setPinnedBundleCopyState('error');
              if (clearPinnedBundleCopyStateTimeoutRef.current !== null) {
                window.clearTimeout(clearPinnedBundleCopyStateTimeoutRef.current);
              }
              clearPinnedBundleCopyStateTimeoutRef.current = window.setTimeout(() => {
                setPinnedBundleCopyState('idle');
              }, 2200);
            });
          return;
        }

        if (event.key.toLowerCase() === 't' && currentRecentTrailItems.length > 0) {
          event.preventDefault();
          void copyRecentTrailBundle(currentRecentTrailItems)
            .then(() => {
              setRecentTrailBundleCopyState('done');
              if (clearRecentTrailBundleCopyStateTimeoutRef.current !== null) {
                window.clearTimeout(clearRecentTrailBundleCopyStateTimeoutRef.current);
              }
              clearRecentTrailBundleCopyStateTimeoutRef.current = window.setTimeout(() => {
                setRecentTrailBundleCopyState('idle');
              }, 1800);
            })
            .catch(() => {
              setRecentTrailBundleCopyState('error');
              if (clearRecentTrailBundleCopyStateTimeoutRef.current !== null) {
                window.clearTimeout(clearRecentTrailBundleCopyStateTimeoutRef.current);
              }
              clearRecentTrailBundleCopyStateTimeoutRef.current = window.setTimeout(() => {
                setRecentTrailBundleCopyState('idle');
              }, 2200);
            });
          return;
        }

        if (event.key.toLowerCase() === 'r') {
          event.preventDefault();
          clearStoredNavigationState();
          setResumeAnchorId(null);
          setPinnedAnchorIds([]);
          setRecentAnchorTrail([]);
          setSearchQuery('');
          setSelectedFilteredIndex(0);
          setShowAllFilteredResults(false);
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          if (items[0]) {
            setActiveKey('Reset');
            setActiveAnchorId(items[0].anchorId);
            jumpToAnchor(items[0].anchorId);
            clearActiveKey();
          }
          return;
        }
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

      if (event.key.toLowerCase() === 'b') {
        event.preventDefault();
        void copyNavigationBundle({
          items,
          activeItem: currentActiveItem,
          resumeItem: currentResumeItem,
          pinnedItems: currentPinnedItems,
          recentTrailItems: currentRecentTrailItems,
        })
          .then(() => {
            setNavigationBundleCopyState('done');
            if (clearNavigationBundleCopyStateTimeoutRef.current !== null) {
              window.clearTimeout(clearNavigationBundleCopyStateTimeoutRef.current);
            }
            clearNavigationBundleCopyStateTimeoutRef.current = window.setTimeout(() => {
              setNavigationBundleCopyState('idle');
            }, 1800);
          })
          .catch(() => {
            setNavigationBundleCopyState('error');
            if (clearNavigationBundleCopyStateTimeoutRef.current !== null) {
              window.clearTimeout(clearNavigationBundleCopyStateTimeoutRef.current);
            }
            clearNavigationBundleCopyStateTimeoutRef.current = window.setTimeout(() => {
              setNavigationBundleCopyState('idle');
            }, 2200);
          });
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
      if (clearNavigationBundleCopyStateTimeoutRef.current !== null) {
        window.clearTimeout(clearNavigationBundleCopyStateTimeoutRef.current);
      }
      if (clearFilteredResultsCopyStateTimeoutRef.current !== null) {
        window.clearTimeout(clearFilteredResultsCopyStateTimeoutRef.current);
      }
      if (clearFilteredViewLinkCopyStateTimeoutRef.current !== null) {
        window.clearTimeout(clearFilteredViewLinkCopyStateTimeoutRef.current);
      }
      if (clearFilteredRouteCopyStateTimeoutRef.current !== null) {
        window.clearTimeout(clearFilteredRouteCopyStateTimeoutRef.current);
      }
      if (clearActiveRouteBundleCopyStateTimeoutRef.current !== null) {
        window.clearTimeout(clearActiveRouteBundleCopyStateTimeoutRef.current);
      }
      if (clearPinnedBundleCopyStateTimeoutRef.current !== null) {
        window.clearTimeout(clearPinnedBundleCopyStateTimeoutRef.current);
      }
      if (clearRecentTrailBundleCopyStateTimeoutRef.current !== null) {
        window.clearTimeout(clearRecentTrailBundleCopyStateTimeoutRef.current);
      }
      if (clearRescueBundleCopyStateTimeoutRef.current !== null) {
        window.clearTimeout(clearRescueBundleCopyStateTimeoutRef.current);
      }
      if (clearShortcutGuideCopyStateTimeoutRef.current !== null) {
        window.clearTimeout(clearShortcutGuideCopyStateTimeoutRef.current);
      }
    };
  }, [
    activeAnchorForCopy,
    activeAnchorId,
    everyFilteredItemPinned,
    filteredItems,
    filteredItems.length,
    items,
    normalizedSearchQuery,
    pinnedAnchorIds,
    recentAnchorTrail,
    resumeAnchorId,
    searchQuery,
    selectedFilteredItem?.anchorId,
    shortcutGuideOpen,
    togglePinnedSection,
  ]);

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
  const activeRouteContextItems = buildRouteContextAnchorIds({
    anchorIds: items.map((item) => item.anchorId),
    selectedAnchorId: activeItem?.anchorId ?? null,
  })
    .map((anchorId) => items.find((item) => item.anchorId === anchorId) ?? null)
    .filter((item): item is ShortcutItem => Boolean(item));
  const lastStopLabel = resumeItem ? `#${resumeItem.anchorId}` : null;
  const activeHashLabel = activeItem ? `#${activeItem.anchorId}` : '#home-top';
  const copiedItem = copiedAnchorId ? items.find((item) => item.anchorId === copiedAnchorId) ?? null : null;
  const recentTrailItems = recentAnchorTrail
    .filter((anchorId) => anchorId !== activeAnchorId)
    .map((anchorId) => items.find((item) => item.anchorId === anchorId) ?? null)
    .filter((item): item is ShortcutItem => Boolean(item));
  const pinnedItems = pinnedAnchorIds
    .map((anchorId) => items.find((item) => item.anchorId === anchorId) ?? null)
    .filter((item): item is ShortcutItem => Boolean(item));
  const fallbackItems = Array.from(new Map(
    [activeItem, resumeItem, ...pinnedItems, ...recentTrailItems]
      .filter((item): item is ShortcutItem => Boolean(item))
      .map((item) => [item.anchorId, item]),
  ).values()).slice(0, 4);
  const noMatchSuggestionItems = Array.from(new Map(
    [...fallbackItems, ...items]
      .filter((item): item is ShortcutItem => Boolean(item))
      .map((item) => [item.anchorId, item]),
  ).values()).slice(0, 4);
  const noMatchSuggestionQueries = buildQuickJumpNoMatchSuggestions({
    query: searchQuery,
    items,
    limit: 4,
  });
  const noMatchEnterAction = getQuickJumpNoMatchEnterAction({
    suggestionQueries: noMatchSuggestionQueries,
    suggestionItems: noMatchSuggestionItems,
  });
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
  const navigationBundleLabel =
    navigationBundleCopyState === 'done'
      ? 'Navigation bundle copied'
      : navigationBundleCopyState === 'error'
        ? 'Copy nav bundle failed'
        : 'Copy nav bundle';
  const rescueBundleLabel =
    rescueBundleCopyState === 'done'
      ? 'Rescue bundle copied'
      : rescueBundleCopyState === 'error'
        ? 'Copy rescue bundle failed'
        : 'Copy rescue bundle';
  const activeRouteBundleLabel =
    activeRouteBundleCopyState === 'done'
      ? 'Live route copied'
      : activeRouteBundleCopyState === 'error'
        ? 'Copy live route failed'
        : 'Copy live route';
  const filteredRouteLabel =
    filteredRouteCopyState === 'done'
      ? 'Route copied'
      : filteredRouteCopyState === 'error'
        ? 'Route copy failed'
        : 'Copy route context';

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
          aria-label="Copy a reusable navigation bundle with the current section, pinned sections, recent trail, and direct links (B)"
          title="Copy a reusable navigation bundle with the current section, pinned sections, recent trail, and direct links (B)"
          onClick={() => {
            void copyNavigationBundle({
              items,
              activeItem,
              resumeItem,
              pinnedItems,
              recentTrailItems,
            })
              .then(() => {
                setNavigationBundleCopyState('done');
                if (clearNavigationBundleCopyStateTimeoutRef.current !== null) {
                  window.clearTimeout(clearNavigationBundleCopyStateTimeoutRef.current);
                }
                clearNavigationBundleCopyStateTimeoutRef.current = window.setTimeout(() => {
                  setNavigationBundleCopyState('idle');
                }, 1800);
              })
              .catch(() => {
                setNavigationBundleCopyState('error');
                if (clearNavigationBundleCopyStateTimeoutRef.current !== null) {
                  window.clearTimeout(clearNavigationBundleCopyStateTimeoutRef.current);
                }
                clearNavigationBundleCopyStateTimeoutRef.current = window.setTimeout(() => {
                  setNavigationBundleCopyState('idle');
                }, 2200);
              });
          }}
          style={{ cursor: 'pointer' }}
        >
          {navigationBundleLabel}
        </button>
        <button
          type="button"
          className="pf-pill"
          aria-expanded={shortcutGuideOpen}
          aria-label={shortcutGuideOpen ? 'Hide shortcuts guide (?)' : 'Show shortcuts guide (?)'}
          title={shortcutGuideOpen ? 'Hide shortcuts guide (?)' : 'Show shortcuts guide (?)'}
          onClick={() => {
            setShortcutGuideOpen((current) => !current);
          }}
          style={{
            cursor: 'pointer',
            borderColor: shortcutGuideOpen ? 'var(--primary)' : undefined,
            color: shortcutGuideOpen ? 'var(--primary)' : undefined,
            background: shortcutGuideOpen ? 'rgba(255,255,255,.92)' : undefined,
          }}
        >
          {shortcutGuideOpen ? 'Hide shortcuts' : 'Shortcuts ?'}
        </button>
        <button
          type="button"
          className="pf-pill"
          aria-label="Reset saved navigation state (Shift+R)"
          title="Reset saved navigation state (Shift+R)"
          onClick={() => {
            clearStoredNavigationState();
            setResumeAnchorId(null);
            setPinnedAnchorIds([]);
            setRecentAnchorTrail([]);
            setSearchQuery('');
            setSelectedFilteredIndex(0);
            setShowAllFilteredResults(false);
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
            if (items[0]) {
              setActiveKey('Reset');
              setActiveAnchorId(items[0].anchorId);
              jumpToAnchor(items[0].anchorId);
              window.setTimeout(() => {
                setActiveKey((current) => (current === 'Reset' ? null : current));
              }, 1200);
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          Reset nav state
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
        {activeRouteContextItems.length > 0 ? (
          <div style={{ display: 'grid', gap: 6 }}>
            <div className="pf-dim" style={{ fontSize: 11 }}>
              Live route context: keep the current section plus the closest previous and next stops one tap away.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {activeRouteContextItems.map((item) => {
                const isCurrent = item.anchorId === activeItem?.anchorId;
                return (
                  <button
                    key={`active-route-${item.anchorId}`}
                    type="button"
                    className="pf-pill"
                    aria-current={isCurrent ? 'true' : undefined}
                    aria-label={`${isCurrent ? 'Current' : 'Jump to'} route context section ${item.label}`}
                    title={`${isCurrent ? 'Current' : 'Jump to'} route context section ${item.label}`}
                    onClick={() => {
                      setActiveKey(isCurrent ? 'context-current' : item.anchorId === previousItem?.anchorId ? 'context-prev' : 'context-next');
                      setActiveAnchorId(item.anchorId);
                      jumpToAnchor(item.anchorId);
                      window.setTimeout(() => {
                        setActiveKey((current) => (
                          current === 'context-current' || current === 'context-prev' || current === 'context-next'
                            ? null
                            : current
                        ));
                      }, 1200);
                    }}
                    style={{
                      cursor: 'pointer',
                      borderColor: isCurrent ? 'var(--primary)' : undefined,
                      color: isCurrent ? 'var(--primary)' : undefined,
                      background: isCurrent ? 'rgba(255,255,255,.92)' : undefined,
                    }}
                  >
                    {isCurrent
                      ? `Current · ${item.label}`
                      : item.anchorId === previousItem?.anchorId
                        ? `Prev route · ${item.label}`
                        : `Next route · ${item.label}`}
                  </button>
                );
              })}
              {activeItem ? (
                <button
                  type="button"
                  className="pf-pill"
                  aria-label={`Copy live route context for ${activeItem.label}`}
                  title={`Copy live route context for ${activeItem.label}`}
                  onClick={() => {
                    void copyRouteContextBundle({
                      query: '',
                      selectedItem: activeItem,
                      contextItems: activeRouteContextItems,
                    })
                      .then(() => {
                        setActiveRouteBundleCopyState('done');
                        if (clearActiveRouteBundleCopyStateTimeoutRef.current !== null) {
                          window.clearTimeout(clearActiveRouteBundleCopyStateTimeoutRef.current);
                        }
                        clearActiveRouteBundleCopyStateTimeoutRef.current = window.setTimeout(() => {
                          setActiveRouteBundleCopyState('idle');
                        }, 1600);
                      })
                      .catch(() => {
                        setActiveRouteBundleCopyState('error');
                        if (clearActiveRouteBundleCopyStateTimeoutRef.current !== null) {
                          window.clearTimeout(clearActiveRouteBundleCopyStateTimeoutRef.current);
                        }
                        clearActiveRouteBundleCopyStateTimeoutRef.current = window.setTimeout(() => {
                          setActiveRouteBundleCopyState('idle');
                        }, 2200);
                      });
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {activeRouteBundleLabel}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {shortcutGuideOpen ? (
          <div
            ref={shortcutGuidePanelRef}
            role="dialog"
            aria-label="Quick jump shortcuts guide"
            aria-modal="false"
            tabIndex={-1}
            style={{ display: 'grid', gap: 6 }}
          >
            <div className="pf-dim" style={{ fontSize: 11 }}>
              Shortcut guide: fast ways to move, filter, pin, resume, and share direct links without leaving the page.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {['? toggle guide', 'click outside close guide', '/ filter', '↑ / ↓ / PgUp / PgDn select', 'Home / End first-last filtered match', 'Enter jump', 'Cmd/Ctrl+Enter open selected', 'Alt+Enter copy selected', 'Esc clear or close', '[ ] / J K prev-next', 'Home / End section first-last', 'C copy current', 'O open current', 'B copy nav bundle', 'R resume', 'Shift+R reset nav state', 'F pin current', '1-4 pinned', '5-7 trail'].map((label) => (
                <span key={label} className="pf-pill">{label}</span>
              ))}
              <span className="pf-pill">Shift+C filtered bundle</span>
              <span className="pf-pill">Shift+P pinned bundle</span>
              <span className="pf-pill">Shift+T recent trail</span>
              <span className="pf-pill">Shift+L copy filtered view</span>
              <span className="pf-pill">Shift+O open filtered view</span>
              <span className="pf-pill">Shift+F pin filtered matches</span>
              <span className="pf-pill">. toggle full filtered list</span>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {items.map((item) => (
                <div
                  key={`guide-${item.anchorId}`}
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    padding: '8px 10px',
                    borderRadius: 14,
                    border: '2px solid rgba(15,23,42,0.12)',
                    background: 'rgba(255,255,255,.78)',
                  }}
                >
                  <button
                    type="button"
                    className="pf-pill"
                    onClick={() => {
                      setActiveKey(item.keyLabel);
                      setActiveAnchorId(item.anchorId);
                      jumpToAnchor(item.anchorId);
                      setShortcutGuideOpen(false);
                      window.setTimeout(() => {
                        setActiveKey((current) => (current === item.keyLabel ? null : current));
                      }, 1200);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    Alt+{item.keyLabel} · {item.label}
                  </button>
                  <span className="pf-pill">#{item.anchorId}</span>
                  <button
                    type="button"
                    className="pf-pill"
                    onClick={() => openAnchorLink(item.anchorId)}
                    style={{ cursor: 'pointer' }}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    className="pf-pill"
                    onClick={() => {
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
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="pf-pill"
                onClick={() => {
                  void copyShortcutGuide(items)
                    .then(() => {
                      setShortcutGuideCopyState('done');
                      if (clearShortcutGuideCopyStateTimeoutRef.current !== null) {
                        window.clearTimeout(clearShortcutGuideCopyStateTimeoutRef.current);
                      }
                      clearShortcutGuideCopyStateTimeoutRef.current = window.setTimeout(() => {
                        setShortcutGuideCopyState('idle');
                      }, 1800);
                    })
                    .catch(() => {
                      setShortcutGuideCopyState('error');
                      if (clearShortcutGuideCopyStateTimeoutRef.current !== null) {
                        window.clearTimeout(clearShortcutGuideCopyStateTimeoutRef.current);
                      }
                      clearShortcutGuideCopyStateTimeoutRef.current = window.setTimeout(() => {
                        setShortcutGuideCopyState('idle');
                      }, 2200);
                    });
                }}
                style={{ cursor: 'pointer' }}
              >
                {shortcutGuideCopyState === 'done'
                  ? 'Guide copied'
                  : shortcutGuideCopyState === 'error'
                    ? 'Copy guide failed'
                    : 'Copy guide'}
              </button>
              <button
                type="button"
                className="pf-pill"
                onClick={() => setShortcutGuideOpen(false)}
                style={{ cursor: 'pointer' }}
              >
                Close guide
              </button>
            </div>
          </div>
        ) : null}
        {pinnedItems.length > 0 ? (
          <div style={{ display: 'grid', gap: 6 }}>
            <div className="pf-dim" style={{ fontSize: 11 }}>
              Pinboard: keep up to four favorite sections ready for one-tap jumps. Press F to pin or unpin the section currently in view.
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {pinnedItems.map((item, index) => {
                const isActive = activeAnchorId === item.anchorId;
                return (
                  <div
                    key={`pinned-${item.anchorId}`}
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <button
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
                    <span className="pf-pill" aria-live="polite">
                      #{item.anchorId}
                    </span>
                    <button
                      type="button"
                      className="pf-pill"
                      aria-label={`Open pinned section ${item.label} in a new tab`}
                      title={`Open pinned section ${item.label} in a new tab`}
                      onClick={() => {
                        openAnchorLink(item.anchorId);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      className="pf-pill"
                      aria-label={`Copy pinned section link for ${item.label}`}
                      title={`Copy pinned section link for ${item.label}`}
                      onClick={() => {
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
                    <button
                      type="button"
                      className="pf-pill"
                      aria-label={`Remove pinned section ${item.label}`}
                      title={`Remove pinned section ${item.label}`}
                      onClick={() => {
                        setPinnedAnchorIds((current) => {
                          const nextPinned = current.filter((anchorId) => anchorId !== item.anchorId);
                          savePinnedSections(nextPinned);
                          return nextPinned;
                        });
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="pf-pill"
                  aria-label={`Copy pinned section bundle for ${pinnedItems.length} sections`}
                  title={`Copy pinned section bundle for ${pinnedItems.length} sections (Shift+P)`}
                  onClick={() => {
                    void copyPinnedSectionsBundle(pinnedItems)
                      .then(() => {
                        setPinnedBundleCopyState('done');
                        if (clearPinnedBundleCopyStateTimeoutRef.current !== null) {
                          window.clearTimeout(clearPinnedBundleCopyStateTimeoutRef.current);
                        }
                        clearPinnedBundleCopyStateTimeoutRef.current = window.setTimeout(() => {
                          setPinnedBundleCopyState('idle');
                        }, 1800);
                      })
                      .catch(() => {
                        setPinnedBundleCopyState('error');
                        if (clearPinnedBundleCopyStateTimeoutRef.current !== null) {
                          window.clearTimeout(clearPinnedBundleCopyStateTimeoutRef.current);
                        }
                        clearPinnedBundleCopyStateTimeoutRef.current = window.setTimeout(() => {
                          setPinnedBundleCopyState('idle');
                        }, 2200);
                      });
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {pinnedBundleCopyState === 'done'
                    ? `Copied ${pinnedItems.length} pins`
                    : pinnedBundleCopyState === 'error'
                      ? 'Copy failed'
                      : `Copy ${pinnedItems.length} pins`}
                </button>
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
          </div>
        ) : null}
        {recentTrailItems.length > 0 ? (
          <div style={{ display: 'grid', gap: 6 }}>
            <div className="pf-dim" style={{ fontSize: 11 }}>
              Recent trail: jump back into the last few sections you touched before the current one without losing the filtered route.
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {recentTrailItems.map((item, index) => {
                const isActive = activeAnchorId === item.anchorId;
                return (
                  <div
                    key={`trail-${item.anchorId}`}
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <button
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
                    <span className="pf-pill" aria-live="polite">
                      #{item.anchorId}
                    </span>
                    <button
                      type="button"
                      className="pf-pill"
                      aria-label={`Open recent section ${item.label} in a new tab`}
                      title={`Open recent section ${item.label} in a new tab`}
                      onClick={() => {
                        openAnchorLink(item.anchorId);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      className="pf-pill"
                      aria-label={`Copy recent section link for ${item.label}`}
                      title={`Copy recent section link for ${item.label}`}
                      onClick={() => {
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
                    <button
                      type="button"
                      className="pf-pill"
                      aria-label={`Remove recent section ${item.label} from the trail`}
                      title={`Remove recent section ${item.label} from the trail`}
                      onClick={() => {
                        setRecentAnchorTrail((current) => {
                          const nextTrail = current.filter((anchorId) => anchorId !== item.anchorId);
                          saveRecentSectionTrail(nextTrail);
                          return nextTrail;
                        });
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="pf-pill"
                  aria-label={`Copy recent trail bundle for ${recentTrailItems.length} sections`}
                  title={`Copy recent trail bundle for ${recentTrailItems.length} sections (Shift+T)`}
                  onClick={() => {
                    void copyRecentTrailBundle(recentTrailItems)
                      .then(() => {
                        setRecentTrailBundleCopyState('done');
                        if (clearRecentTrailBundleCopyStateTimeoutRef.current !== null) {
                          window.clearTimeout(clearRecentTrailBundleCopyStateTimeoutRef.current);
                        }
                        clearRecentTrailBundleCopyStateTimeoutRef.current = window.setTimeout(() => {
                          setRecentTrailBundleCopyState('idle');
                        }, 1800);
                      })
                      .catch(() => {
                        setRecentTrailBundleCopyState('error');
                        if (clearRecentTrailBundleCopyStateTimeoutRef.current !== null) {
                          window.clearTimeout(clearRecentTrailBundleCopyStateTimeoutRef.current);
                        }
                        clearRecentTrailBundleCopyStateTimeoutRef.current = window.setTimeout(() => {
                          setRecentTrailBundleCopyState('idle');
                        }, 2200);
                      });
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {recentTrailBundleCopyState === 'done'
                    ? `Copied ${recentTrailItems.length} trail items`
                    : recentTrailBundleCopyState === 'error'
                      ? 'Copy failed'
                      : `Copy ${recentTrailItems.length} trail items`}
                </button>
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
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
              if (event.key !== 'Enter') {
                return;
              }

              if (selectedFilteredItem) {
                event.preventDefault();

                if (event.metaKey || event.ctrlKey) {
                  openAnchorLink(selectedFilteredItem.anchorId);
                  return;
                }

                if (event.altKey) {
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
                  return;
                }

                setActiveKey('/');
                setActiveAnchorId(selectedFilteredItem.anchorId);
                jumpToAnchor(selectedFilteredItem.anchorId);
                window.setTimeout(() => {
                  setActiveKey((current) => (current === '/' ? null : current));
                }, 1200);
                return;
              }

              if (!normalizedSearchQuery || filteredItems.length > 0 || !noMatchEnterAction) {
                return;
              }

              event.preventDefault();

              if (noMatchEnterAction.type === 'query') {
                setSearchQuery(noMatchEnterAction.query);
                setSelectedFilteredIndex(0);
                return;
              }

              setSearchQuery('');
              setSelectedFilteredIndex(0);
              setShowAllFilteredResults(false);
              searchInputRef.current?.blur();
              setActiveKey('/');
              setActiveAnchorId(noMatchEnterAction.anchorId);
              jumpToAnchor(noMatchEnterAction.anchorId);
              window.setTimeout(() => {
                setActiveKey((current) => (current === '/' ? null : current));
              }, 1200);
            }}
            placeholder="Filter sections (/ to focus, ↑/↓ or PgUp/PgDn choose, Enter to jump)"
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
              <span className="pf-pill" aria-live="polite">
                Shortcut Alt+{selectedFilteredItem.keyLabel} · #{selectedFilteredItem.anchorId}
              </span>
              <span className="pf-pill" aria-live="polite">
                Filter nav ↑/↓ · PgUp/PgDn · Home/End{filteredItems.length > 5 ? ' · . list toggle' : ''}
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
                aria-label={`${pinnedAnchorIds.includes(selectedFilteredItem.anchorId) ? 'Unpin' : 'Pin'} selected match ${selectedFilteredItem.label}`}
                title={`${pinnedAnchorIds.includes(selectedFilteredItem.anchorId) ? 'Unpin' : 'Pin'} selected match ${selectedFilteredItem.label}`}
                onClick={() => {
                  togglePinnedSection(selectedFilteredItem.anchorId);
                }}
                style={{
                  cursor: 'pointer',
                  borderColor: pinnedAnchorIds.includes(selectedFilteredItem.anchorId) ? 'var(--primary)' : undefined,
                  color: pinnedAnchorIds.includes(selectedFilteredItem.anchorId) ? 'var(--primary)' : undefined,
                  background: pinnedAnchorIds.includes(selectedFilteredItem.anchorId) ? 'rgba(255,255,255,.92)' : undefined,
                }}
              >
                {pinnedAnchorIds.includes(selectedFilteredItem.anchorId)
                  ? `Unpin selected · ${selectedFilteredItem.label}`
                  : `Pin selected · ${selectedFilteredItem.label}`}
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

              <button
                type="button"
                className="pf-pill"
                aria-label={`${everyFilteredItemPinned ? 'Unpin' : 'Pin'} all ${filteredItems.length} filtered matches`}
                title={`${everyFilteredItemPinned ? 'Unpin' : 'Pin'} all ${filteredItems.length} filtered matches (Shift+F while the filter is focused)`}
                onClick={() => {
                  setPinnedAnchorIds((current) => {
                    const nextPinned = everyFilteredItemPinned
                      ? current.filter((anchorId) => !filteredItems.some((item) => item.anchorId === anchorId))
                      : buildBulkPinnedAnchorIds({
                          currentPinnedAnchorIds: current,
                          filteredAnchorIds: filteredItems.map((item) => item.anchorId),
                          selectedAnchorId: selectedFilteredItem?.anchorId ?? null,
                        });
                    savePinnedSections(nextPinned);
                    return nextPinned;
                  });
                }}
                style={{
                  cursor: 'pointer',
                  borderColor: everyFilteredItemPinned ? 'var(--primary)' : undefined,
                  color: everyFilteredItemPinned ? 'var(--primary)' : undefined,
                  background: everyFilteredItemPinned ? 'rgba(255,255,255,.92)' : undefined,
                }}
              >
                {everyFilteredItemPinned
                  ? `Unpin ${filteredItems.length} matches`
                  : `Pin ${filteredItems.length} matches`}
              </button>
              {!everyFilteredItemPinned ? (
                <span className="pf-pill" aria-live="polite">
                  Pin preview {filteredPinPreview.length}/{MAX_PINNED_SECTIONS}
                  {selectedFilteredItem ? ` · keeps ${selectedFilteredItem.label}` : ''}
                  {willTrimFilteredPins ? ' · first 4 only' : ''}
                </span>
              ) : null}
              <button
                type="button"
                className="pf-pill"
                aria-label={`Copy filtered result bundle for ${filteredItems.length} matches`}
                title={`Copy filtered result bundle for ${filteredItems.length} matches (Shift+C while the filter is focused)`}
                onClick={() => {
                  void copyFilteredResultsBundle({
                    query: searchQuery.trim(),
                    items: filteredItems,
                  })
                    .then(() => {
                      setFilteredResultsCopyState('done');
                      if (clearFilteredResultsCopyStateTimeoutRef.current !== null) {
                        window.clearTimeout(clearFilteredResultsCopyStateTimeoutRef.current);
                      }
                      clearFilteredResultsCopyStateTimeoutRef.current = window.setTimeout(() => {
                        setFilteredResultsCopyState('idle');
                      }, 1600);
                    })
                    .catch(() => {
                      setFilteredResultsCopyState('error');
                      if (clearFilteredResultsCopyStateTimeoutRef.current !== null) {
                        window.clearTimeout(clearFilteredResultsCopyStateTimeoutRef.current);
                      }
                      clearFilteredResultsCopyStateTimeoutRef.current = window.setTimeout(() => {
                        setFilteredResultsCopyState('idle');
                      }, 2200);
                    });
                }}
                style={{ cursor: 'pointer' }}
              >
                {filteredResultsCopyState === 'done'
                  ? `Copied ${filteredItems.length} matches`
                  : filteredResultsCopyState === 'error'
                    ? 'Copy failed'
                    : `Copy ${filteredItems.length} matches`}
              </button>
              {selectedFilteredPrevItem || selectedFilteredNextItem ? (
                <>
                  <span className="pf-pill" aria-live="polite">
                    Route context
                    {selectedFilteredPrevItem ? ` · prev ${selectedFilteredPrevItem.label}` : ''}
                    {selectedFilteredNextItem ? ` · next ${selectedFilteredNextItem.label}` : ''}
                  </span>
                  <button
                    type="button"
                    className="pf-pill"
                    aria-label={`Copy route context for ${selectedFilteredItem.label}`}
                    title={`Copy route context for ${selectedFilteredItem.label}`}
                    onClick={() => {
                      void copyRouteContextBundle({
                        query: searchQuery.trim(),
                        selectedItem: selectedFilteredItem,
                        contextItems: selectedFilteredRouteContextItems,
                      })
                        .then(() => {
                          setFilteredRouteCopyState('done');
                          if (clearFilteredRouteCopyStateTimeoutRef.current !== null) {
                            window.clearTimeout(clearFilteredRouteCopyStateTimeoutRef.current);
                          }
                          clearFilteredRouteCopyStateTimeoutRef.current = window.setTimeout(() => {
                            setFilteredRouteCopyState('idle');
                          }, 1600);
                        })
                        .catch(() => {
                          setFilteredRouteCopyState('error');
                          if (clearFilteredRouteCopyStateTimeoutRef.current !== null) {
                            window.clearTimeout(clearFilteredRouteCopyStateTimeoutRef.current);
                          }
                          clearFilteredRouteCopyStateTimeoutRef.current = window.setTimeout(() => {
                            setFilteredRouteCopyState('idle');
                          }, 2200);
                        });
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {filteredRouteLabel}
                  </button>
                  {selectedFilteredPrevItem ? (
                    <button
                      type="button"
                      className="pf-pill"
                      aria-label={`Jump to the section before ${selectedFilteredItem.label}`}
                      title={`Jump to the section before ${selectedFilteredItem.label}`}
                      onClick={() => {
                        setActiveKey('context-prev');
                        setActiveAnchorId(selectedFilteredPrevItem.anchorId);
                        jumpToAnchor(selectedFilteredPrevItem.anchorId);
                        window.setTimeout(() => {
                          setActiveKey((current) => (current === 'context-prev' ? null : current));
                        }, 1200);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      Prev in route → {selectedFilteredPrevItem.label}
                    </button>
                  ) : null}
                  {selectedFilteredNextItem ? (
                    <button
                      type="button"
                      className="pf-pill"
                      aria-label={`Jump to the section after ${selectedFilteredItem.label}`}
                      title={`Jump to the section after ${selectedFilteredItem.label}`}
                      onClick={() => {
                        setActiveKey('context-next');
                        setActiveAnchorId(selectedFilteredNextItem.anchorId);
                        jumpToAnchor(selectedFilteredNextItem.anchorId);
                        window.setTimeout(() => {
                          setActiveKey((current) => (current === 'context-next' ? null : current));
                        }, 1200);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      Next in route → {selectedFilteredNextItem.label}
                    </button>
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}
          {searchQuery ? (
            <>
              <button
                type="button"
                className="pf-pill"
                onClick={() => {
                  void copyFilteredViewLink(searchQuery, selectedFilteredItem?.anchorId ?? activeAnchorId)
                    .then(() => {
                      setFilteredViewLinkCopyState('done');
                      if (clearFilteredViewLinkCopyStateTimeoutRef.current !== null) {
                        window.clearTimeout(clearFilteredViewLinkCopyStateTimeoutRef.current);
                      }
                      clearFilteredViewLinkCopyStateTimeoutRef.current = window.setTimeout(() => {
                        setFilteredViewLinkCopyState('idle');
                      }, 1600);
                    })
                    .catch(() => {
                      setFilteredViewLinkCopyState('error');
                      if (clearFilteredViewLinkCopyStateTimeoutRef.current !== null) {
                        window.clearTimeout(clearFilteredViewLinkCopyStateTimeoutRef.current);
                      }
                      clearFilteredViewLinkCopyStateTimeoutRef.current = window.setTimeout(() => {
                        setFilteredViewLinkCopyState('idle');
                      }, 2200);
                    });
                }}
                style={{ cursor: 'pointer' }}
                aria-label="Copy the current filtered view link"
                title="Copy the current filtered view link (Shift+L while the filter is focused)"
              >
                {filteredViewLinkCopyState === 'done'
                  ? 'View link copied'
                  : filteredViewLinkCopyState === 'error'
                    ? 'View link failed'
                    : 'Copy filtered view (Shift+L)'}
              </button>
              <button
                type="button"
                className="pf-pill"
                onClick={() => {
                  openFilteredViewLink(searchQuery, selectedFilteredItem?.anchorId ?? activeAnchorId);
                }}
                style={{ cursor: 'pointer' }}
                aria-label="Open the current filtered view in a new tab"
                title="Open the current filtered view in a new tab (Shift+O while the filter is focused)"
              >
                Open filtered view (Shift+O)
              </button>
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
            </>
          ) : null}
        </div>
        {normalizedSearchQuery && filteredItems.length > 0 ? (
          <div style={{ display: 'grid', gap: 6 }}>
            <div className="pf-dim" style={{ fontSize: 11 }}>
              Filtered route: click any result to jump, or use the side actions to open/copy the direct section link. Enter jumps to the selected result, Cmd/Ctrl+Enter opens it in a new tab, and Alt+Enter copies the direct link without leaving the filter. Multi-word queries and abbreviations like &quot;desk watch&quot;, &quot;deskwatch&quot;, &quot;op queue&quot;, or &quot;mf&quot; now work too. Use the filtered bundle copy to share the whole operator path at once.
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {visibleFilteredMatches.map(({ match, index }) => {
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
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="pf-dim" style={{ fontSize: 11 }}>
                  {showAllFilteredResults
                    ? `Showing all ${filteredItems.length} matches. Use ↑ / ↓ to move through the full result set, then Enter to jump, or press . to collapse back to the top results.`
                    : 'Showing top 5 matches. Use ↑ / ↓ to move through the full result set, then Enter to jump, or press . to expand the full list.'}
                </div>
                <button
                  type="button"
                  className="pf-pill"
                  onClick={() => setShowAllFilteredResults((current) => !current)}
                  style={{ cursor: 'pointer' }}
                  aria-label={showAllFilteredResults ? 'Collapse filtered matches to the top five results' : 'Show all filtered matches'}
                  title={showAllFilteredResults ? 'Collapse filtered matches to the top five results' : 'Show all filtered matches'}
                >
                  {showAllFilteredResults ? 'Show top 5' : `Show all ${filteredItems.length}`}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        {normalizedSearchQuery && filteredItems.length === 0 ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="pf-dim" style={{ fontSize: 11 }}>
              No section matches that filter yet. Try a tighter rescue query like market, desk, operator, or leaderboard.
              {noMatchEnterAction?.type === 'query' ? ` Press Enter to try ${noMatchEnterAction.query}.` : noMatchEnterAction?.type === 'item' ? ' Press Enter to jump to the top rescue section.' : ''}
              {fallbackItems.length ? ' You can also jump back into your live, pinned, or recent sections below.' : ''}
            </div>
            {noMatchEnterAction ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="pf-pill"
                  onClick={() => {
                    if (noMatchEnterAction.type === 'query') {
                      setSearchQuery(noMatchEnterAction.query);
                      setSelectedFilteredIndex(0);
                      searchInputRef.current?.focus();
                      return;
                    }

                    setSearchQuery('');
                    setSelectedFilteredIndex(0);
                    setShowAllFilteredResults(false);
                    searchInputRef.current?.blur();
                    setActiveKey('/');
                    setActiveAnchorId(noMatchEnterAction.anchorId);
                    jumpToAnchor(noMatchEnterAction.anchorId);
                    window.setTimeout(() => {
                      setActiveKey((current) => (current === '/' ? null : current));
                    }, 1200);
                  }}
                  style={{ cursor: 'pointer', borderColor: 'var(--primary)', color: 'var(--primary)', background: 'rgba(255,255,255,.92)' }}
                  aria-label={noMatchEnterAction.type === 'query' ? `Try rescue query ${noMatchEnterAction.query}` : 'Jump to the top rescue section'}
                  title={noMatchEnterAction.type === 'query' ? `Try rescue query ${noMatchEnterAction.query}` : 'Jump to the top rescue section'}
                >
                  {noMatchEnterAction.type === 'query'
                    ? `Try rescue query → ${noMatchEnterAction.query}`
                    : `Jump to rescue section → ${noMatchEnterAction.anchorId}`}
                </button>
                <span className="pf-pill" aria-live="polite">
                  Enter action · {noMatchEnterAction.type === 'query' ? 'apply rescue query' : 'jump to rescue section'}
                </span>
              </div>
            ) : null}
            {noMatchSuggestionQueries.length ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="pf-dim" style={{ fontSize: 11 }}>Try query:</span>
                {noMatchSuggestionQueries.map((query) => (
                  <button
                    key={`no-match-query-${query}`}
                    type="button"
                    className="pf-pill"
                    aria-label={`Filter by ${query}`}
                    title={`Filter by ${query}`}
                    onClick={() => {
                      setSearchQuery(query);
                      setSelectedFilteredIndex(0);
                      searchInputRef.current?.focus();
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {query}
                  </button>
                ))}
              </div>
            ) : null}
            {noMatchSuggestionItems.length ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="pf-dim" style={{ fontSize: 11 }}>Or jump to:</span>
                {noMatchSuggestionItems.map((item) => (
                  <button
                    key={`no-match-suggestion-${item.anchorId}`}
                    type="button"
                    className="pf-pill"
                    aria-label={`Jump to ${item.label}`}
                    title={`Jump to ${item.label}`}
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedFilteredIndex(0);
                      setShowAllFilteredResults(false);
                      searchInputRef.current?.blur();
                      setActiveKey('/');
                      setActiveAnchorId(item.anchorId);
                      jumpToAnchor(item.anchorId);
                      window.setTimeout(() => {
                        setActiveKey((current) => (current === '/' ? null : current));
                      }, 1200);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="pf-pill"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedFilteredIndex(0);
                  setShowAllFilteredResults(false);
                  searchInputRef.current?.blur();
                }}
                style={{ cursor: 'pointer' }}
                aria-label="Clear filter and return to full section list"
                title="Clear filter and return to full section list"
              >
                Clear filter
              </button>
              <span className="pf-pill" aria-live="polite">
                Showing all sections now
              </span>
            </div>
            {showResumeButton && resumeItem ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="pf-pill"
                  aria-label={`Resume ${resumeItem.label}`}
                  title={`Resume ${resumeItem.label} from your last stop (R)`}
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
                  Resume last stop (R) → {resumeItem.label}
                </button>
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
                  Open last stop ↗
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
                          setCopiedAnchorId((current) => (current === resumeItem.anchorId ? null : current));
                        }, 1800);
                      })
                      .catch(() => {
                        setCopiedAnchorId(resumeItem.anchorId);
                        setCopyState('error');
                        if (clearCopyStateTimeoutRef.current !== null) {
                          window.clearTimeout(clearCopyStateTimeoutRef.current);
                        }
                        clearCopyStateTimeoutRef.current = window.setTimeout(() => {
                          setCopyState('idle');
                          setCopiedAnchorId((current) => (current === resumeItem.anchorId ? null : current));
                        }, 2200);
                      });
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {copiedAnchorId === resumeItem.anchorId ? 'Copied last stop link' : 'Copy last stop link'}
                </button>
              </div>
            ) : null}
            {fallbackItems.length ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {fallbackItems.map((item) => {
                    const isLive = activeAnchorId === item.anchorId;
                    const isPinned = pinnedAnchorIds.includes(item.anchorId);
                    const isResume = resumeAnchorId === item.anchorId;
                    const isRecent = recentTrailItems.some((trailItem) => trailItem.anchorId === item.anchorId);
                    const badges = [
                      isLive ? 'live' : null,
                      isPinned ? 'pinned' : null,
                      isResume ? 'last stop' : null,
                      isRecent ? 'recent' : null,
                    ].filter(Boolean).join(' · ');

                    return (
                      <button
                        key={`fallback-${item.anchorId}`}
                        type="button"
                        className="pf-pill"
                        onClick={() => {
                          setActiveKey('/');
                          setActiveAnchorId(item.anchorId);
                          jumpToAnchor(item.anchorId);
                          window.setTimeout(() => {
                            setActiveKey((current) => (current === '/' ? null : current));
                          }, 1200);
                        }}
                        aria-label={`Jump to fallback section ${item.label}`}
                        title={`Jump to ${item.label}${badges ? ` · ${badges}` : ''}`}
                        style={{
                          cursor: 'pointer',
                          borderColor: isLive ? 'var(--primary)' : undefined,
                          color: isLive ? 'var(--primary)' : undefined,
                          background: isLive ? 'rgba(255,255,255,.92)' : undefined,
                        }}
                      >
                        Rescue → {item.label}{badges ? ` · ${badges}` : ''}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="pf-pill"
                    onClick={() => {
                      void copyRescueBundle({
                        query: searchQuery.trim(),
                        activeItem,
                        fallbackItems,
                      })
                        .then(() => {
                          setRescueBundleCopyState('done');
                          if (clearRescueBundleCopyStateTimeoutRef.current !== null) {
                            window.clearTimeout(clearRescueBundleCopyStateTimeoutRef.current);
                          }
                          clearRescueBundleCopyStateTimeoutRef.current = window.setTimeout(() => {
                            setRescueBundleCopyState('idle');
                          }, 1800);
                        })
                        .catch(() => {
                          setRescueBundleCopyState('error');
                          if (clearRescueBundleCopyStateTimeoutRef.current !== null) {
                            window.clearTimeout(clearRescueBundleCopyStateTimeoutRef.current);
                          }
                          clearRescueBundleCopyStateTimeoutRef.current = window.setTimeout(() => {
                            setRescueBundleCopyState('idle');
                          }, 2200);
                        });
                    }}
                    style={{ cursor: 'pointer' }}
                    aria-label="Copy rescue bundle with the current section and suggested recovery jumps"
                    title="Copy rescue bundle with the current section and suggested recovery jumps"
                  >
                    {rescueBundleLabel}
                  </button>
                  <span className="pf-pill">Recovery set {fallbackItems.length}</span>
                </div>
              </div>
            ) : null}
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
