/**
 * B3 — Document Studio visual diff: pure diff-model helpers.
 *
 * Design decision: the backend already computes the authoritative BLOCK-level
 * schema diff (`documentSchemaDiffService.computeDocumentSchemaDiff`) exposed
 * via `GET /:artifactId/diff` → `DocumentSchemaDiffResponse`. We deliberately
 * do NOT re-implement schema diffing on the frontend. What this module adds:
 *
 * 1. `proposalToSchemaDiff()` — adapts a `DocumentEditorProposal` (which only
 *    carries per-target before/after strings, not a `DocumentSchemaDiff`) into
 *    the same `DocumentSchemaDiff` shape, so a single view component
 *    (`DocumentSchemaDiffView`) renders BOTH contexts:
 *    (a) proposal review before approve/reject, and
 *    (b) snapshot-vs-live comparison.
 * 2. `isTextualBlockType()` — classifies which block types get an intra-text
 *    token diff vs a "changed block: <type>" structural label.
 */

import type {
  DocumentBlockDiffEntry,
  DocumentEditorProposal,
  DocumentSchema,
  DocumentSchemaDiff,
  DocumentSchemaDiffStats,
  DocumentSectionDiffEntry,
} from './types';

/**
 * Block types whose canonical text projection is prose-like, so a token-level
 * inline diff is meaningful. Structural blocks (`table`, `kpi_strip`,
 * `risk_table`, `chart`, `image`) have pipe-joined machine projections — for
 * those the view renders a "changed block" label plus the projection as
 * metadata instead of a word diff.
 */
const TEXTUAL_BLOCK_TYPES: ReadonlySet<string> = new Set([
  'heading',
  'paragraph',
  'bullet_list',
  'numbered_list',
  'callout',
  'quote',
  'footnote',
  'citation',
]);

export function isTextualBlockType(blockType: string | null | undefined): boolean {
  return blockType != null && TEXTUAL_BLOCK_TYPES.has(blockType);
}

/** Pseudo section id used when a proposal only carries the aggregate diff. */
export const AGGREGATE_DIFF_SECTION_ID = '__document__';

function emptyStats(): DocumentSchemaDiffStats {
  return {
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
}

function lookupSectionTitle(schema: DocumentSchema | undefined, sectionId: string): string | null {
  const section = schema?.sections?.find((s) => s.sectionId === sectionId);
  return section?.title ?? null;
}

function lookupBlockType(
  schema: DocumentSchema | undefined,
  sectionId: string,
  blockId: string | undefined
): string | null {
  if (!blockId) return null;
  const section = schema?.sections?.find((s) => s.sectionId === sectionId);
  const block = section?.blocks?.find((b) => b.blockId === blockId);
  return block?.type ?? null;
}

function classifyBlockKind(
  before: string,
  after: string
): DocumentBlockDiffEntry['kind'] {
  const hasBefore = before.trim().length > 0;
  const hasAfter = after.trim().length > 0;
  if (!hasBefore && hasAfter) return 'added';
  if (hasBefore && !hasAfter) return 'removed';
  if (before === after) return 'unchanged';
  return 'modified';
}

/**
 * Adapt an editor proposal into the canonical `DocumentSchemaDiff` shape.
 *
 * - When `proposedChanges[]` is present (structured per-target substrate,
 *   E15.4.edit), changes are grouped per target section; block types and
 *   section titles are resolved from the live `schema` when provided.
 * - Otherwise falls back to the aggregate `proposal.diff.before/after` as a
 *   single pseudo-section (`AGGREGATE_DIFF_SECTION_ID`) so the view always has
 *   something faithful to render.
 */
export function proposalToSchemaDiff(
  proposal: DocumentEditorProposal,
  schema?: DocumentSchema
): DocumentSchemaDiff {
  const stats = emptyStats();
  const changes = proposal.proposedChanges ?? [];

  if (changes.length === 0) {
    const before = proposal.diff?.before ?? '';
    const after = proposal.diff?.after ?? '';
    const kind = classifyBlockKind(before, after);
    const hasChanges = kind !== 'unchanged';
    if (hasChanges) {
      stats.modifiedSectionCount = 1;
      if (kind === 'added') stats.addedBlockCount = 1;
      else if (kind === 'removed') stats.removedBlockCount = 1;
      else stats.modifiedBlockCount = 1;
    } else {
      stats.unchangedSectionCount = 1;
      stats.unchangedBlockCount = 1;
    }
    return {
      hasChanges,
      sectionDiffs: [
        {
          kind: hasChanges ? 'modified' : 'unchanged',
          sectionId: AGGREGATE_DIFF_SECTION_ID,
          beforeTitle: null,
          afterTitle: null,
          beforeOrderIndex: null,
          afterOrderIndex: null,
          blockDiffs: [
            {
              kind,
              blockId: `${AGGREGATE_DIFF_SECTION_ID}:aggregate`,
              blockType: null,
              beforeText: before || null,
              afterText: after || null,
              beforePositionIndex: null,
              afterPositionIndex: null,
            },
          ],
        },
      ],
      stats,
    };
  }

  // Group structured changes per target section, preserving first-seen order.
  const sectionOrder: string[] = [];
  const bySection = new Map<string, DocumentBlockDiffEntry[]>();
  changes.forEach((change, index) => {
    const sectionId = change.targetSectionId || AGGREGATE_DIFF_SECTION_ID;
    if (!bySection.has(sectionId)) {
      bySection.set(sectionId, []);
      sectionOrder.push(sectionId);
    }
    const before = change.before ?? '';
    const after = change.after ?? '';
    const kind = classifyBlockKind(before, after);
    if (kind === 'added') stats.addedBlockCount += 1;
    else if (kind === 'removed') stats.removedBlockCount += 1;
    else if (kind === 'modified') stats.modifiedBlockCount += 1;
    else stats.unchangedBlockCount += 1;
    bySection.get(sectionId)!.push({
      kind,
      blockId: change.targetBlockId ?? `${sectionId}:change-${index}`,
      blockType: lookupBlockType(schema, sectionId, change.targetBlockId),
      beforeText: before || null,
      afterText: after || null,
      beforePositionIndex: null,
      afterPositionIndex: null,
    });
  });

  const sectionDiffs: DocumentSectionDiffEntry[] = sectionOrder.map((sectionId) => {
    const blockDiffs = bySection.get(sectionId)!;
    const changed = blockDiffs.some((b) => b.kind !== 'unchanged');
    if (changed) stats.modifiedSectionCount += 1;
    else stats.unchangedSectionCount += 1;
    const title = lookupSectionTitle(schema, sectionId);
    return {
      kind: changed ? 'modified' : 'unchanged',
      sectionId,
      beforeTitle: title,
      afterTitle: title,
      beforeOrderIndex: null,
      afterOrderIndex: null,
      blockDiffs,
    };
  });

  return {
    hasChanges: sectionDiffs.some((s) => s.kind !== 'unchanged'),
    sectionDiffs,
    stats,
  };
}
