/**
 * Chat V9 / ADMIN AG1 v1.6 — pure grouping helper for the admin
 * flag panel.
 *
 * What it does
 * ------------
 * Takes an ordered list of flag descriptors (already filtered by
 * AG1 v1.5 if applicable) plus the full registry (pre-filter) and
 * returns one entry per block that *ever* appears in the registry,
 * preserving **first-seen order in the full registry** so the UI
 * layout does not shuffle as the user types into the filter.
 *
 * Each entry carries:
 *
 *   - `block`         the block name (discriminant),
 *   - `visibleFlags`  flags that survived the current filter
 *                     (possibly empty if the query hides all of
 *                     this block),
 *   - `totalFlags`    count of flags in the block across the full
 *                     registry — so group headers can render
 *                     `visible / total` without a second pass,
 *   - `hasMatches`    `visibleFlags.length > 0` as a convenience
 *                     for the "auto-expand matching groups while
 *                     a query is active" rule.
 *
 * Groups with zero flags in the full registry are excluded. This
 * keeps the UI honest: we never render a `input` header if no
 * INPUT flags are registered yet.
 *
 * Design notes
 * ------------
 * - Pure: no DOM, no React imports.
 * - Stable ordering: uses the full-registry order, not the filter
 *   result, so expanding / collapsing feels like moving between
 *   fixed sections.
 * - Intentionally does NOT sort blocks alphabetically — the
 *   registry author ordered flags with a reason (voice comes
 *   before admin because that's how waves shipped) and the panel
 *   should reflect that.
 */

import type { ChatV9Block, ChatV9FlagDescriptor } from './chatV9FeatureFlags';

export interface ChatV9FlagGroup {
  block: ChatV9Block;
  visibleFlags: readonly ChatV9FlagDescriptor[];
  totalFlags: number;
  hasMatches: boolean;
}

/**
 * Group `visibleFlags` by block using `allFlags` to establish:
 *
 *   - which blocks exist at all (so empty groups never render),
 *   - their canonical order (first-seen in the registry),
 *   - `totalFlags` per block (denominator for the header count).
 *
 * Callers that don't filter can pass the same list twice.
 */
export function groupChatV9Flags(
  visibleFlags: readonly ChatV9FlagDescriptor[],
  allFlags: readonly ChatV9FlagDescriptor[]
): ChatV9FlagGroup[] {
  const order: ChatV9Block[] = [];
  const totals = new Map<ChatV9Block, number>();
  for (const flag of allFlags) {
    if (!totals.has(flag.block)) {
      order.push(flag.block);
      totals.set(flag.block, 0);
    }
    totals.set(flag.block, (totals.get(flag.block) ?? 0) + 1);
  }

  const visibleByBlock = new Map<ChatV9Block, ChatV9FlagDescriptor[]>();
  for (const flag of visibleFlags) {
    const bucket = visibleByBlock.get(flag.block);
    if (bucket) {
      bucket.push(flag);
    } else {
      visibleByBlock.set(flag.block, [flag]);
    }
  }

  return order.map((block) => {
    const visible = visibleByBlock.get(block) ?? [];
    return {
      block,
      visibleFlags: visible,
      totalFlags: totals.get(block) ?? 0,
      hasMatches: visible.length > 0,
    };
  });
}
