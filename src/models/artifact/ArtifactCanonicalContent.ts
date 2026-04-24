/**
 * V10-ART-006 — per-type canonical content schema (Wave A seed).
 *
 * Implements R-ARTIFACT-6 from
 * `docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md#v10-art-006`.
 *
 * Scope (Wave A seed)
 * -------------------
 * Promotes the `ArtifactContent` placeholder (V10-ART-001) to a
 * discriminated union keyed by `kind`, one variant per artifact type,
 * so future mutations (V10-ART-007) can diff, partially-accept, and
 * transform content without "blob" round-trips.
 *
 * Every content node carries a stable, branded `NodeId`. Mutations
 * must address nodes by id; the `assertNodeIdsUnique` invariant
 * runs at write time (V10-ART-022).
 *
 * What lands here
 * ---------------
 *   - `NodeId` (branded string) + `unsafeNodeId`
 *   - `SCHEMA_VERSION_BY_TYPE`: per-type current schema version
 *   - Six canonical content variants:
 *       * slide_deck      — tree of Slide nodes with blocks[]
 *       * spreadsheet     — cell graph + charts + named ranges
 *       * memo + rich_note — block list (paragraph / heading / list
 *         / quote / code / image / table)
 *       * decision_doc    — structured sections (context, options,
 *         recommendation, rationale, unresolved)
 *       * raci            — rows + RACI matrix
 *       * research_report — typed research blocks (summary, finding,
 *         claim, citation, hedging, assumption, appendix)
 *   - `ArtifactCanonicalContent` discriminated union
 *   - `collectNodeIds(content): readonly NodeId[]`
 *   - `assertNodeIdsUnique(content): void`
 *   - `schemaVersionForContent(content): number`
 *
 * What does NOT land here
 * -----------------------
 *   - Renderers (V10-ART-016..020 — one per type)
 *   - `MutationProposal` envelope (V10-ART-007)
 *   - Typed op list (V10-ART-008)
 *   - Schema version migrations (V10-ART-022 ArtifactStore)
 *
 * Back-compat
 * -----------
 * The `ArtifactContent` placeholder in `Artifact.ts` remains; its
 * JSDoc points callers at this module. ArtifactStore (V10-ART-022)
 * migrates persisted content to this union in one sweep. Until then
 * existing call sites type-assert between the two.
 */

import type { ArtifactType } from './Artifact';

// ---------------------------------------------------------------------------
// §1 — Branded NodeId.
// ---------------------------------------------------------------------------

declare const NODE_ID_BRAND: unique symbol;
export type NodeId = string & { readonly [NODE_ID_BRAND]: void };
export const unsafeNodeId = (v: string): NodeId => v as NodeId;

// ---------------------------------------------------------------------------
// §2 — Per-type schema version.
// ---------------------------------------------------------------------------

/**
 * Current canonical schema version per artifact type. Bumped when a
 * breaking change lands; V10-ART-022 migrates old versions forward.
 * Schema version lives on the *content*, not on the Artifact record,
 * so multiple versions can coexist in the library during a migration
 * window.
 */
export const SCHEMA_VERSION_BY_TYPE: Readonly<Record<ArtifactType, number>> = {
  slide_deck: 1,
  spreadsheet: 1,
  memo: 1,
  decision_doc: 1,
  raci: 1,
  research_report: 1,
  rich_note: 1,
} as const;

// ---------------------------------------------------------------------------
// §3 — Slide deck (tree of Slide nodes).
// ---------------------------------------------------------------------------

export type SlideBlockKind = 'text' | 'image' | 'chart' | 'table' | 'shape' | 'notes';

export interface SlideBlock {
  readonly id: NodeId;
  readonly kind: SlideBlockKind;
  /**
   * Opaque content payload — kept generic in Wave A seed so each
   * block kind can be detailed by V10-ART-016. Nodes still get a
   * stable id so the mutation layer can target them before the
   * renderer lands.
   */
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface SlideLayout {
  readonly name: string;
  readonly slotIds: readonly NodeId[];
}

export interface Slide {
  readonly id: NodeId;
  readonly layout: SlideLayout;
  readonly blocks: readonly SlideBlock[];
}

export interface SlideDeckContent {
  readonly kind: 'slide_deck';
  readonly schemaVersion: number;
  readonly slides: readonly Slide[];
}

// ---------------------------------------------------------------------------
// §4 — Spreadsheet (cell graph).
// ---------------------------------------------------------------------------

export interface SpreadsheetCell {
  readonly id: NodeId;
  /** A1-style or structured ref; treated opaque here. */
  readonly ref: string;
  readonly formula: string | null;
  readonly rawValue: number | string | boolean | null;
  /**
   * Ids of cells this cell reads from. Drives partial-recalc and
   * cell-level lineage (V10-ART-018).
   */
  readonly dependsOn: readonly NodeId[];
}

export interface SpreadsheetNamedRange {
  readonly id: NodeId;
  readonly name: string;
  readonly refs: readonly string[];
}

export interface SpreadsheetChart {
  readonly id: NodeId;
  readonly kind: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  readonly boundRangeIds: readonly NodeId[];
}

export interface SpreadsheetContent {
  readonly kind: 'spreadsheet';
  readonly schemaVersion: number;
  readonly cells: Readonly<Record<string, SpreadsheetCell>>;
  readonly namedRanges: readonly SpreadsheetNamedRange[];
  readonly charts: readonly SpreadsheetChart[];
}

// ---------------------------------------------------------------------------
// §5 — Memo / rich-note (block list).
// ---------------------------------------------------------------------------

export type DocBlockKind = 'paragraph' | 'heading' | 'list' | 'quote' | 'code' | 'image' | 'table';

export interface DocBlock {
  readonly id: NodeId;
  readonly kind: DocBlockKind;
  readonly text: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface MemoContent {
  readonly kind: 'memo';
  readonly schemaVersion: number;
  readonly blocks: readonly DocBlock[];
}

export interface RichNoteContent {
  readonly kind: 'rich_note';
  readonly schemaVersion: number;
  readonly blocks: readonly DocBlock[];
}

// ---------------------------------------------------------------------------
// §6 — Decision doc (structured sections).
// ---------------------------------------------------------------------------

export type DecisionSectionKind =
  | 'context'
  | 'options'
  | 'recommendation'
  | 'rationale'
  | 'unresolved';

export interface DecisionSection {
  readonly id: NodeId;
  readonly kind: DecisionSectionKind;
  readonly blocks: readonly DocBlock[];
}

export interface DecisionDocContent {
  readonly kind: 'decision_doc';
  readonly schemaVersion: number;
  readonly sections: readonly DecisionSection[];
}

// ---------------------------------------------------------------------------
// §7 — RACI (rows + matrix).
// ---------------------------------------------------------------------------

export type RaciAssignment = 'responsible' | 'accountable' | 'consulted' | 'informed';

export interface RaciRow {
  readonly id: NodeId;
  readonly task: string;
  readonly ownerId: NodeId;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly dependencyIds: readonly NodeId[];
}

export interface RaciMatrixEntry {
  readonly rowId: NodeId;
  readonly personId: NodeId;
  readonly assignment: RaciAssignment;
}

export interface RaciContent {
  readonly kind: 'raci';
  readonly schemaVersion: number;
  readonly rows: readonly RaciRow[];
  readonly matrix: readonly RaciMatrixEntry[];
}

// ---------------------------------------------------------------------------
// §8 — Research report (typed research blocks).
// ---------------------------------------------------------------------------

export type ResearchBlockKind =
  | 'summary'
  | 'finding'
  | 'claim'
  | 'citation'
  | 'hedging'
  | 'assumption'
  | 'appendix';

export interface ResearchBlock {
  readonly id: NodeId;
  readonly kind: ResearchBlockKind;
  readonly text: string;
  /**
   * Ids of research blocks cited by this block (e.g. a `finding`
   * citing two `citation` blocks). Drives coverage scoring in
   * V10-ART-009 (rationale + citations bundle).
   */
  readonly citesBlockIds: readonly NodeId[];
}

export interface ResearchReportContent {
  readonly kind: 'research_report';
  readonly schemaVersion: number;
  readonly blocks: readonly ResearchBlock[];
}

// ---------------------------------------------------------------------------
// §9 — Discriminated union.
// ---------------------------------------------------------------------------

export type ArtifactCanonicalContent =
  | SlideDeckContent
  | SpreadsheetContent
  | MemoContent
  | RichNoteContent
  | DecisionDocContent
  | RaciContent
  | ResearchReportContent;

// ---------------------------------------------------------------------------
// §10 — Invariants + helpers.
// ---------------------------------------------------------------------------

export class DuplicateNodeIdError extends Error {
  public readonly duplicates: readonly NodeId[];
  constructor(duplicates: readonly NodeId[]) {
    super(`Duplicate NodeIds in canonical content: ${duplicates.map(String).join(', ')}`);
    this.name = 'DuplicateNodeIdError';
    this.duplicates = duplicates;
  }
}

/**
 * Collects every NodeId reachable from the content root, in
 * deterministic order. Used by `assertNodeIdsUnique`, mutation diff
 * generators, and the export-integrity hasher.
 */
export function collectNodeIds(content: ArtifactCanonicalContent): readonly NodeId[] {
  const out: NodeId[] = [];
  switch (content.kind) {
    case 'slide_deck': {
      for (const slide of content.slides) {
        out.push(slide.id);
        for (const slot of slide.layout.slotIds) out.push(slot);
        for (const block of slide.blocks) out.push(block.id);
      }
      break;
    }
    case 'spreadsheet': {
      for (const ref of Object.keys(content.cells)) {
        out.push(content.cells[ref].id);
        for (const dep of content.cells[ref].dependsOn) out.push(dep);
      }
      for (const range of content.namedRanges) out.push(range.id);
      for (const chart of content.charts) {
        out.push(chart.id);
        for (const boundId of chart.boundRangeIds) out.push(boundId);
      }
      break;
    }
    case 'memo':
    case 'rich_note': {
      for (const block of content.blocks) out.push(block.id);
      break;
    }
    case 'decision_doc': {
      for (const section of content.sections) {
        out.push(section.id);
        for (const block of section.blocks) out.push(block.id);
      }
      break;
    }
    case 'raci': {
      for (const row of content.rows) {
        out.push(row.id);
        out.push(row.ownerId);
        for (const depId of row.dependencyIds) out.push(depId);
      }
      for (const entry of content.matrix) {
        out.push(entry.rowId);
        out.push(entry.personId);
      }
      break;
    }
    case 'research_report': {
      for (const block of content.blocks) {
        out.push(block.id);
        for (const citeId of block.citesBlockIds) out.push(citeId);
      }
      break;
    }
  }
  return out;
}

/**
 * Asserts that every **owned** NodeId is unique. "Owned" means an id
 * declared by a node-with-an-id (Slide.id, Cell.id, Block.id, etc.),
 * not a reference (`dependsOn`, `citesBlockIds`, `slotIds`) — those
 * are allowed to repeat because they point at ownership sites.
 *
 * This is the invariant V10-ART-022 runs at write time; duplicate
 * ownership ids would break node-targeted mutations.
 */
export function assertNodeIdsUnique(content: ArtifactCanonicalContent): void {
  const owned = collectOwnedNodeIds(content);
  const seen = new Set<NodeId>();
  const duplicates: NodeId[] = [];
  for (const id of owned) {
    if (seen.has(id)) {
      duplicates.push(id);
    } else {
      seen.add(id);
    }
  }
  if (duplicates.length > 0) {
    throw new DuplicateNodeIdError(duplicates);
  }
}

function collectOwnedNodeIds(content: ArtifactCanonicalContent): readonly NodeId[] {
  const out: NodeId[] = [];
  switch (content.kind) {
    case 'slide_deck': {
      for (const slide of content.slides) {
        out.push(slide.id);
        for (const block of slide.blocks) out.push(block.id);
      }
      break;
    }
    case 'spreadsheet': {
      for (const ref of Object.keys(content.cells)) out.push(content.cells[ref].id);
      for (const range of content.namedRanges) out.push(range.id);
      for (const chart of content.charts) out.push(chart.id);
      break;
    }
    case 'memo':
    case 'rich_note': {
      for (const block of content.blocks) out.push(block.id);
      break;
    }
    case 'decision_doc': {
      for (const section of content.sections) {
        out.push(section.id);
        for (const block of section.blocks) out.push(block.id);
      }
      break;
    }
    case 'raci': {
      for (const row of content.rows) out.push(row.id);
      break;
    }
    case 'research_report': {
      for (const block of content.blocks) out.push(block.id);
      break;
    }
  }
  return out;
}

export function schemaVersionForContent(content: ArtifactCanonicalContent): number {
  return content.schemaVersion;
}

/**
 * Convenience — the canonical current schema version for a type.
 * Useful when a generator builds fresh content and needs to stamp
 * `schemaVersion` without hardcoding the number.
 */
export function currentSchemaVersionForType(type: ArtifactType): number {
  return SCHEMA_VERSION_BY_TYPE[type];
}

/**
 * Narrowing helper: verifies the content's `kind` matches the
 * `ArtifactType`. A `memo` artifact must not carry `slide_deck`
 * content. Used at write time alongside `assertNodeIdsUnique`.
 */
export function assertContentMatchesType(
  type: ArtifactType,
  content: ArtifactCanonicalContent
): void {
  if (type !== content.kind) {
    throw new Error(
      `Artifact type/content mismatch: artifact.type="${type}" but content.kind="${content.kind}"`
    );
  }
}
