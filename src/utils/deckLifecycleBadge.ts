/**
 * Shared lifecycle badge derivation for presentation decks.
 * P20 contract §2.4: badges must be derived from P18 trust-state
 * (publishState + exportHistory), not from presentation_decks.status.
 */

export type DeckBadge = 'Draft' | 'Reviewed' | 'Exported';

interface ExportHistoryItem {
  status?: string;
}

export function deriveDeckLifecycleBadge(
  publishState?: string | null,
  exportHistory?: ExportHistoryItem[] | null
): DeckBadge {
  const hasSuccessfulExport =
    Array.isArray(exportHistory) &&
    exportHistory.some((e) => e.status === 'completed' || e.status === 'success');

  if (hasSuccessfulExport) return 'Exported';

  if (
    publishState === 'in_review' ||
    publishState === 'review_shared' ||
    publishState === 'reviewed' ||
    publishState === 'published'
  ) {
    return 'Reviewed';
  }

  return 'Draft';
}

export function deriveDeckBadgeFromNativeStatus(status?: string | null): DeckBadge {
  if (status === 'ready' || status === 'exported') return 'Exported';
  if (status === 'reviewed') return 'Reviewed';
  return 'Draft';
}
