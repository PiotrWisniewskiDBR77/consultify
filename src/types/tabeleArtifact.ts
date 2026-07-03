/**
 * Tabele (Table Studio) artifact preview types.
 *
 * These shapes feed the Word-canvas preview that the Tabele lane
 * renders inside `KimiWorkspaceShell`. They are intentionally
 * Sprint 2 / EPIC-1 US-1.3 minimal: only the fields required by
 * the schema / records / relations / rationale sections that
 * Sprint 3 (EPIC-2) will draw.
 *
 * SSOT:
 * - DRD/consultify/docs/product/work-packets/table-studio-foundation/epics/EPIC-1_FRONTEND_LANE_PARITY.md (US-1.3)
 * - DRD/consultify/docs/product/work-packets/table-studio-foundation/epics/EPIC-3_BACKEND_RELATION_EXPLAINABILITY.md (response shape)
 * - DRD/consultify/docs/product/FINAL_IMPLEMENTATION_PLAN_24_TABELE_2026-05-07.md
 *
 * Additive only — never break existing lanes (Wordy / Excele / Prezentacje).
 */

/**
 * Field block rendered by `TabeleSchemaBlock` (Sprint 3 / EPIC-2 US-2.2).
 *
 * `governanceState` reflects the current Schema-Governance Proposal status:
 * - `committed` — already part of the live schema
 * - `proposed`  — pending proposal awaiting approval
 * - `rejected`  — proposal closed without commit
 *
 * If `governanceState === 'proposed'` then `proposalId` SHOULD point to
 * the open `SchemaProposal.id` so the canvas can deep-link the queue.
 */
export interface TabelePreviewSchemaField {
  fieldId: string;
  name: string;
  /**
   * Field type token from the Table Platform (e.g. 'text' | 'number' |
   * 'date' | 'select' | 'relation' | …). Kept as plain string so
   * additive new field types do not break the preview.
   */
  fieldType: string;
  /**
   * Human-authored field description/help text from the Table Platform, when
   * present. Surfaced as the block caption so each schema field shows its OWN
   * description instead of a shared boilerplate placeholder (HOTFIX #62 UI-M6).
   */
  description?: string;
  governanceState?: 'committed' | 'proposed' | 'rejected';
  proposalId?: string;
}

/**
 * Relation chip rendered by `TabeleRelationChip` (Sprint 3 / EPIC-2 US-2.3).
 *
 * `targetCount` is the count visible to the actor under ACL — the
 * relation-explain endpoint is responsible for filtering.
 */
export interface TabelePreviewRelation {
  fieldId: string;
  fieldName: string;
  targetTableId: string;
  targetTableName: string;
  targetCount: number;
}

/**
 * AI rationale block rendered by `TabeleRationaleSection` (Sprint 3 / EPIC-2 US-2.4).
 *
 * `proposalStatus` mirrors the Schema-Governance lifecycle of the
 * change that produced this rationale, so the canvas can surface a
 * status pill without an extra round-trip.
 */
export interface TabelePreviewRationale {
  summary: string;
  bullets: string[];
  citedSourceIds: string[];
  proposalStatus?: 'pending' | 'approved' | 'rejected' | 'none';
}
