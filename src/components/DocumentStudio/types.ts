/**
 * Consultify Document Studio — Frontend Types (MVP-1).
 *
 * Mirrors the backend types in
 * server/src/services/documentStudio/documentStudioTypes.ts.
 */

export type DocumentTypeKey =
  | 'executive_memo'
  | 'decision_memo'
  | 'project_status_report'
  | 'steering_committee_report'
  | 'benefits_tracking_report'
  | 'portfolio_overview'
  | 'ai_audit_report'
  | 'interview_summary_report'
  | 'digital_transformation_roadmap'
  | 'business_case'
  | 'sales_proposal'
  | 'client_discovery_report'
  | 'workshop_summary'
  | 'risk_register_report'
  | 'sop_document'
  | 'implementation_plan'
  | 'change_management_plan'
  | 'board_report'
  | 'research_report'
  | 'due_diligence_note'
  | 'internal_policy_document'
  | 'client_final_report'
  | 'generic_document';

export type DocumentLanguageStyle = 'formal' | 'consulting' | 'legal' | 'narrative';
export type CommunicationRegister = 'executive' | 'professional' | 'technical' | 'narrative';
export type DocumentDensity = 'concise' | 'standard' | 'detailed' | 'comprehensive';
export type DocumentGoal = 'inform' | 'decide' | 'approve' | 'recommend' | 'align';
export type DocumentConfidentiality = 'internal' | 'client_confidential' | 'restricted' | 'public';

// Slice E5.6 — frontend mirror of the server-side DocumentSourceRef
// with two backwards-compatible source-version-pinning fields
// (NFR-17). Pre-E5.6 schemas omit `sourceVersion` / `sourceSnapshotId`
// and consumers MUST treat the omission as "version unspecified".
// The right-panel Sources tab (FE-E2) renders a "drift detected"
// chip when a sourceRef carries a `sourceVersion` that diverges from
// the live source, and exposes the `sourceSnapshotId` as a one-click
// "render against pinned snapshot" affordance.
export interface DocumentSourceRef {
  sourceType: string;
  sourceId: string;
  sourceTitle?: string;
  /** Inline evidence entered for a template-required source binding. */
  sourceExcerpt?: string;
  sourceVersion?: string;
  sourceSnapshotId?: string;
}

export interface DocumentIntake {
  title?: string;
  description: string;
  documentType?: DocumentTypeKey;
  language?: 'pl' | 'en';
  audience?: string[];
  goal?: DocumentGoal;
  communicationRegister?: CommunicationRegister;
  density?: DocumentDensity;
  languageStyle?: DocumentLanguageStyle;
  confidentiality?: DocumentConfidentiality;
  sourceHints?: DocumentSourceRef[];
}

export interface DocumentOutlineSection {
  title: string;
  level: 1 | 2 | 3;
  purpose: string;
  expectedLengthHint: 'short' | 'medium' | 'long';
}

export interface DocumentOutline {
  documentType: DocumentTypeKey;
  title: string;
  sections: DocumentOutlineSection[];
  recommendedDensity: DocumentDensity;
  recommendedRegister: CommunicationRegister;
  recommendedLanguageStyle: DocumentLanguageStyle;
}

export interface DocumentBlock {
  blockId: string;
  type: string;
  content: unknown;
  sourceRef?: DocumentSourceRef;
  isAssumption?: boolean;
}

/**
 * Slice E17.charts (FR-22) — frontend mirror of the canonical
 * chart payload. The FE-E2 chart preview consumes this when
 * `block.type === 'chart'`. Server-side full validation lives in
 * `documentStudioTypes.ts`; the FE narrows opaque `block.content`
 * to this shape before handing it to the chart library.
 */
export type DocumentChartKind = 'bar' | 'line' | 'pie' | 'donut' | 'scatter' | 'area';

export interface DocumentChartSeries {
  label: string;
  values: number[];
  color?: string;
}

export interface DocumentChartBlockContent {
  kind: DocumentChartKind;
  title: string;
  categories?: string[];
  xAxisLabel?: string;
  yAxisLabel?: string;
  series: DocumentChartSeries[];
  caption?: string;
}

export interface DocumentSection {
  sectionId: string;
  orderIndex: number;
  level: 1 | 2 | 3;
  title: string;
  purpose?: string;
  blocks: DocumentBlock[];
  sourceRefs: DocumentSourceRef[];
}

/**
 * Slice E15.artifact (§15.1) — frontend mirror of the four explicit
 * spec §8.1 reference fields added on the server side. All optional /
 * backwards-compatible. The FE-E2 Properties tab uses these to render
 * "Template: X v1.2", "Source pack: Y", "Client: Z", "Owner: @user"
 * without having to chase cross-service joins. Pre-E15.artifact
 * artifacts simply omit the fields and the FE renders the legacy
 * behaviour (no Properties row for that pointer).
 */
export interface DocumentTemplateRef {
  templateId: string;
  templateVersion: string;
}

export interface DocumentSchema {
  documentId: string;
  artifactId: string;
  title: string;
  documentType: DocumentTypeKey;
  language: 'pl' | 'en';
  audience: string[];
  goal: DocumentGoal;
  communicationRegister: CommunicationRegister;
  density: DocumentDensity;
  languageStyle: DocumentLanguageStyle;
  confidentiality: DocumentConfidentiality;
  sections: DocumentSection[];
  sourceRefs: DocumentSourceRef[];
  templateRef?: DocumentTemplateRef;
  sourcePackId?: string;
  clientId?: string;
  owner?: string;
  createdAt?: string;
  /**
   * P0 fix — manual-edit autosave optimistic-lock version. Mirrors the
   * server `DocumentSchema.updatedAt` (documentStudioTypes.ts). The
   * TipTap editor sends this back as `expectedVersion` on
   * `PUT /:artifactId/content` so a stale write 409s instead of
   * silently overwriting newer content (an approved AI proposal, or
   * another tab's autosave).
   */
  updatedAt?: string;
}

/**
 * A4 — frontend mirror of the backend generation-warnings channel. A
 * warning records a point where the generation / export pipeline degraded
 * via a silent fallback (LLM prose failure, chart rasterization fallback,
 * cover-logo unavailable). Surfaced to the user as a discreet "generated
 * with limitations" chip on the document panel.
 */
export type DocumentGenerationWarningScope = 'document' | 'section' | 'block' | 'export';

export interface DocumentGenerationWarning {
  code: string;
  scope: DocumentGenerationWarningScope;
  sectionId?: string;
  blockId?: string;
  message: string;
  occurredAt: string;
}

// Slice E3.5 widened from 3 → 5 scopes to match the SSOT 5-scope
// editor doctrine (local / section / global / methodology / source).
// Slice E3.6 completes the 6-scope doctrine by adding `transformative`:
// the user has explicitly authorized a dramatic rebuild; the service
// relaxes structural guardrails but keeps absolute safety caps and
// tags the audit trail with `authority: 'user_explicit_rebuild'`.
export type DocumentEditorScope =
  'local' | 'section' | 'global' | 'methodology' | 'source' | 'transformative';
export type DocumentProposalStatus = 'proposed' | 'approved' | 'rejected' | 'executed';

/**
 * Slice E15.4.edit (§15.4) — frontend mirror. Adds the spec §8.4
 * substrate fields: `editType`, `proposedChanges[]`, and
 * `versionBeforeId` / `versionAfterId` snapshot links. All
 * backwards-compatible / optional. The FE-E2 review UI uses
 * `proposedChanges` (when present) for the structured per-target
 * change list, and falls back to the aggregate `diff` when absent.
 */
export type DocumentEditType =
  'rewrite' | 'replace' | 'restructure' | 'annotate' | 'expand' | 'condense' | 'reformat';

export interface DocumentEditTargetedChange {
  targetSectionId: string;
  targetBlockId?: string;
  before: string;
  after: string;
  editType?: DocumentEditType;
}

export interface DocumentEditorProposal {
  proposalId: string;
  artifactId: string;
  scope: DocumentEditorScope;
  instruction: string;
  sectionId?: string;
  blockId?: string;
  affectedSectionIds: string[];
  /** Optional per-block LLM rewrites; applied at approval time. */
  blockRewrites?: Record<string, string>;
  /** True when the LLM refiner produced any rewrites for this proposal. */
  llmRefined?: boolean;
  status: DocumentProposalStatus;
  diff: {
    before: string;
    after: string;
  };
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  executedAt?: string;
  editType?: DocumentEditType;
  proposedChanges?: DocumentEditTargetedChange[];
  versionBeforeId?: string;
  versionAfterId?: string;
}

export interface DocumentAuditEntry {
  auditId: string;
  artifactId: string;
  proposalId?: string;
  action: 'proposal_created' | 'proposal_approved' | 'proposal_rejected' | 'proposal_executed';
  actorId: string;
  occurredAt: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// QA Engine — MVP-3 hardening (frontend mirror).
// =============================================================================

// Slice E5.6.qa — `source_drift` joins as the 11th canonical category.
// It is twinned with `sources` (placed immediately after) and is
// NON-BLOCKING by design: pre-E5.6 schemas legitimately have only
// unpinned refs and we MUST NOT soft-block their export the moment
// the QA pipeline learns about pinning. The FE-E2 right-panel
// Sources tab uses these advisory findings to surface a "pin
// snapshot" affordance per ref.
export type DocumentQaCategory =
  | 'brand'
  | 'language'
  | 'completeness'
  | 'sources'
  | 'source_drift'
  | 'methodology'
  | 'executive'
  | 'risk'
  | 'data'
  | 'format'
  | 'export';

export type DocumentQaSeverity = 'low' | 'medium' | 'high';

export interface DocumentQaFinding {
  findingId: string;
  severity: DocumentQaSeverity;
  message: string;
  sectionId?: string;
  blockId?: string;
  code?: string;
}

export interface DocumentQaCategoryReport {
  category: DocumentQaCategory;
  score: number;
  findings: DocumentQaFinding[];
  blocking: boolean;
  summary: string;
}

export interface DocumentQaReport {
  artifactId: string;
  organizationId: string;
  generatedAt: string;
  anyBlocking: boolean;
  categories: DocumentQaCategoryReport[];
  /**
   * A3 — deterministic fabrication signal (unsupported precise-looking
   * numbers without an "(assumption)" marker). Additive, non-blocking
   * unless the export-gate marks the export itself as blocked. Absent
   * when the detector failed server-side (fail-soft).
   */
  fabrication?: {
    count: number;
    sample: string[];
  };
}

export interface DocumentStudioPolicy {
  /** True when the current user can bypass the export QA gate (audited). */
  canOverrideQa: boolean;
  /** Effective role the policy was resolved for (informational). */
  role: string | null;
}

// =============================================================================
// MVP-2 — Document Template Architect (frontend mirror)
// =============================================================================

export type TemplateCategory =
  | 'memo'
  | 'report'
  | 'audit'
  | 'business_case'
  | 'proposal'
  | 'sop'
  | 'plan'
  | 'governance'
  | 'discovery'
  | 'other';

export type TemplateStatus = 'draft' | 'approved' | 'deprecated';

/**
 * Slice E14.blueprint (gap-vs-target §15.3) — frontend mirror of the
 * extended blueprint contract. Adds 4 backwards-compatible optional
 * fields so the Template Architect FE surface (and the Mode-3
 * generation review UI) can render per-section input checklists,
 * formatting style hints, and per-section approval requirements.
 * See `documentStudioTypes.ts` (server) for the full contract.
 *
 * Pre-E14.blueprint templates omit all four fields; the FE MUST
 * tolerate them being `undefined` and render the legacy 5-field
 * shape unchanged.
 */
export interface TemplateSectionBlueprint {
  title: string;
  level: 1 | 2 | 3;
  purpose: string;
  required: boolean;
  expectedLengthHint: 'short' | 'medium' | 'long';
  requiredData?: string[];
  optionalData?: string[];
  formattingStyle?: string;
  approvalRequired?: boolean;
  /**
   * Optional 2-4 short thematic guidance phrases for this section — content
   * STRUCTURE guidance, never fabricated facts/numbers (this is a reusable
   * template, not a specific document). Mirrors the Deck Template
   * Architect's `contentHints` field. `undefined` means "no guidance yet".
   */
  contentHints?: string[];
  /**
   * Optional one-sentence thesis the section should argue/prove — content
   * guidance only, never a fabricated conclusion. `undefined` means "no
   * guidance yet".
   */
  keyMessage?: string;
  /**
   * Optional 2-6 short labels naming what data/input to collect before this
   * section can be written — categories of evidence to gather, never
   * invented values. `undefined` means "no guidance yet".
   */
  dataNeeded?: string[];
  /**
   * Optional short description of the type of evidence/source that should
   * back this section's claims — describes a category of proof, never a
   * specific fabricated citation. `undefined` means "no guidance yet".
   */
  suggestedEvidence?: string;
}

export interface TemplateExportRules {
  docx: boolean;
  pdf: boolean;
  markdown: boolean;
  approvalRequiredForExport: boolean;
}

// Slice E14 — frontend mirror of the server-side DocumentTemplate
// product fields. All fields are OPTIONAL and pre-E14 templates omit
// them; consumers MUST treat the omission as "no signal yet". The
// FE-E2 template picker uses these fields to power the FR-06
// "discover the right template" experience: usage-based sort, quality
// score with sample-size disclosure, persona / region / brand chip
// filters, and dependency-gated visibility.
/**
 * Fala 1 (2026-07-28) — "wzorzec kolorów" (N31). Frontend mirror of the
 * server `FormattingSchema`. Template Architect now edits the core Word
 * layout controls, so these fields must remain structurally aligned.
 */
export interface DocumentTemplateFormattingSchema {
  fonts: { body: string; heading: string; mono?: string };
  headingStyles: { h1: string; h2: string; h3: string };
  tableStyles: { default: string };
  listStyles: { bullet: string; numbered: string };
  page: {
    size: 'A4' | 'Letter';
    marginsCm: { top: number; bottom: number; left: number; right: number };
  };
  headers: { enabled: boolean; content?: string };
  footers: {
    enabled: boolean;
    pageNumbering: boolean;
    confidentialityLabel: boolean;
    content?: string;
    pageNumberingFormat?: string;
  };
  toc: boolean;
  coverPage: boolean;
  appendixStyle: 'lettered' | 'numbered' | 'none';
  citationStyle: 'inline_marker' | 'footnote' | 'endnote';
  colorTemplateId?: string | null;
}

export interface DocumentTemplate {
  templateId: string;
  organizationId: string;
  name: string;
  category: TemplateCategory;
  documentType: DocumentTypeKey;
  purpose: string;
  audience: string[];
  language: 'pl' | 'en';
  languageStyle: DocumentLanguageStyle;
  communicationRegister: CommunicationRegister;
  density: DocumentDensity;
  confidentiality: DocumentConfidentiality;
  requiredInputs: string[];
  sectionBlueprint: TemplateSectionBlueprint[];
  /** Fala 1 (2026-07-28) — optional; pre-Fala-1 templates omit it. */
  formattingSchema?: DocumentTemplateFormattingSchema;
  exportRules: TemplateExportRules;
  status: TemplateStatus;
  version: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  deprecatedBy?: string;
  deprecatedAt?: string;
  notes?: string;
  // Slice E14 — product fields (all optional, backwards-compatible).
  usageCount?: number;
  lastUsedAt?: string;
  feedbackQualityScore?: number;
  feedbackSampleSize?: number;
  personaTags?: string[];
  regionTags?: string[];
  brandTags?: string[];
  dependencyTags?: string[];
}

export interface TemplateDraftInput {
  name?: string;
  category?: TemplateCategory;
  documentType?: DocumentTypeKey;
  purpose: string;
  audience?: string[];
  language?: 'pl' | 'en';
  languageStyle?: DocumentLanguageStyle;
  communicationRegister?: CommunicationRegister;
  density?: DocumentDensity;
  confidentiality?: DocumentConfidentiality;
  requiredInputs?: string[];
  notes?: string;
}

export interface TemplateAuditEntry {
  auditId: string;
  templateId: string;
  organizationId: string;
  action: 'template_drafted' | 'template_updated' | 'template_approved' | 'template_deprecated';
  actorId: string;
  occurredAt: string;
  details?: Record<string, unknown>;
}

export type DocumentStudioMode = 'mode_1' | 'mode_2' | 'mode_3';

// =============================================================================
// FE-E3/FE-E4/FR-37 — right-rail review and sharing surfaces.
// =============================================================================

export type DocumentCommentStatus = 'open' | 'resolved';

export type DocumentCommentAnchor =
  | { kind: 'document' }
  | { kind: 'section'; sectionId: string }
  | { kind: 'block'; sectionId: string; blockId: string };

export interface DocumentComment {
  commentId: string;
  threadId: string;
  artifactId: string;
  organizationId: string;
  parentCommentId?: string;
  anchor: DocumentCommentAnchor;
  authorId: string;
  body: string;
  status: DocumentCommentStatus;
  createdAt: string;
  updatedAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolveReason?: string;
  reopenedBy?: string;
  reopenedAt?: string;
  deletedBy?: string;
  deletedAt?: string;
}

export interface DocumentCommentThread {
  threadId: string;
  artifactId: string;
  organizationId: string;
  anchor: DocumentCommentAnchor;
  status: DocumentCommentStatus;
  root: DocumentComment;
  replies: DocumentComment[];
  createdAt: string;
  updatedAt: string;
}

/**
 * B5 — frontend mirror of the server's `DocumentCommentSectionCounts`
 * (GET /:artifactId/comments/counts). Powers the right-rail tool badge
 * and the Open/Resolved filter counters.
 */
export interface DocumentCommentSectionCounts {
  artifactId: string;
  organizationId: string;
  totalOpen: number;
  totalResolved: number;
  /** Per-section breakdown; sections with zero threads are omitted. */
  perSection: Record<string, { open: number; resolved: number }>;
  /** Per-block breakdown — only `'block'`-anchored threads contribute. */
  perBlock: Record<string, { open: number; resolved: number }>;
}

export type DocumentAccessHistorySource = 'document_audit' | 'share_link' | 'approval';

export interface DocumentAccessHistoryEntry {
  entryId: string;
  source: DocumentAccessHistorySource;
  artifactId: string;
  organizationId: string;
  actorId: string;
  action: string;
  occurredAt: string;
  sourceId?: string;
  details?: Record<string, unknown>;
}

export type DocumentShareLinkAccessScope = 'read' | 'comment' | 'download' | 'edit';
export type DocumentShareLinkStatus = 'active' | 'revoked' | 'expired';

export interface DocumentShareLinkRuntimeStatus {
  effectiveStatus: DocumentShareLinkStatus;
  isUsable: boolean;
  reason?: 'revoked' | 'expired';
}

export interface DocumentShareLink {
  shareLinkId: string;
  artifactId: string;
  organizationId: string;
  token: string;
  tokenHash?: string;
  accessScope: DocumentShareLinkAccessScope;
  status: DocumentShareLinkStatus;
  runtimeStatus?: DocumentShareLinkRuntimeStatus;
  expiresAt?: string;
  label?: string;
  revokedReason?: string;
  createdBy: string;
  createdAt: string;
  revokedBy?: string;
  revokedAt?: string;
  consumeCount: number;
  lastConsumedAt?: string;
}

export type AudienceProfileStatus = 'draft' | 'active' | 'archived';
export type AudienceProfileExecutiveSummaryPolicy = 'preserve' | 'expand' | 'drop';
export type AudienceProfileAppendixPolicy = 'preserve' | 'drop';
export type AudienceProfileJargonPolicy = 'as_is' | 'plain_language';

export interface AudienceProfileTagFilter {
  include?: string[];
  exclude?: string[];
}

export interface AudienceProfile {
  profileId: string;
  organizationId: string;
  name: string;
  description?: string;
  status: AudienceProfileStatus;
  version: string;
  audienceLabels: string[];
  registerOverride?: CommunicationRegister;
  densityOverride?: DocumentDensity;
  languageStyleOverride?: DocumentLanguageStyle;
  sectionFilters: AudienceProfileTagFilter;
  blockFilters: AudienceProfileTagFilter;
  executiveSummaryPolicy: AudienceProfileExecutiveSummaryPolicy;
  appendixPolicy: AudienceProfileAppendixPolicy;
  jargonPolicy: AudienceProfileJargonPolicy;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVariantProvenance {
  sourceDocumentId: string;
  sourceArtifactId: string;
  profileId: string;
  profileVersion: string;
  projectedAt: string;
  sectionsKept: string[];
  sectionsDropped: { sectionId: string; reason: string }[];
  blocksDropped: number;
}

export interface DocumentVariant {
  schema: DocumentSchema;
  provenance: DocumentVariantProvenance;
}

export interface DocumentVariantSummary {
  profile: AudienceProfile;
  plan: string[];
}

export type DocumentApprovalStatus =
  'pending' | 'approved' | 'rejected' | 'changes_requested' | 'cancelled';
export type DocumentApprovalDecisionKind = 'approve' | 'reject' | 'request_changes';
export type DocumentApprovalQuorumPolicy = 'unanimous' | 'majority' | 'single_approval';

export interface DocumentApprovalParticipant {
  userId: string;
  role?: string;
  required: boolean;
}

export interface DocumentApprovalDecision {
  decisionId: string;
  approvalId: string;
  reviewerId: string;
  kind: DocumentApprovalDecisionKind;
  comment?: string;
  occurredAt: string;
}

export interface DocumentApprovalRequest {
  approvalId: string;
  organizationId: string;
  artifactId: string;
  requestedBy: string;
  participants: DocumentApprovalParticipant[];
  quorumPolicy: DocumentApprovalQuorumPolicy;
  status: DocumentApprovalStatus;
  decisions: DocumentApprovalDecision[];
  reason?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type DocumentContentBlockStatus = 'draft' | 'active' | 'archived';

export interface DocumentContentBlockTemplate {
  contentBlockId: string;
  organizationId: string;
  name: string;
  description?: string;
  status: DocumentContentBlockStatus;
  version: string;
  tags: string[];
  documentTypes: DocumentTypeKey[];
  languageScope: 'pl' | 'en' | 'all';
  block: Omit<DocumentBlock, 'blockId'>;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type DocumentSectionDiffKind = 'added' | 'removed' | 'modified' | 'reordered' | 'unchanged';
export type DocumentBlockDiffKind = 'added' | 'removed' | 'modified' | 'unchanged';

export interface DocumentBlockDiffEntry {
  kind: DocumentBlockDiffKind;
  blockId: string;
  blockType: string | null;
  beforeText: string | null;
  afterText: string | null;
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
  hasChanges: boolean;
  sectionDiffs: DocumentSectionDiffEntry[];
  stats: DocumentSchemaDiffStats;
}

export interface DocumentSchemaDiffResponse {
  baseSnapshot: {
    versionId: string;
    versionNumber: number;
    capturedAt: string;
    label?: string;
    origin?: string;
  };
  comparedAt: string;
  summary: string;
  diff: DocumentSchemaDiff;
}

/**
 * B3 — summary projection of a server-side `DocumentVersionSnapshot`
 * (documentStudioTypes.ts) as listed by `GET /:artifactId/snapshots`.
 * The full snapshot also carries `schema`; the diff panel only needs
 * the identity/metadata fields to populate the baseline picker.
 */
export interface DocumentVersionSnapshotSummary {
  versionId: string;
  artifactId: string;
  versionNumber: number;
  capturedAt: string;
  capturedBy: string;
  label?: string;
  reason?: string;
  origin?: string;
}
