/**
 * CanonTableDefaults — shared style tokens + utilities for canon list tables
 * (ARTIFACT_ANATOMY_STANDARD §9.2 ⑦ "wiersz listy + nagłówek",
 * TABLE_AND_PREVIEW_CANON list rules).
 *
 * These are NOT a new table component — they are the agreed classNames and
 * helpers you drop into an existing ResizableTable / FilterableTable so every
 * list looks like one product:
 *   - hairline row separators (divide-c-border-subtle)
 *   - header on a slightly different surface, uppercase muted labels
 *   - calm row hover (bg-c-surface-raised/50)
 *   - low-information cells rendered as quiet text (lowEntropyCell)
 *   - tag lists capped at 2 + "+N" (renderCappedTags)
 *
 * ── How to apply with ResizableTable / FilterableTable ─────────────────────
 * ResizableTable/FilterableTable accept per-column `render` functions and
 * className hooks. Wire the constants in:
 *
 *   // container / body
 *   <div className={CANON_TABLE.container}>
 *     <table>
 *       <thead className={CANON_TABLE.header}>
 *         <th className={CANON_TABLE.headerCell}>NAME</th> …
 *       </thead>
 *       <tbody className={CANON_TABLE.body}>       // divide-y hairlines
 *         <tr className={CANON_TABLE.row}>          // calm hover
 *           <td>{title}</td>
 *           <td>{lowEntropyCell(category)}</td>     // quiet category text
 *           <td><QuietChip status={license} variant="dot" /></td>
 *           <td>{renderCappedTags(tags)}</td>       // max 2 + "+N"
 *
 * For column configs, expose these via the column's `render`/`cellClassName`.
 * Nothing here overrides selection/hover tokens owned by useTableSelection —
 * it composes with them.
 */

import React from 'react';

/**
 * Canonical table class tokens. Apply to the matching structural element.
 * All colors are `c.*` role tokens — no navy/slate/hex, no crimson.
 */
export const CANON_TABLE = {
  /** Outer scroll container. */
  container: 'w-full overflow-x-auto',
  /** <thead> — header sits on a faintly raised surface with a hairline base. */
  header:
    'bg-c-surface-raised/60 border-b border-c-border-subtle',
  /** <th> — uppercase 11px tracked muted label. */
  headerCell:
    'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-c-text-muted whitespace-nowrap',
  /** <tbody> — hairline separators between rows. */
  body: 'divide-y divide-c-border-subtle',
  /** <tr> — calm hover, no loud fill. */
  row: 'transition-colors hover:bg-c-surface-raised/50',
  /** <td> — default cell padding + primary text. */
  cell: 'px-3 py-2.5 text-[13px] text-c-text align-middle',
  /** Title/primary cell — the one high-signal column. */
  primaryCell: 'px-3 py-2.5 text-[13px] font-medium text-c-text align-middle',
  /** Low-information cell — quiet, recedes behind the title. */
  lowEntropyCell: 'px-3 py-2.5 text-[13px] text-c-text-muted align-middle',
} as const;

/**
 * Utility className for a low-information cell (Category, License text, meta).
 * Use on the <td> (or wrap the value) so low-signal columns visually recede.
 */
export const lowEntropyCell = CANON_TABLE.lowEntropyCell;

/**
 * Render a tag list capped at `max` visible tags, with a quiet "+N" overflow
 * marker — kills the "wall of tags" that drowns dense tables.
 *
 * @example renderCappedTags(['ai','ops','risk','pmo'])  // ai · ops · +2
 */
export function renderCappedTags(
  tags: readonly string[] | null | undefined,
  max = 2,
): React.ReactNode {
  const list = (tags ?? []).filter(Boolean);
  if (list.length === 0) return null;
  const visible = list.slice(0, max);
  const overflow = list.length - visible.length;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-c-text-muted">
      {visible.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="inline-flex items-center rounded-md bg-c-surface-raised px-1.5 py-0.5"
        >
          {tag}
        </span>
      ))}
      {overflow > 0 && (
        <span className="text-c-text-muted" title={list.slice(max).join(', ')}>
          +{overflow}
        </span>
      )}
    </span>
  );
}

export default CANON_TABLE;
