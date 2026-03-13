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
