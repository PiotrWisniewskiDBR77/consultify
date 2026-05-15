/**
 * Chat V9 / AG1 v1.8 — pure helper that decides whether a given
 * flag description is long enough to warrant a "Show more"
 * toggle in `ChatV9FlagsPanel`.
 *
 * Why a heuristic instead of a ResizeObserver?
 * --------------------------------------------
 * The panel renders dozens of rows; wiring a ResizeObserver +
 * ref per description to detect actual clamp state would cost
 * layout + memory for a decision that is, in practice,
 * determined entirely by character count. The panel's
 * description column renders at `text-xs` (12 px) with
 * `line-clamp-3` — on the standard ~500 px column width that
 * works out to roughly 70 chars per line before the ellipsis
 * kicks in, so ~210 chars is the natural threshold. We round
 * up to `DEFAULT_DESCRIPTION_EXPAND_THRESHOLD` (220) so we
 * never offer "Show more" on a description that would fit in
 * three lines anyway — the toggle would be a no-op and UI
 * clutter.
 *
 * Contract invariants the tests pin
 * ---------------------------------
 * - Empty / whitespace-only / null / undefined inputs always
 *   return `false` (no toggle).
 * - Inputs shorter than the threshold return `false`.
 * - Inputs at or above the threshold return `true`.
 * - Leading / trailing whitespace is ignored (the threshold is
 *   based on the trimmed length).
 */

export const DEFAULT_DESCRIPTION_EXPAND_THRESHOLD = 220;

export interface ShouldOfferChatV9FlagExpandInput {
  description: unknown;
  threshold?: number;
}

export function shouldOfferChatV9FlagExpand({
  description,
  threshold = DEFAULT_DESCRIPTION_EXPAND_THRESHOLD,
}: ShouldOfferChatV9FlagExpandInput): boolean {
  if (typeof description !== 'string') return false;
  const trimmed = description.trim();
  if (trimmed.length === 0) return false;
  if (!Number.isFinite(threshold) || threshold <= 0) return false;
  return trimmed.length >= threshold;
}
