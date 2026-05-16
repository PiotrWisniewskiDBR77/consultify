/**
 * V10-ART-002 — ArtifactType registry (Wave A seed, schema-only).
 *
 * Implements R-ARTIFACT-2 from
 * `docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md#v10-art-002`.
 *
 * Scope (Wave A seed)
 * -------------------
 * Promotes the seven canonical artifact types from the V10-ART-001
 * placeholder into a first-class registry with per-type
 * `ArtifactTypeSpec`. Adding a new artifact type is a single-file change
 * (add the union member + registry entry); CI invariant 37 (master plan
 * §6) will trip if they drift.
 *
 * Re-exports `ArtifactType` from `./Artifact` so downstream code can
 * import the enum from either location without duplicate unions. The
 * `@placeholder` tag on `Artifact.ts#ArtifactType` is retained for one
 * PR as a migration aid; a later pass will drop the placeholder
 * comment.
 *
 * No per-type content schemas are declared here. Those land with
 * V10-ART-006, V10-ART-016..020 (the per-type implementation tickets).
 * Wave A seed only pins the *registry shape*.
 *
 * CI contract
 * -----------
 * - Unit test (`ArtifactTypeRegistry.test.ts`) asserts registry
 *   completeness (every `ArtifactType` has an entry), uniqueness
 *   (canonicalSchemaPath + renderer per type), and spec-field shape.
 * - V10 registry invariant 33 pins the owning ticket
 *   (`V10-ART-002` → block `artifact`).
 */

import type { ArtifactType, DataClassification } from './Artifact';

export type { ArtifactType } from './Artifact';

// ---------------------------------------------------------------------------
// §1 — OpType subset supported by artifact content mutations.
// ---------------------------------------------------------------------------
// The full OpType union lives in `src/models/agent/ExecutionProposalV1.ts`
// and will be promoted to its own file at V10-AGT-003. Artifact mutation
// ops are a *subset* of that union (per dev plan): any mutation on an
// artifact must be one of the ops listed here.

export type ArtifactMutationOp =
  | 'json_patch'
  | 'replace_text'
  | 'move_block'
  | 'update_cell_formula'
  | 'update_chart_binding';

export const ARTIFACT_MUTATION_OPS: readonly ArtifactMutationOp[] = [
  'json_patch',
  'replace_text',
  'move_block',
  'update_cell_formula',
  'update_chart_binding',
] as const;

// ---------------------------------------------------------------------------
// §2 — Export formats catalogue.
// ---------------------------------------------------------------------------

export type ExportFormat = 'pdf' | 'pptx' | 'xlsx' | 'docx' | 'md' | 'json' | 'csv';

export const EXPORT_FORMATS: readonly ExportFormat[] = [
  'pdf',
  'pptx',
  'xlsx',
  'docx',
  'md',
  'json',
  'csv',
] as const;

// ---------------------------------------------------------------------------
// §3 — Per-type spec.
// ---------------------------------------------------------------------------

export interface ArtifactTypeSpec {
  /** The artifact type this spec describes. */
  readonly type: ArtifactType;
  /**
   * Path (relative to repo root) of the canonical content schema file
   * for this type. Per-type schema tickets (V10-ART-006,
   * V10-ART-016..020) create these files; at Wave A seed the paths
   * are declared but the files do not yet exist. The companion CI
   * invariant (which asserts the file resolves on disk) flips from
   * soft to hard when V10-ART-006 lands — see the TODO in
   * `ArtifactTypeRegistry.test.ts`.
   */
  readonly canonicalSchemaPath: string;
  /** Renderer component name (React class / hook identifier). */
  readonly renderer: string;
  /** Subset of OpType kinds valid for this artifact's mutations. */
  readonly supportedOps: readonly ArtifactMutationOp[];
  /** Default DataClassification for freshly created artifacts of this type. */
  readonly defaultClassification: DataClassification;
  /** Export formats the artifact can be serialised to. */
  readonly exportFormats: readonly ExportFormat[];
}

// ---------------------------------------------------------------------------
// §4 — The registry (exhaustive over ArtifactType).
// ---------------------------------------------------------------------------

export const ARTIFACT_TYPE_REGISTRY = {
  slide_deck: {
    type: 'slide_deck',
    canonicalSchemaPath: 'src/models/artifact/schemas/slideDeck.ts',
    renderer: 'SlideDeckRenderer',
    supportedOps: ['json_patch', 'replace_text', 'move_block'],
    defaultClassification: 'Internal',
    exportFormats: ['pptx', 'pdf', 'json'],
  },
  spreadsheet: {
    type: 'spreadsheet',
    canonicalSchemaPath: 'src/models/artifact/schemas/spreadsheet.ts',
    renderer: 'SpreadsheetRenderer',
    supportedOps: ['json_patch', 'update_cell_formula', 'update_chart_binding'],
    defaultClassification: 'Internal',
    exportFormats: ['xlsx', 'csv', 'pdf', 'json'],
  },
  memo: {
    type: 'memo',
    canonicalSchemaPath: 'src/models/artifact/schemas/memo.ts',
    renderer: 'MemoRenderer',
    supportedOps: ['json_patch', 'replace_text', 'move_block'],
    defaultClassification: 'Internal',
    exportFormats: ['docx', 'md', 'pdf', 'json'],
  },
  decision_doc: {
    type: 'decision_doc',
    canonicalSchemaPath: 'src/models/artifact/schemas/decisionDoc.ts',
    renderer: 'DecisionDocRenderer',
    supportedOps: ['json_patch', 'replace_text', 'move_block'],
    defaultClassification: 'Confidential',
    exportFormats: ['docx', 'pdf', 'md', 'json'],
  },
  raci: {
    type: 'raci',
    canonicalSchemaPath: 'src/models/artifact/schemas/raci.ts',
    renderer: 'RaciRenderer',
    supportedOps: ['json_patch'],
    defaultClassification: 'Internal',
    exportFormats: ['xlsx', 'csv', 'pdf', 'json'],
  },
  research_report: {
    type: 'research_report',
    canonicalSchemaPath: 'src/models/artifact/schemas/researchReport.ts',
    renderer: 'ResearchReportRenderer',
    supportedOps: ['json_patch', 'replace_text', 'move_block'],
    defaultClassification: 'Confidential',
    exportFormats: ['pdf', 'docx', 'md', 'json'],
  },
  rich_note: {
    type: 'rich_note',
    canonicalSchemaPath: 'src/models/artifact/schemas/richNote.ts',
    renderer: 'RichNoteRenderer',
    supportedOps: ['json_patch', 'replace_text'],
    defaultClassification: 'Internal',
    exportFormats: ['md', 'pdf', 'json'],
  },
} as const satisfies Record<ArtifactType, ArtifactTypeSpec>;

/**
 * Iteration-stable list of types in the canonical order from the dev
 * plan. Tests assert this matches both the registry keys and the
 * `ArtifactType` union.
 */
export const ARTIFACT_TYPES: readonly ArtifactType[] = [
  'slide_deck',
  'spreadsheet',
  'memo',
  'decision_doc',
  'raci',
  'research_report',
  'rich_note',
] as const;

export function getArtifactTypeSpec(type: ArtifactType): ArtifactTypeSpec {
  return ARTIFACT_TYPE_REGISTRY[type];
}
