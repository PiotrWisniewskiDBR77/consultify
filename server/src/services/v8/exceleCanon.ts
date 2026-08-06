/**
 * P23 Excele Canon — Final V8
 *
 * Frozen acceptance checklist + rules derived from:
 *   FINAL_IMPLEMENTATION_PLAN_23_EXCELE_2026-03-29.md
 *
 * §2.3  P23-A canon (Excele lane definition)
 * §7.1  Error taxonomy (10 classes)
 * §7.2  Acceptance checklist (10+ points)
 * §4    KIMI evidence mapping
 *
 * Infrastructure consumed:
 *   - artifactRegistryService.ts (registerGovernedTableSheetArtifact, cleanupGhostOutputsByOrigin)
 *   - executionSpineService.ts (propose → review → apply state machine)
 *   - reportsPresModelService.ts (recordCompletedExport)
 *   - WorkbookBuilder.ts + WorkbookSchema.ts + WorkbookGeneratorService.ts (P23-D)
 */

// ────────────────────────────────────────────────────────────────
// §2.3 — Lane definition (frozen)
// ────────────────────────────────────────────────────────────────

export const P23_LANE_DEFINITION = {
  name: 'excele',
  displayName: 'Excele',
  kind: 'bounded_deliverable_sheet_lane',
  outputType: 'sheet' as const,
  canonicalHome: 'outputs_library',
  description:
    'Bounded deliverable sheet lane with KIMI-style split-screen. ' +
    'Not BI/ETL/Tables OS. Delivers workbook-like artifacts with durable identity.',
  nonGoals: [
    'Excel or Google Sheets parity',
    'Full formula, collaboration, and modeling depth',
    'Replacing broader table/database products (P15)',
    'OLAP/BI dashboards',
    'ETL platform',
    'Real-time collaboration / multiplayer editing',
  ],
} as const;

// ────────────────────────────────────────────────────────────────
// Sheet artifact lifecycle states
// ────────────────────────────────────────────────────────────────

export const P23_LIFECYCLE_STATES = [
  'draft',
  'generating',
  'generated',
  'persisted',
  'listed',
  'reopened',
  'exporting',
  'exported',
  'failed',
  'archived',
] as const;
export type P23LifecycleState = (typeof P23_LIFECYCLE_STATES)[number];

// ────────────────────────────────────────────────────────────────
// §2.3 — Workflow: propose → review → apply (no silent apply)
// ────────────────────────────────────────────────────────────────

export const P23_AI_PROPOSAL_RULES = {
  noSilentApply: true,
  flow: 'propose → review → apply',
  propose:
    'AI/agent generates proposal (schema/formulas/transforms) as explicit plan/diff without modifying the artifact',
  review: 'User sees diff and chooses: accept/apply, edit proposal, reject; no silent write',
  apply: 'Materialization of changes is a run subject to approve(run) per P17 (ArtifactRun spine)',
  hardInvariant:
    'approve(run) ≠ review(artifact) — run approval is about execution (apply); review is about quality/publish/governance',
  approveRunAuthority: 'P17 (ArtifactRun execution spine)',
  reviewArtifactAuthority: 'P18 (Provenance/review/visibility)',
} as const;

// ────────────────────────────────────────────────────────────────
// §7.1 — Error taxonomy (10 classes)
// ────────────────────────────────────────────────────────────────

export const P23_ERROR_TAXONOMY = {
  import_parse_error: {
    retryable: true,
    userMessage: 'Import failed — file could not be parsed. Check the file format and try again.',
    recovery: ['retry', 'upload_new', 'cancel'],
  },
  schema_mismatch: {
    retryable: false,
    userMessage:
      'Column structure does not match the expected schema. Review the mapping and approve.',
    recovery: ['accept_mapping', 'fix_input', 'reject'],
  },
  type_coercion_error: {
    retryable: false,
    userMessage:
      'Some values could not be converted to the expected type (e.g. text in a number column).',
    recovery: ['apply_with_coercion', 'fix_input', 'reject'],
  },
  validation_failed: {
    retryable: false,
    userMessage:
      'Semantic validation failed (e.g. totals do not add up). Review the checks before applying.',
    recovery: ['override', 'fix_input', 'reject'],
  },
  transform_failed: {
    retryable: true,
    userMessage:
      'A data cleaning/transformation step failed. Rolling back to pre-transform snapshot.',
    recovery: ['retry', 'skip_step', 'rollback'],
  },
  formula_error: {
    retryable: false,
    userMessage:
      'Formula error detected (syntax, references, or #DIV/0!). Affected cells are highlighted.',
    recovery: ['fix_formula', 'remove_formula', 'apply_partial'],
  },
  formula_cycle_detected: {
    retryable: false,
    userMessage:
      'Circular reference detected in formulas. Please resolve the cycle before applying.',
    recovery: ['fix_formula', 'remove_cycle'],
  },
  export_failed: {
    retryable: true,
    userMessage: 'Export failed. You can retry — no ghost output was created.',
    recovery: ['retry'],
  },
  persistence_failed: {
    retryable: true,
    userMessage: 'Workbook persistence failed. You can retry — no ghost output was created.',
    recovery: ['retry'],
  },
  access_denied: {
    retryable: false,
    userMessage: 'You do not have permission to perform this action. Contact your administrator.',
    recovery: ['request_access'],
  },
  stale_snapshot: {
    retryable: true,
    userMessage: 'The sheet was modified since you started editing. Rebasing your changes.',
    recovery: ['rebase_proposal', 'regenerate_diff', 'discard'],
  },
} as const;

export type P23ErrorCode = keyof typeof P23_ERROR_TAXONOMY;

/**
 * Creates a structured error for P23 with taxonomy code.
 */
export function createP23Error(code: P23ErrorCode, detail?: string): P23ClassifiedError {
  const entry = P23_ERROR_TAXONOMY[code];
  return {
    code,
    retryable: entry.retryable,
    userMessage: entry.userMessage,
    recovery: [...entry.recovery],
    detail: detail ?? null,
    timestamp: new Date().toISOString(),
  };
}

export interface P23ClassifiedError {
  code: P23ErrorCode;
  retryable: boolean;
  userMessage: string;
  recovery: string[];
  detail: string | null;
  timestamp: string;
}

// ────────────────────────────────────────────────────────────────
// §7.1 — Degraded posture (10 scenarios)
// ────────────────────────────────────────────────────────────────

export const P23_DEGRADED_SCENARIOS: ReadonlyArray<{
  id: number;
  scenario: string;
  errorCode: P23ErrorCode;
  userVisibleState: string;
  nextAction: string;
}> = [
  {
    id: 1,
    scenario: 'Import parse error (corrupted CSV/XLSX)',
    errorCode: 'import_parse_error',
    userVisibleState: 'Import failed with line/cell indication',
    nextAction: 'CTA: Retry / Upload new file / Cancel',
  },
  {
    id: 2,
    scenario: 'Schema mismatch (columns do not match proposal)',
    errorCode: 'schema_mismatch',
    userVisibleState: 'Diff shown; apply blocked until mapping accepted',
    nextAction: 'Accept mapping / Fix input / Reject',
  },
  {
    id: 3,
    scenario: 'Type coercion failure (text in number column)',
    errorCode: 'type_coercion_error',
    userVisibleState: 'Preview of coerced values shown',
    nextAction: 'Apply with coercion / Fix input / Reject',
  },
  {
    id: 4,
    scenario: 'Semantic validation failure (sums mismatch)',
    errorCode: 'validation_failed',
    userVisibleState: 'Check list shown; no apply without override',
    nextAction: 'Override with acknowledgment / Fix / Reject',
  },
  {
    id: 5,
    scenario: 'Transform/cleaning step failure',
    errorCode: 'transform_failed',
    userVisibleState: 'Step indicated; rolled back to pre-transform snapshot',
    nextAction: 'Retry / Skip step / Rollback',
  },
  {
    id: 6,
    scenario: 'Formula syntax or reference error',
    errorCode: 'formula_error',
    userVisibleState: 'Affected cells highlighted; apply stopped or partial',
    nextAction: 'Fix formula / Remove formula / Apply partial',
  },
  {
    id: 7,
    scenario: 'Circular reference in formulas',
    errorCode: 'formula_cycle_detected',
    userVisibleState: 'Cycle warning with repair recommendation',
    nextAction: 'Fix formula / Remove cycle — no hidden auto-fix',
  },
  {
    id: 8,
    scenario: 'Export/conversion failure (XLSX/PDF/CSV)',
    errorCode: 'export_failed',
    userVisibleState: 'Export error with retry; no ghost output in library',
    nextAction: 'Retry export',
  },
  {
    id: 9,
    scenario: 'Permission/visibility conflict',
    errorCode: 'access_denied',
    userVisibleState: 'Action blocked with link to access management',
    nextAction: 'Request access (P18)',
  },
  {
    id: 10,
    scenario: 'Concurrency / stale state (sheet changed between propose and apply)',
    errorCode: 'stale_snapshot',
    userVisibleState: 'Stale warning; rebase or regenerate diff',
    nextAction: 'Rebase proposal / Regenerate diff / Discard',
  },
] as const;

// ────────────────────────────────────────────────────────────────
// §2.3 — Bounded import posture
// ────────────────────────────────────────────────────────────────

export const P23_IMPORT_POSTURE = {
  supportedFormats: ['csv', 'xlsx'] as const,
  maxFileSizeMB: 10,
  maxRows: 50000,
  maxColumns: 200,
  maxSheets: 20,
  status: 'MISSING_INPUT' as const,
  note: 'Import flow not implemented — blocked by MISSING INPUT §6 (no KIMI evidence for import UX)',
} as const;

// ────────────────────────────────────────────────────────────────
// P23-D — Workbook Builder capabilities (bounded declaration)
// ────────────────────────────────────────────────────────────────

export const P23_WORKBOOK_CAPABILITIES = {
  pipeline: ['plan', 'confirm', 'generate', 'review', 'build'] as const,
  formulaSupport: [
    'SUM',
    'AVERAGE',
    'COUNT',
    'IF',
    'VLOOKUP',
    'cross_sheet_references',
    'percentage_of_total',
    'growth_calculations',
  ],
  formattingSupport: [
    'bold',
    'italic',
    'font_size',
    'font_color',
    'background_color',
    'number_format',
    'alignment',
    'wrap_text',
    'borders',
    'freeze_panes',
    'merged_cells',
    'alternating_rows',
    'tab_colors',
    'cell_comments',
    'summary_rows',
  ],
  outputFormat: 'xlsx' as const,
  knownLimits: [
    'No charts (ExcelJS chart API limited)',
    'No pivot tables',
    'No web research auto-integration (researchContext must be passed explicitly)',
    'No inline cell editing in preview',
    'Quality review adds ~2-4s latency per generation',
  ],
} as const;

// ────────────────────────────────────────────────────────────────
// §7 — Anti-duplicate rules
// ────────────────────────────────────────────────────────────────

export const P23_ANTI_DUPLICATE_RULES = {
  noParallelTablesOS: 'Excele is a deliverable sheet lane — for relational truth use Tabele (P15)',
  noSecondLibrary:
    'Sheet artifacts land in Outputs Library (P19) — no parallel "sheet registry v2"',
  noSecondStageEnums: 'Trust-state inherited from P18 — Excele does not invent stage enums',
  singleIdentity:
    'Each Sheet has one identity and one reopen path consistent with artifact canon (P18/P19)',
  workbooksMustRegister:
    'Workbooks generated by P23-D MUST register in artifact registry to be visible in Outputs Library',
} as const;

// ────────────────────────────────────────────────────────────────
// §7.2 — Acceptance checklist (11 points)
// ────────────────────────────────────────────────────────────────

export const P23_ACCEPTANCE_CHECKLIST = [
  {
    id: 1,
    requirement: 'Lane definition: Excele = deliverable sheet lane, not BI/ETL/tables OS',
    section: '§2.3',
  },
  {
    id: 2,
    requirement:
      'No silent apply: propose→review→apply is explicit; apply is a run requiring approve(run)',
    section: '§2.3',
  },
  {
    id: 3,
    requirement: 'approve(run) ≠ review(artifact): separation cited and linked to P17 + P18',
    section: '§2.3',
  },
  {
    id: 4,
    requirement: 'Bounded import posture: explicit limits on formats/sizes (no overclaim)',
    section: '§2.3',
  },
  {
    id: 5,
    requirement: 'Validation + error taxonomy: 10 error classes with recovery paths',
    section: '§7.1',
  },
  {
    id: 6,
    requirement:
      'MISSING INPUT flags: evidence mapping has explicit MISSING INPUT where evidence lacks',
    section: '§6',
  },
  {
    id: 7,
    requirement: 'Governance: home = Outputs Library (P19); trust-state = P18; no parallel truths',
    section: '§7',
  },
  {
    id: 8,
    requirement: 'Anti-duplicate: no parallel tables OS (P15); no second library/registry',
    section: '§7',
  },
  {
    id: 9,
    requirement: 'Degraded posture: 10+ scenarios with recovery and no ghost artifacts',
    section: '§7.1',
  },
  {
    id: 10,
    requirement: 'Index readiness: EXECUTION_INDEX #23 set to verified(evidence)',
    section: '§10',
  },
  {
    id: 11,
    requirement: 'Evidence ledger filled: §10 with commit refs, tests, staging proof, known limits',
    section: '§10',
  },
] as const;

// ────────────────────────────────────────────────────────────────
// Non-goals (explicit from §2.2 + §10)
// ────────────────────────────────────────────────────────────────

export const P23_NON_GOALS = [
  'Excel or Google Sheets parity (explicit non-goal)',
  'Full formula, collaboration, and modeling depth',
  'Replacing broader table/database products (P15 Tabele)',
  'OLAP/BI suite or dashboards',
  'ETL platform or data pipeline',
  'Real-time multiplayer sheet editing',
  'Chart generation (ExcelJS chart API limited — known limit)',
  'Pivot table generation',
  'Code execution panel ("Kimis Computer" — not implemented, MISSING INPUT)',
] as const;

// ────────────────────────────────────────────────────────────────
// Contract identifier
// ────────────────────────────────────────────────────────────────

export const P23_EXCELE_CANON_CONTRACT = 'excele_canon_v1';
