/**
 * Document Studio — Structural Diff Service (Slice E16.diff).
 *
 * Computes a deterministic, structural diff between two
 * `DocumentSchema` snapshots. Closes the §10.9 substrate gap from
 * `CONSULTIFY_DOCUMENT_STUDIO_V1_GAP_VS_TARGET_2026-05-08.md`
 * (FR-15 — Track-changes UI):
 * - the FE-E2 track-changes surface needs a section-by-section,
 *   block-by-block diff to render highlights, side-by-side
 *   columns, and per-block accept / reject affordances;
 * - the audit pipeline needs aggregate stats (e.g. "this approval
 *   modified 3 sections / added 7 blocks") for log lines and
 *   forensic replay;
 * - the editor proposal review UI (post-E15.4.edit wiring) needs
 *   a structural change summary independent of the prose-level
 *   diff already carried on `DocumentEditorProposal.diff`.
 *
 * Substrate-only: this slice ships pure logic + types + helpers
 * + 25 specs. The FE-E2 surface, the audit-pipeline integration,
 * and the editor-proposal review UI are all follow-up slices on
 * top of this substrate. No service / route / persistence layer
 * is touched.
 *
 * Diff kinds:
 * - `added` — present in `after`, not in `before`;
 * - `removed` — present in `before`, not in `after`;
 * - `modified` — same id, but content / title / block list
 *   changed;
 * - `reordered` — same id and content, but `orderIndex` changed
 *   (sections only — blocks have no `orderIndex` field, so block
 *   reordering surfaces as the position-change between matched
 *   block ids);
 * - `unchanged` — same id and identical content.
 *
 * Anti-goals (deliberately out of scope, scheduled as follow-ups):
 * - character / word-level prose diff (chooses
 *   `diff-match-patch` or similar in a follow-up slice;
 *   structural diff is the substrate that prose diff layers on
 *   top of);
 * - semantic diff (e.g. "tone changed" / "sentiment flipped") —
 *   that lives in the QA pipeline, not here;
 * - 3-way / merge-aware diff for collaborative editing — defer
 *   until E20 (real-time multiplayer / NFR-10) lands.
 */

import type {
  DocumentBlock,
  DocumentBlockType,
  DocumentSchema,
  DocumentSection,
} from './documentStudioTypes.js';

// =============================================================================
// Public types
// =============================================================================

export type DocumentSectionDiffKind = 'added' | 'removed' | 'modified' | 'reordered' | 'unchanged';

export type DocumentBlockDiffKind = 'added' | 'removed' | 'modified' | 'unchanged';

export interface DocumentBlockDiffEntry {
  kind: DocumentBlockDiffKind;
  blockId: string;
  blockType: DocumentBlockType | null;
  /** Canonical text projection of the `before` block, or null. */
  beforeText: string | null;
  /** Canonical text projection of the `after` block, or null. */
  afterText: string | null;
  /** Position index within the section's `blocks[]` array. */
  beforePositionIndex: number | null;
  afterPositionIndex: number | null;
}

export interface DocumentSectionDiffEntry {
  kind: DocumentSectionDiffKind;
  sectionId: string;
  beforeTitle: string | null;
  afterTitle: string | null;
  beforeOrderIndex: number | null;
  afterOrderIndex: number | null;
  blockDiffs: DocumentBlockDiffEntry[];
}

export interface DocumentSchemaDiffStats {
  addedSectionCount: number;
  removedSectionCount: number;
  modifiedSectionCount: number;
  reorderedSectionCount: number;
  unchangedSectionCount: number;
  addedBlockCount: number;
  removedBlockCount: number;
  modifiedBlockCount: number;
  unchangedBlockCount: number;
}

export interface DocumentSchemaDiff {
  /**
   * True iff at least one section or block changed (added,
   * removed, modified, or reordered). Identical schemas + null
   * pairs collapse to `false`.
   */
  hasChanges: boolean;
  /**
   * Per-section diff entries in `after`-then-`removed` order:
   * - sections present in `after` first, in `after.sections[]`
   *   order;
   * - sections only present in `before` (i.e. removed) appended
   *   at the end, in `before.sections[]` order.
   *
   * This ordering matches the FE-E2 track-changes surface render
   * convention: the user sees the new document layout primarily
   * and removed sections are appended as struck-out trailing
   * cards.
   */
  sectionDiffs: DocumentSectionDiffEntry[];
  stats: DocumentSchemaDiffStats;
}

// =============================================================================
// Public helpers
// =============================================================================

/**
 * Canonical text projection of a block for diffing. Stable across
 * renderer versions because diff matching MUST NOT drift if a
 * renderer cosmetic update changes the markdown / DOCX projection.
 *
 * The projection covers `heading`, `paragraph`, `bullet_list`,
 * `numbered_list`, `callout`, `quote`, `kpi_strip`, `risk_table`,
 * `table`, `image`, `chart`, `footnote`, `citation`. Unknown block
 * types fall back to JSON-stringified `content` so the diff still
 * compares deterministically.
 */
export function blockToDiffText(block: DocumentBlock | undefined | null): string {
  if (!block) return '';
  const content = block.content;
  switch (block.type) {
    case 'heading': {
      const c = content as { level?: number; text?: string } | undefined;
      return `H${c?.level ?? 2}:${(c?.text ?? '').trim()}`;
    }
    case 'paragraph': {
      const c = content as { text?: string } | undefined;
      return (c?.text ?? '').trim();
    }
    case 'bullet_list':
    case 'numbered_list': {
      const c = content as { items?: string[] } | undefined;
      const items = c?.items;
      return Array.isArray(items) ? items.map((i) => i.trim()).join('\n') : '';
    }
    case 'callout':
    case 'quote': {
      const c = content as { text?: string } | undefined;
      return (c?.text ?? '').trim();
    }
    case 'kpi_strip': {
      const c = content as { kpis?: Array<{ label?: string; value?: string }> } | undefined;
      const kpis = c?.kpis;
      if (!Array.isArray(kpis)) return '';
      return kpis.map((k) => `${k?.label ?? ''}=${k?.value ?? ''}`).join('|');
    }
    case 'risk_table': {
      const c =
        (content as
          | {
              rows?: Array<{
                risk?: string;
                severity?: string;
                mitigation?: string;
                owner?: string;
              }>;
            }
          | undefined) ?? undefined;
      const rows = c?.rows;
      if (!Array.isArray(rows)) return '';
      return rows
        .map(
          (r) => `${r?.risk ?? ''}|${r?.severity ?? ''}|${r?.mitigation ?? ''}|${r?.owner ?? ''}`
        )
        .join('\n');
    }
    case 'table': {
      const c = content as { rows?: string[][] } | undefined;
      const rows = c?.rows;
      if (!Array.isArray(rows)) return '';
      return rows.map((r) => (Array.isArray(r) ? r.join('|') : '')).join('\n');
    }
    case 'image': {
      const c = content as { url?: string; alt?: string } | undefined;
      return `IMG:${c?.url ?? ''}|${c?.alt ?? ''}`;
    }
    case 'chart': {
      const c = content as
        | {
            kind?: string;
            title?: string;
            series?: Array<{ label?: string; values?: number[] }>;
          }
        | undefined;
      const series = c?.series;
      const seriesPart = Array.isArray(series)
        ? series
            .map((s) => {
              const values = s?.values;
              const valuePart = Array.isArray(values) ? values.join(',') : '';
              return `${s?.label ?? ''}:[${valuePart}]`;
            })
            .join('|')
        : '';
      return `CHART:${c?.kind ?? ''}|${c?.title ?? ''}|${seriesPart}`;
    }
    case 'footnote':
    case 'citation': {
      const c = content as { text?: string } | undefined;
      return (c?.text ?? '').trim();
    }
    default: {
      // Defensive fallback so unknown future block types still
      // diff deterministically. JSON.stringify is not stable for
      // key order across runtimes in pathological cases, but for
      // our `content` shapes (plain object literals) it is stable
      // in practice across V8 and used here only as a tiebreaker.
      try {
        return JSON.stringify(content ?? null);
      } catch {
        return '';
      }
    }
  }
}

/**
 * Compute the structural diff between two `DocumentSchema`
 * snapshots. Pure / deterministic / never throws / never mutates.
 *
 * Edge cases:
 * - both null / undefined → empty diff with `hasChanges: false`;
 * - only `before` → all sections / blocks reported as `removed`;
 * - only `after` → all sections / blocks reported as `added`;
 * - identical inputs → all entries reported as `unchanged`.
 */
export function computeDocumentSchemaDiff(
  before: DocumentSchema | null | undefined,
  after: DocumentSchema | null | undefined
): DocumentSchemaDiff {
  const beforeSections = before?.sections ?? [];
  const afterSections = after?.sections ?? [];

  const beforeById = new Map<string, DocumentSection>();
  for (const s of beforeSections) {
    if (s && typeof s.sectionId === 'string') beforeById.set(s.sectionId, s);
  }
  const afterById = new Map<string, DocumentSection>();
  for (const s of afterSections) {
    if (s && typeof s.sectionId === 'string') afterById.set(s.sectionId, s);
  }

  const sectionDiffs: DocumentSectionDiffEntry[] = [];
  const stats: DocumentSchemaDiffStats = {
    addedSectionCount: 0,
    removedSectionCount: 0,
    modifiedSectionCount: 0,
    reorderedSectionCount: 0,
    unchangedSectionCount: 0,
    addedBlockCount: 0,
    removedBlockCount: 0,
    modifiedBlockCount: 0,
    unchangedBlockCount: 0,
  };

  // Walk `after` first to surface the new layout primarily.
  for (const afterSection of afterSections) {
    if (!afterSection || typeof afterSection.sectionId !== 'string') continue;
    const beforeSection = beforeById.get(afterSection.sectionId);
    if (!beforeSection) {
      // ADDED section — every block inside is added.
      const blockDiffs = (afterSection.blocks ?? []).map<DocumentBlockDiffEntry>(
        (b, idx): DocumentBlockDiffEntry => ({
          kind: 'added',
          blockId: b?.blockId ?? `unknown-${idx}`,
          blockType: (b?.type ?? null) as DocumentBlockType | null,
          beforeText: null,
          afterText: blockToDiffText(b),
          beforePositionIndex: null,
          afterPositionIndex: idx,
        })
      );
      stats.addedBlockCount += blockDiffs.length;
      stats.addedSectionCount += 1;
      sectionDiffs.push({
        kind: 'added',
        sectionId: afterSection.sectionId,
        beforeTitle: null,
        afterTitle: afterSection.title ?? null,
        beforeOrderIndex: null,
        afterOrderIndex:
          typeof afterSection.orderIndex === 'number' ? afterSection.orderIndex : null,
        blockDiffs,
      });
      continue;
    }
    // MATCHED section — compute block-level diff and decide
    // section kind (modified / reordered / unchanged).
    const blockDiffs = computeBlockDiffs(beforeSection, afterSection);
    for (const bd of blockDiffs) {
      if (bd.kind === 'added') stats.addedBlockCount += 1;
      else if (bd.kind === 'removed') stats.removedBlockCount += 1;
      else if (bd.kind === 'modified') stats.modifiedBlockCount += 1;
      else stats.unchangedBlockCount += 1;
    }
    const titleChanged = (beforeSection.title ?? '') !== (afterSection.title ?? '');
    const blocksChanged = blockDiffs.some((bd) => bd.kind !== 'unchanged');
    let kind: DocumentSectionDiffKind;
    if (titleChanged || blocksChanged) {
      kind = 'modified';
      stats.modifiedSectionCount += 1;
    } else if (
      typeof beforeSection.orderIndex === 'number' &&
      typeof afterSection.orderIndex === 'number' &&
      beforeSection.orderIndex !== afterSection.orderIndex
    ) {
      kind = 'reordered';
      stats.reorderedSectionCount += 1;
    } else {
      kind = 'unchanged';
      stats.unchangedSectionCount += 1;
    }
    sectionDiffs.push({
      kind,
      sectionId: afterSection.sectionId,
      beforeTitle: beforeSection.title ?? null,
      afterTitle: afterSection.title ?? null,
      beforeOrderIndex:
        typeof beforeSection.orderIndex === 'number' ? beforeSection.orderIndex : null,
      afterOrderIndex: typeof afterSection.orderIndex === 'number' ? afterSection.orderIndex : null,
      blockDiffs,
    });
  }

  // Append REMOVED sections (present in `before`, not in `after`).
  for (const beforeSection of beforeSections) {
    if (!beforeSection || typeof beforeSection.sectionId !== 'string') continue;
    if (afterById.has(beforeSection.sectionId)) continue;
    const blockDiffs = (beforeSection.blocks ?? []).map<DocumentBlockDiffEntry>(
      (b, idx): DocumentBlockDiffEntry => ({
        kind: 'removed',
        blockId: b?.blockId ?? `unknown-${idx}`,
        blockType: (b?.type ?? null) as DocumentBlockType | null,
        beforeText: blockToDiffText(b),
        afterText: null,
        beforePositionIndex: idx,
        afterPositionIndex: null,
      })
    );
    stats.removedBlockCount += blockDiffs.length;
    stats.removedSectionCount += 1;
    sectionDiffs.push({
      kind: 'removed',
      sectionId: beforeSection.sectionId,
      beforeTitle: beforeSection.title ?? null,
      afterTitle: null,
      beforeOrderIndex:
        typeof beforeSection.orderIndex === 'number' ? beforeSection.orderIndex : null,
      afterOrderIndex: null,
      blockDiffs,
    });
  }

  const hasChanges =
    stats.addedSectionCount > 0 ||
    stats.removedSectionCount > 0 ||
    stats.modifiedSectionCount > 0 ||
    stats.reorderedSectionCount > 0 ||
    stats.addedBlockCount > 0 ||
    stats.removedBlockCount > 0 ||
    stats.modifiedBlockCount > 0;

  return {
    hasChanges,
    sectionDiffs,
    stats,
  };
}

function computeBlockDiffs(
  beforeSection: DocumentSection,
  afterSection: DocumentSection
): DocumentBlockDiffEntry[] {
  const beforeBlocks = beforeSection.blocks ?? [];
  const afterBlocks = afterSection.blocks ?? [];
  const beforeById = new Map<string, { block: DocumentBlock; idx: number }>();
  beforeBlocks.forEach((b, idx) => {
    if (b && typeof b.blockId === 'string') beforeById.set(b.blockId, { block: b, idx });
  });
  const afterById = new Map<string, { block: DocumentBlock; idx: number }>();
  afterBlocks.forEach((b, idx) => {
    if (b && typeof b.blockId === 'string') afterById.set(b.blockId, { block: b, idx });
  });

  const out: DocumentBlockDiffEntry[] = [];

  for (let i = 0; i < afterBlocks.length; i += 1) {
    const ab = afterBlocks[i];
    if (!ab || typeof ab.blockId !== 'string') continue;
    const beforeRef = beforeById.get(ab.blockId);
    const afterText = blockToDiffText(ab);
    if (!beforeRef) {
      out.push({
        kind: 'added',
        blockId: ab.blockId,
        blockType: (ab.type ?? null) as DocumentBlockType | null,
        beforeText: null,
        afterText,
        beforePositionIndex: null,
        afterPositionIndex: i,
      });
      continue;
    }
    const beforeText = blockToDiffText(beforeRef.block);
    const typeChanged = beforeRef.block.type !== ab.type;
    const textChanged = beforeText !== afterText;
    out.push({
      kind: typeChanged || textChanged ? 'modified' : 'unchanged',
      blockId: ab.blockId,
      blockType: (ab.type ?? null) as DocumentBlockType | null,
      beforeText,
      afterText,
      beforePositionIndex: beforeRef.idx,
      afterPositionIndex: i,
    });
  }

  // Append REMOVED blocks (present in before, not in after).
  for (let i = 0; i < beforeBlocks.length; i += 1) {
    const bb = beforeBlocks[i];
    if (!bb || typeof bb.blockId !== 'string') continue;
    if (afterById.has(bb.blockId)) continue;
    out.push({
      kind: 'removed',
      blockId: bb.blockId,
      blockType: (bb.type ?? null) as DocumentBlockType | null,
      beforeText: blockToDiffText(bb),
      afterText: null,
      beforePositionIndex: i,
      afterPositionIndex: null,
    });
  }

  return out;
}

/**
 * Human-readable summary suitable for log lines, audit entries,
 * and the FE-E2 track-changes surface header. Stable shape, never
 * throws, never mutates input.
 *
 * Format: `"3 sections modified, 7 blocks added, 2 blocks removed"`
 * — only non-zero counts are included so the line stays tight on
 * narrow surfaces. Returns `"No structural changes."` for a clean
 * diff.
 */
export function summarizeDocumentSchemaDiff(diff: DocumentSchemaDiff | undefined | null): string {
  if (!diff || !diff.hasChanges) return 'No structural changes.';
  const parts: string[] = [];
  const s = diff.stats;
  if (s.addedSectionCount > 0) parts.push(plural(s.addedSectionCount, 'section', 'added'));
  if (s.removedSectionCount > 0) parts.push(plural(s.removedSectionCount, 'section', 'removed'));
  if (s.modifiedSectionCount > 0) parts.push(plural(s.modifiedSectionCount, 'section', 'modified'));
  if (s.reorderedSectionCount > 0) {
    parts.push(plural(s.reorderedSectionCount, 'section', 'reordered'));
  }
  if (s.addedBlockCount > 0) parts.push(plural(s.addedBlockCount, 'block', 'added'));
  if (s.removedBlockCount > 0) parts.push(plural(s.removedBlockCount, 'block', 'removed'));
  if (s.modifiedBlockCount > 0) parts.push(plural(s.modifiedBlockCount, 'block', 'modified'));
  if (parts.length === 0) return 'No structural changes.';
  return `${parts.join(', ')}.`;
}

function plural(n: number, noun: 'section' | 'block', verb: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'} ${verb}`;
}
