export const MAX_PINNED_SECTIONS = 4;

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
