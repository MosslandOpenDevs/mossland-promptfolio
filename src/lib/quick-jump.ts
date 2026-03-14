export const MAX_PINNED_SECTIONS = 4;
const MATCH_FIELD_PRIORITY = ['label', 'aliases', 'section id', 'shortcut'] as const;

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
