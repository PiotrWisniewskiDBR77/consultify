import type { NotebookPage } from '@/types/myWork';

/**
 * DEC-405b (ZLECENIE 1.1-J2, przejście właściciela 06.09) — pure predicates
 * behind the sidebar's view-lens filter (dropdown + counters replacing the
 * old 6-chip row). Extracted from `NotebookContent.tsx` unchanged (same
 * logic, "nie zmieniaj predykatów" — owner's instruction) so they can be
 * unit-tested directly instead of only through a static source-string
 * contract (`NotebookContent.tsx` pulls in tiptap and OOMs jsdom on mount,
 * so it can't be rendered in a normal RTL test).
 * [ODMROZENIE 07_MY_WORK_AGENT DEC-397]
 */
export type NotebookViewLens = 'all' | 'pinned' | 'recent' | 'toReview' | 'fresh' | 'orphaned';

/** "Recent" = touched within the last 7 days. */
export function isRecentPage(p: NotebookPage, now: number = Date.now()): boolean {
  if (!p.updatedAt) return false;
  const t = new Date(p.updatedAt).getTime();
  if (Number.isNaN(t)) return false;
  return now - t <= 7 * 24 * 60 * 60 * 1000;
}

/** A page is "to review" when its knowledge is disputed/stale or still in inbox. */
export function isToReviewPage(p: NotebookPage): boolean {
  return p.verificationStatus === 'disputed' || !!p.staleAt || p.status === 'inbox';
}

/** "Fresh" = arrived via a capture source (quick-capture, email, file, canvas). */
export function isFreshPage(p: NotebookPage): boolean {
  return !!(p.captureSource || p.captureMetadata?.captureSource);
}

/**
 * `isOrphaned` is injected because orphan status depends on a
 * component-level async lookup (`orphanIds`, a Set of page ids with zero
 * `link_graph_edges` rows) that this module has no business owning.
 */
export function matchesView(
  p: NotebookPage,
  lens: NotebookViewLens,
  isOrphaned: (p: NotebookPage) => boolean
): boolean {
  if (lens === 'pinned') return !!p.pinned;
  if (lens === 'recent') return isRecentPage(p);
  if (lens === 'toReview') return isToReviewPage(p);
  if (lens === 'fresh') return isFreshPage(p);
  if (lens === 'orphaned') return isOrphaned(p);
  return true;
}
