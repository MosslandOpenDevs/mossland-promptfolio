export const MAX_PINNED_SECTIONS = 4;
const MATCH_FIELD_PRIORITY = ['label', 'aliases', 'section id', 'shortcut'] as const;
const QUICK_JUMP_SUGGESTION_STOP_WORDS = new Set([
  'and',
  'for',
  'the',
  'with',
  'from',
  'into',
  'your',
  'view',
  'page',
  'section',
]);

function getBestMatchFieldScore(matchedFields: string[]) {
  if (!matchedFields.length) {
    return Number.POSITIVE_INFINITY;
  }

  let bestScore = Number.POSITIVE_INFINITY;
  for (const field of matchedFields) {
    const score = MATCH_FIELD_PRIORITY.indexOf(field as (typeof MATCH_FIELD_PRIORITY)[number]);
    if (score >= 0 && score < bestScore) {
      bestScore = score;
    }
  }

  return bestScore;
}

export function getQuickJumpRelevanceScore(params: {
  normalizedSearchQuery: string;
  haystacks: string[];
}) {
  const query = params.normalizedSearchQuery.trim();
  if (!query || !params.haystacks.length) {
    return Number.POSITIVE_INFINITY;
  }

  let bestScore = Number.POSITIVE_INFINITY;
  for (const haystack of params.haystacks) {
    if (!haystack) {
      continue;
    }

    if (haystack === query) {
      bestScore = Math.min(bestScore, 0);
      continue;
    }

    if (haystack.startsWith(query)) {
      bestScore = Math.min(bestScore, 1);
      continue;
    }

    if (haystack.split(/\s+/).some((token) => token.startsWith(query))) {
      bestScore = Math.min(bestScore, 2);
      continue;
    }

    if (haystack.includes(query)) {
      bestScore = Math.min(bestScore, 3);
    }
  }

  return bestScore;
}

export function sortQuickJumpItemMatches<T extends { item: { anchorId: string }; matchedFields: string[]; relevanceScore?: number }>(params: {
  matches: T[];
  anchorIdsInRouteOrder: string[];
}) {
  const anchorOrder = new Map(params.anchorIdsInRouteOrder.map((anchorId, index) => [anchorId, index]));

  return [...params.matches].sort((left, right) => {
    const leftRelevanceScore = left.relevanceScore ?? Number.POSITIVE_INFINITY;
    const rightRelevanceScore = right.relevanceScore ?? Number.POSITIVE_INFINITY;
    if (leftRelevanceScore !== rightRelevanceScore) {
      return leftRelevanceScore - rightRelevanceScore;
    }

    const leftBestFieldScore = getBestMatchFieldScore(left.matchedFields);
    const rightBestFieldScore = getBestMatchFieldScore(right.matchedFields);
    if (leftBestFieldScore !== rightBestFieldScore) {
      return leftBestFieldScore - rightBestFieldScore;
    }

    if (left.matchedFields.length !== right.matchedFields.length) {
      return right.matchedFields.length - left.matchedFields.length;
    }

    const leftOrder = anchorOrder.get(left.item.anchorId) ?? Number.POSITIVE_INFINITY;
    const rightOrder = anchorOrder.get(right.item.anchorId) ?? Number.POSITIVE_INFINITY;
    return leftOrder - rightOrder;
  });
}

export function buildBulkPinnedAnchorIds(params: {
  currentPinnedAnchorIds: string[];
  filteredAnchorIds: string[];
  selectedAnchorId?: string | null;
  maxPinnedSections?: number;
}) {
  const maxPinnedSections = params.maxPinnedSections ?? MAX_PINNED_SECTIONS;
  const prioritizedFilteredAnchorIds = [
    params.selectedAnchorId ?? null,
    ...params.filteredAnchorIds,
  ].filter((anchorId): anchorId is string => Boolean(anchorId));

  return Array.from(
    new Set([
      ...prioritizedFilteredAnchorIds,
      ...params.currentPinnedAnchorIds.filter((anchorId) => !params.filteredAnchorIds.includes(anchorId)),
    ])
  ).slice(0, maxPinnedSections);
}

export function buildRouteContextAnchorIds(params: {
  anchorIds: string[];
  selectedAnchorId?: string | null;
  radius?: number;
}) {
  const radius = Math.max(0, Math.floor(params.radius ?? 1));
  const selectedAnchorId = params.selectedAnchorId ?? null;

  if (!selectedAnchorId) {
    return [] as string[];
  }

  const selectedIndex = params.anchorIds.findIndex((anchorId) => anchorId === selectedAnchorId);
  if (selectedIndex < 0) {
    return [] as string[];
  }

  const startIndex = Math.max(0, selectedIndex - radius);
  const endIndex = Math.min(params.anchorIds.length - 1, selectedIndex + radius);

  return params.anchorIds.slice(startIndex, endIndex + 1);
}

export function getQuickJumpSelectedIndex(params: {
  anchorIds: string[];
  selectedAnchorId?: string | null;
  fallbackIndex?: number;
}) {
  if (!params.anchorIds.length) {
    return 0;
  }

  const fallbackIndex = Math.min(Math.max(0, Math.floor(params.fallbackIndex ?? 0)), params.anchorIds.length - 1);
  const selectedAnchorId = params.selectedAnchorId ?? null;

  if (!selectedAnchorId) {
    return fallbackIndex;
  }

  const selectedIndex = params.anchorIds.findIndex((anchorId) => anchorId === selectedAnchorId);
  return selectedIndex >= 0 ? selectedIndex : fallbackIndex;
}

export function getQuickJumpFilteredSelectionIndex(params: {
  anchorIds: string[];
  selectedAnchorId?: string | null;
  currentQuery: string;
  previousQuery: string;
  previousIndex: number;
}) {
  const queryChanged = params.currentQuery !== params.previousQuery;

  return getQuickJumpSelectedIndex({
    anchorIds: params.anchorIds,
    selectedAnchorId: params.selectedAnchorId,
    fallbackIndex: queryChanged ? 0 : params.previousIndex,
  });
}

export function buildVisibleQuickJumpMatchIndexes(params: {
  totalMatches: number;
  selectedIndex: number;
  collapsedLimit?: number;
}) {
  const totalMatches = Math.max(0, Math.floor(params.totalMatches));
  const collapsedLimit = Math.max(1, Math.floor(params.collapsedLimit ?? 5));

  if (totalMatches === 0) {
    return [] as number[];
  }

  if (totalMatches <= collapsedLimit) {
    return Array.from({ length: totalMatches }, (_, index) => index);
  }

  const clampedSelectedIndex = Math.min(Math.max(0, Math.floor(params.selectedIndex)), totalMatches - 1);
  const maxStartIndex = totalMatches - collapsedLimit;
  const idealStartIndex = clampedSelectedIndex - Math.floor(collapsedLimit / 2);
  const startIndex = Math.min(Math.max(0, idealStartIndex), maxStartIndex);

  return Array.from({ length: collapsedLimit }, (_, index) => startIndex + index);
}

function normalizeQuickJumpSuggestionToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokenizeQuickJumpSuggestionValue(value: string) {
  return normalizeQuickJumpSuggestionToken(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !QUICK_JUMP_SUGGESTION_STOP_WORDS.has(token));
}

function buildQuickJumpSuggestionCandidates(item: {
  label: string;
  anchorId: string;
  keyLabel: string;
}) {
  const labelTokens = tokenizeQuickJumpSuggestionValue(item.label);
  const anchorTokens = tokenizeQuickJumpSuggestionValue(item.anchorId);
  const collapsedLabel = labelTokens.join('');
  const collapsedAnchor = anchorTokens.join('');
  const acronym = labelTokens.map((token) => token[0]).join('');

  return Array.from(new Set([
    ...labelTokens,
    ...anchorTokens,
    collapsedLabel,
    collapsedAnchor,
    acronym.length >= 2 ? acronym : '',
    item.keyLabel.toLowerCase(),
  ].filter((token) => token.length >= 2)));
}

export function buildQuickJumpNoMatchSuggestions(params: {
  query: string;
  items: Array<{ label: string; anchorId: string; keyLabel: string }>;
  limit?: number;
}) {
  const normalizedQuery = normalizeQuickJumpSuggestionToken(params.query).replace(/\s+/g, '');
  const limit = Math.max(1, Math.floor(params.limit ?? 4));

  const suggestionScores = new Map<string, number>();

  for (const item of params.items) {
    for (const candidate of buildQuickJumpSuggestionCandidates(item)) {
      const collapsedCandidate = candidate.replace(/\s+/g, '');
      if (!collapsedCandidate) {
        continue;
      }

      let score = 4;
      if (!normalizedQuery) {
        score = collapsedCandidate.length <= 8 ? 1 : 2;
      } else if (collapsedCandidate === normalizedQuery) {
        score = 0;
      } else if (collapsedCandidate.startsWith(normalizedQuery) || normalizedQuery.startsWith(collapsedCandidate)) {
        score = 1;
      } else if (collapsedCandidate.includes(normalizedQuery) || normalizedQuery.includes(collapsedCandidate)) {
        score = 2;
      } else if (collapsedCandidate[0] === normalizedQuery[0]) {
        score = 3;
      }

      const currentBest = suggestionScores.get(candidate) ?? Number.POSITIVE_INFINITY;
      if (score < currentBest) {
        suggestionScores.set(candidate, score);
      }
    }
  }

  return [...suggestionScores.entries()]
    .sort((left, right) => {
      if (left[1] !== right[1]) {
        return left[1] - right[1];
      }
      if (left[0].length !== right[0].length) {
        return left[0].length - right[0].length;
      }
      return left[0].localeCompare(right[0]);
    })
    .map(([candidate]) => candidate)
    .slice(0, limit);
}

export function getQuickJumpNoMatchEnterAction(params: {
  suggestionQueries: string[];
  suggestionItems: Array<{ anchorId: string }>;
}) {
  const firstQuery = params.suggestionQueries.find((query) => query.trim().length > 0) ?? null;
  if (firstQuery) {
    return {
      type: 'query' as const,
      query: firstQuery,
    };
  }

  const firstItem = params.suggestionItems[0] ?? null;
  if (firstItem) {
    return {
      type: 'item' as const,
      anchorId: firstItem.anchorId,
    };
  }

  return null;
}
