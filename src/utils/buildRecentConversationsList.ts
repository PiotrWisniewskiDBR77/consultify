/**
 * Chat V9 / NAV-M3-lite — pure builder for the "recent
 * conversations" dropdown attached to the workspace breadcrumb.
 *
 * What it does
 * ------------
 * Takes the full `conversations` array from
 * `useConversationStore`, filters out anything that would be
 * noise in a "hop to a sibling" popover, sorts the survivors by
 * most-recent-activity-first, truncates long titles so the
 * popover stays single-column, and hands the caller a stable,
 * pre-rendered list of entries.
 *
 * Filtering rules
 * ---------------
 * 1. `archived === true` — archived threads are explicitly not a
 *    sibling you want to jump to. Users who want them can open
 *    the sidebar.
 * 2. Soft-deleted (`deletedAt` non-null / non-empty). Same logic.
 * 3. The currently active conversation (`id === activeId`). A
 *    "jump to yourself" row is dead UX.
 * 4. Untitled rows (empty / whitespace-only `title`). A recents
 *    row with just "Untitled" wastes a slot.
 *
 * Sorting rules
 * -------------
 * - Primary key: `lastMessageAt`, treated as ms-since-epoch. Rows
 *   with a missing / unparseable timestamp fall back to
 *   `updatedAt`. Rows with neither sort last (but before untitled
 *   rows, which were already dropped).
 * - Ties broken by `id` (stable) so snapshot tests stay
 *   deterministic even on the off-chance two conversations share
 *   the same timestamp.
 *
 * Truncation rules
 * ----------------
 * - `RECENT_CONVERSATION_TITLE_MAX` (default 40 chars) keeps the
 *   popover single-column on a 360 px viewport.
 * - Truncated rows expose the full title in `fullTitle` so the
 *   renderer can put it in a `title=` tooltip.
 *
 * Contract invariants the tests pin
 * ---------------------------------
 * - Result length never exceeds `maxItems`.
 * - Result never contains the active conversation id.
 * - Result never contains archived / deleted / blank-title rows.
 * - Order is deterministic for any given input.
 */

export const RECENT_CONVERSATION_TITLE_MAX = 40;
export const DEFAULT_MAX_RECENT_CONVERSATIONS = 5;

export interface RecentConversationEntry {
  id: string;
  label: string;
  fullTitle: string;
  /**
   * Set only when `label !== fullTitle`. Renderers surface this
   * via a tooltip so the user can still see the long title on
   * hover / focus without the popover having to widen.
   */
  truncated: boolean;
  /**
   * True when the upstream conversation had `starred === true` or
   * `isPinned === true` AND the NAV-M3-lite+ kill-switch was ON
   * at build time. Renderers use this to show a pin glyph next
   * to the label and to read screen-reader-friendly aria text.
   * Always `false` when the NAV-M3-lite+ flag is OFF, regardless
   * of the upstream state, so the dropdown stays pixel-for-
   * pixel identical to the v1 shape.
   */
  pinned: boolean;
}

/**
 * Minimal shape we consume from `useConversationStore.conversations`.
 * Intentionally narrower than the full `Conversation` interface so
 * unit tests can feed literal objects without reconstructing the
 * whole type.
 */
export interface RecentConversationInput {
  id?: unknown;
  title?: unknown;
  archived?: unknown;
  deletedAt?: unknown;
  lastMessageAt?: unknown;
  updatedAt?: unknown;
  /**
   * Upstream `Conversation.starred`. When NAV-M3-lite+ is ON
   * this bubbles the entry to the top of the dropdown.
   */
  starred?: unknown;
  /**
   * Upstream `Conversation.isPinned`. Alias for `starred` on
   * the store shape — either source of truthy-ness counts.
   */
  isPinned?: unknown;
}

export interface BuildRecentConversationsListInput {
  conversations: readonly (RecentConversationInput | null | undefined)[] | null | undefined;
  activeConversationId: string | null | undefined;
  maxItems?: number;
  /**
   * NAV-M3-lite+ kill-switch. When `true`, pinned / starred
   * entries bubble to the top of the popover and their
   * `pinned` flag is set. When `false` (or omitted for tests
   * that want the v1 shape), pinning is invisible — ordering
   * falls back to purely chronological and every entry's
   * `pinned` field is `false`. Default `false` so existing
   * callers that have not opted in keep the v1 contract.
   */
  pinnedEnabled?: boolean;
}

/**
 * Shared predicate so `buildRecentConversationsList` and
 * `countEligibleRecentConversations` agree bit-for-bit on what
 * counts as a "sibling worth listing". Returning `null` is a
 * filter-out signal; the caller never has to reconstruct the
 * filter rules.
 */
function isEligibleRow(
  raw: RecentConversationInput | null | undefined,
  activeId: string | null
): { id: string; title: string } | null {
  if (!raw || typeof raw !== 'object') return null;

  const id = typeof raw.id === 'string' ? raw.id : null;
  if (!id || id === activeId) return null;

  if (raw.archived === true) return null;
  if (
    raw.deletedAt !== null &&
    raw.deletedAt !== undefined &&
    String(raw.deletedAt).trim() !== ''
  ) {
    return null;
  }

  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) return null;

  return { id, title };
}

function toTimestamp(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date) {
    const n = raw.getTime();
    return Number.isFinite(n) ? n : null;
  }
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const n = Date.parse(trimmed);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function truncateTitle(title: string, max: number): string {
  if (title.length <= max) return title;
  // Guard against `max <= 1` so the ellipsis itself is never
  // the whole string. Floor at 2 so the truncation is at least
  // "X…" rather than "…".
  const safeMax = Math.max(2, max);
  return `${title.slice(0, safeMax - 1).trimEnd()}…`;
}

export function buildRecentConversationsList({
  conversations,
  activeConversationId,
  maxItems = DEFAULT_MAX_RECENT_CONVERSATIONS,
  pinnedEnabled = false,
}: BuildRecentConversationsListInput): RecentConversationEntry[] {
  if (!Array.isArray(conversations) || conversations.length === 0) return [];
  if (!Number.isFinite(maxItems) || maxItems <= 0) return [];

  const limit = Math.floor(maxItems);
  const activeId =
    typeof activeConversationId === 'string' && activeConversationId.length > 0
      ? activeConversationId
      : null;

  type Scored = {
    entry: RecentConversationEntry;
    score: number;
  };

  const scored: Scored[] = [];
  for (const raw of conversations) {
    const eligible = isEligibleRow(raw, activeId);
    if (!eligible) continue;

    const { id, title } = eligible;

    const lastTs = toTimestamp(raw!.lastMessageAt);
    const updatedTs = toTimestamp(raw!.updatedAt);
    const score = lastTs ?? updatedTs ?? Number.NEGATIVE_INFINITY;

    // Pin detection is tolerant: either `starred` or `isPinned`
    // being strictly `true` flips the bit. Anything else (missing,
    // null, "false", 0) stays unpinned. This matches the upstream
    // `Conversation.starred` boolean contract while also tolerating
    // stores that decided to expose the same idea as `isPinned`.
    const isPinnedRaw = raw!.starred === true || raw!.isPinned === true;
    const pinned = pinnedEnabled && isPinnedRaw;

    const label = truncateTitle(title, RECENT_CONVERSATION_TITLE_MAX);
    scored.push({
      entry: {
        id,
        label,
        fullTitle: title,
        truncated: label !== title,
        pinned,
      },
      score,
    });
  }

  scored.sort((a, b) => {
    // Pinned rows bubble to the top. We only honour the bit when
    // the builder was told pinning is enabled; otherwise every
    // entry carries `pinned=false` so this branch is a no-op.
    if (a.entry.pinned !== b.entry.pinned) {
      return a.entry.pinned ? -1 : 1;
    }
    if (a.score !== b.score) return b.score - a.score;
    // Stable tie-break by id so snapshot tests are deterministic.
    return a.entry.id.localeCompare(b.entry.id);
  });

  return scored.slice(0, limit).map((s) => s.entry);
}

export interface CountEligibleRecentConversationsInput {
  conversations: readonly (RecentConversationInput | null | undefined)[] | null | undefined;
  activeConversationId: string | null | undefined;
}

/**
 * Returns how many conversations survive the same filter rules
 * `buildRecentConversationsList` applies, *before* the `maxItems`
 * cap. NAV-M3-lite++ uses this to decide whether to render the
 * "View all" footer row: if the eligible count is bigger than
 * the capped list, the popover is hiding siblings that the
 * sidebar still knows about — which is exactly when the footer
 * is useful. Pin state is irrelevant to eligibility, so the
 * helper does not take a `pinnedEnabled` arg.
 */
export function countEligibleRecentConversations({
  conversations,
  activeConversationId,
}: CountEligibleRecentConversationsInput): number {
  if (!Array.isArray(conversations) || conversations.length === 0) return 0;

  const activeId =
    typeof activeConversationId === 'string' && activeConversationId.length > 0
      ? activeConversationId
      : null;

  let count = 0;
  for (const raw of conversations) {
    if (isEligibleRow(raw, activeId)) count += 1;
  }
  return count;
}
