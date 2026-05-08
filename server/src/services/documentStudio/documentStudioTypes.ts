/**
 * Consultify Document Studio — Backend Types (MVP-1)
 *
 * Canonical doctrine: docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_SSOT.md
 * Type taxonomy:      docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_TYPE_TAXONOMY.md
 *
 * MVP-1 boundary: types support Mode 1 (generate without template) only.
 * Modes 2 and 3, the Document Template Architect, the AI Document Editor with
 * full multi-scope support, and the full QA Engine are deferred to later waves.
 */

export type DocumentStudioMode = 'mode_1' | 'mode_2' | 'mode_3';

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

export type DocumentBlockType =
  | 'heading'
  | 'paragraph'
  | 'bullet_list'
  | 'numbered_list'
  | 'table'
  | 'callout'
  | 'quote'
  | 'kpi_strip'
  | 'risk_table'
  | 'image'
  | 'footnote'
  | 'citation';

export interface DocumentBlock {
  blockId: string;
  type: DocumentBlockType;
  content: unknown;
  sourceRef?: DocumentSourceRef;
  isAssumption?: boolean;
  /**
   * Optional audience-tag list — Epic E9 (Audience-driven warianty).
   *
   * When present, the audience projector uses these tags to decide whether
   * the block survives projection for a given AudienceProfile. When omitted,
   * the block is treated as audience-neutral and surfaces in every variant
   * (default-include semantics — backwards compatible with pre-E9 schemas).
   *
   * Tags are free-form strings ('technical_detail', 'engineering_only',
   * 'client_only', 'internal_only', …) and only become meaningful in the
   * presence of an AudienceProfile that filters on them.
   */
  audienceTags?: string[];
}

export type DocumentSectionKind = 'body' | 'appendix';

export interface DocumentSection {
  sectionId: string;
  orderIndex: number;
  level: 1 | 2 | 3;
  title: string;
  purpose?: string;
  blocks: DocumentBlock[];
  sourceRefs: DocumentSourceRef[];
  /**
   * Optional structural classification — Epic E8 (Advanced DOCX).
   *
   *  - `'body'` (default when omitted): part of the main numbered
   *    section sequence (e.g. "1. Executive Summary", "2. Findings").
   *  - `'appendix'`: rendered after the body sequence under the
   *    document's `appendixStyle` numbering scheme (lettered A./B./…,
   *    numbered 1./2./…, or bare titles when `appendixStyle === 'none'`).
   *
   * Schemas authored before E8 do not carry this field. The renderer
   * falls back to a title-prefix heuristic ("Appendix" / "Annex" /
   * "Załącznik") so legacy documents still render with appendix
   * formatting where the author clearly intended it.
   */
  kind?: DocumentSectionKind;
  /**
   * Optional audience-tag list — Epic E9 (Audience-driven warianty).
   *
   * Same semantics as `DocumentBlock.audienceTags` but section-scoped:
   * when present, an AudienceProfile may include / exclude the entire
   * section (and all its blocks) based on these tags. Default-include
   * when omitted to preserve backwards compatibility.
   */
  audienceTags?: string[];
}

/**
 * A reference from a document block / section / artifact to one of its
 * underlying sources. Slice E5.6 adds two backwards-compatible
 * fields for source-version pinning (NFR-17).
 *
 * - `sourceVersion`: semantic version / hash / monotonic id of the
 *   source as it existed when the document was generated. The renderer
 *   and QA pipeline use this field to detect drift ("the source has
 *   advanced beyond the version this document was anchored to") and
 *   to warn approvers when a document is rendered against a source
 *   that has since changed.
 *
 * - `sourceSnapshotId`: optional pointer to a durable snapshot of the
 *   source content (e.g. a `SourcePackVersion` id, a content hash, or
 *   an artifact registry pin). When present, the document can be
 *   rolled back / re-rendered against the exact bytes the author saw
 *   even if the live source has been mutated, archived, or removed.
 *
 * Both fields are optional. Pre-E5.6 schemas omit them; consumers
 * MUST treat the omission as "version unspecified" — the same shape
 * the registry has always produced — and continue to function. Helper
 * `documentSourceRefHasVersionPin()` codifies that contract so callers
 * do not hand-roll truthy checks.
 */
export interface DocumentSourceRef {
  sourceType: string;
  sourceId: string;
  sourceTitle?: string;
  sourceVersion?: string;
  sourceSnapshotId?: string;
}

/**
 * Returns true iff the source ref carries enough version metadata to
 * detect drift. NFR-17 (source-version pinning) requires that any
 * approval-gated render flow can distinguish between "source v3 at
 * generation time" and "source v5 at render time"; this helper
 * encodes the contract used by the renderer + audit pipeline.
 *
 * A source ref qualifies as version-pinned when EITHER:
 *   - `sourceVersion` is a non-empty trimmed string, OR
 *   - `sourceSnapshotId` is a non-empty trimmed string.
 *
 * Refs that have neither field (the legacy default) are treated as
 * unpinned and surface a soft warning in the version-mismatch QA
 * (E5.6 codifies the type; the QA-side warning lands in a follow-up
 * slice on top of this substrate).
 */
export function documentSourceRefHasVersionPin(ref: DocumentSourceRef | undefined | null): boolean {
  if (!ref) return false;
  const versionPinned =
    typeof ref.sourceVersion === 'string' && ref.sourceVersion.trim().length > 0;
  const snapshotPinned =
    typeof ref.sourceSnapshotId === 'string' && ref.sourceSnapshotId.trim().length > 0;
  return versionPinned || snapshotPinned;
}

export interface FormattingSchema {
  fonts: { body: string; heading: string; mono?: string };
  headingStyles: { h1: string; h2: string; h3: string };
  tableStyles: { default: string };
  listStyles: { bullet: string; numbered: string };
  page: {
    size: 'A4' | 'Letter';
    marginsCm: { top: number; bottom: number; left: number; right: number };
  };
  headers: { enabled: boolean };
  footers: { enabled: boolean; pageNumbering: boolean; confidentialityLabel: boolean };
  toc: boolean;
  coverPage: boolean;
  appendixStyle: 'lettered' | 'numbered' | 'none';
  citationStyle: 'inline_marker' | 'footnote' | 'endnote';
}

/**
 * The Document Schema is the canonical structured representation of a document
 * before any DOCX/PDF rendering. It is the source of truth; renderers are derivable.
 */
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
  formattingSchema: FormattingSchema;
  sections: DocumentSection[];
  sourceRefs: DocumentSourceRef[];
  createdAt: string;
  updatedAt: string;
  /**
   * Lifecycle status — Epic E5. Optional on the type to keep historical
   * artifacts (created before E5 shipped) readable; service overlays a
   * default `'draft'` when missing so callers can rely on a value.
   */
  documentStatus?: DocumentStatus;
  statusChangedAt?: string;
  statusChangedBy?: string;
  statusReason?: string;
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

export interface DocumentRunRequest {
  organizationId: string;
  userId: string;
  intake: DocumentIntake;
  outline?: DocumentOutline;
}

// =============================================================================
// QA Engine — MVP-3 hardening (deterministic Brand QA + Language QA).
// =============================================================================

export type DocumentQaCategory =
  | 'brand'
  | 'language'
  | 'completeness'
  | 'sources'
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
  /** Optional code for telemetry / i18n keys ("language_mismatch", "banned_phrase", etc.). */
  code?: string;
}

export interface DocumentQaCategoryReport {
  category: DocumentQaCategory;
  /** 0..100 score where 100 = no findings. Severity-weighted deduction. */
  score: number;
  findings: DocumentQaFinding[];
  /** Whether the score crosses the policy threshold for soft-blocking exports. */
  blocking: boolean;
  /** Human-readable summary the UI can show without iterating findings. */
  summary: string;
}

export interface DocumentQaReport {
  artifactId: string;
  organizationId: string;
  generatedAt: string;
  /** True when ANY category report has `blocking === true`. */
  anyBlocking: boolean;
  categories: DocumentQaCategoryReport[];
}

export interface DocumentRunResult {
  artifactId: string;
  schema: DocumentSchema;
}

export interface DocumentExportResult {
  format: 'markdown' | 'docx' | 'pdf';
  filename: string;
  contentBase64?: string;
  contentText?: string;
  manifest: Record<string, unknown>;
}

/**
 * Editor scopes (Epic E3 — extended in Sprint 4):
 *  - local:        single block under the cursor
 *  - section:      every editable block in one section
 *  - global:       every editable block in every section
 *  - methodology:  every editable block in Methodology/Approach/Scope/Założenia/
 *                  Assumptions/Sensitivity sections only — stricter prompt
 *                  rules ("do not invent methodology steps, do not reorder
 *                  phases, only refine prose")
 *  - source:       every editable block whose block.sourceRef is set —
 *                  stricter prompt rules ("never modify numbers, names,
 *                  citation markers; polish prose only") + post-rewrite
 *                  preservation guard (digits + bracketed citations must
 *                  match before/after; otherwise deterministic fallback)
 *  - transformative: every editable block of every section — the user
 *                  has explicitly opted into a dramatic restructure
 *                  ("przepisz od nowa", "completely rewrite", "rebuild").
 *                  Refiner relaxes structural guardrails (may merge /
 *                  split paragraphs, may shift register fundamentally)
 *                  but keeps non-empty + 4× growth + 4000 char absolute
 *                  caps so approval-time surprises stay bounded. NO
 *                  source-preservation guard: the user has consciously
 *                  authorized a rebuild. Slice E3.6 — completes the
 *                  SSOT 6-scope edit doctrine.
 */
export type DocumentEditorScope =
  | 'local'
  | 'section'
  | 'global'
  | 'methodology'
  | 'source'
  | 'transformative';
export type DocumentProposalStatus = 'proposed' | 'approved' | 'rejected' | 'executed';

/**
 * Editor proposal input. Required fields differ by scope:
 *   - local:   sectionId + blockId + instruction
 *   - section: sectionId + instruction (blockId omitted/ignored)
 *   - global:  instruction only (no sectionId/blockId)
 *
 * Routes validate the shape per-scope before delegating to the service.
 */
export interface DocumentEditorProposalInput {
  scope: DocumentEditorScope;
  instruction: string;
  sectionId?: string;
  blockId?: string;
}

export interface DocumentEditorProposalDiff {
  before: string;
  after: string;
}

/**
 * For section/global scopes, `diff` carries a stringified summary of the
 * before/after sections (rendered via the markdown projection) so the UI can
 * present a reviewable preview without leaking the raw schema to clients
 * that only know about the editor surface. The full structural change is
 * applied at approval time using `affectedSectionIds`.
 *
 * `blockRewrites` is an optional map `blockId -> rewritten text` that the
 * LLM-augmented refiner populates at proposal time. When present, approval
 * uses the rewritten text per block; when absent, approval falls back to the
 * deterministic instruction-marker application. This keeps the governance
 * envelope (proposal → approval → execution → audit) intact regardless of
 * whether AI rewrites are involved.
 */
export interface DocumentEditorProposal {
  proposalId: string;
  artifactId: string;
  organizationId: string;
  scope: DocumentEditorScope;
  instruction: string;
  sectionId?: string;
  blockId?: string;
  /** Sections touched by the proposal. For local: one section. */
  affectedSectionIds: string[];
  /** Optional per-block LLM rewrites applied at approval time. */
  blockRewrites?: Record<string, string>;
  /** Whether the LLM refiner produced any rewrites for this proposal. */
  llmRefined?: boolean;
  status: DocumentProposalStatus;
  diff: DocumentEditorProposalDiff;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  executedAt?: string;
}

export type DocumentAuditAction =
  | 'proposal_created'
  | 'proposal_approved'
  | 'proposal_rejected'
  | 'proposal_executed'
  | 'qa_blocked_export'
  | 'qa_override_export'
  | 'qa_override_denied'
  // Epic E5 — Document Lifecycle
  | 'document_status_changed'
  | 'document_version_snapshot_created'
  | 'document_rolled_back'
  // Epic E6 — Comments + review mode
  | 'comment_added'
  | 'comment_replied'
  | 'comment_resolved'
  | 'comment_reopened'
  | 'comment_deleted';

// =============================================================================
// Epic E6 — Comments + review mode
// =============================================================================

/**
 * Lifecycle status of a `DocumentComment`. Comments live in two
 * states only — `'open'` (the default on creation) and `'resolved'`
 * (closed after a reviewer marked it done). Reopening flips the
 * state back to `'open'` and bumps `reopenedAt`. We deliberately
 * keep this binary so the UI affordances (thread badges, unresolved
 * counts) stay simple and the audit trail unambiguous.
 */
export type DocumentCommentStatus = 'open' | 'resolved';

/**
 * Anchor — what part of the document the comment is attached to.
 *
 *   document   The whole artifact (general feedback, no anchor).
 *   section    Bound to a specific section by `sectionId`.
 *   block      Bound to a specific block inside a section by both
 *              `sectionId` AND `blockId` (enables inline annotation
 *              UX in the editor canvas).
 *
 * The discriminant is captured in `anchor.kind`; required ids ride
 * along on the same object so the type narrows them automatically.
 */
export type DocumentCommentAnchor =
  | { kind: 'document' }
  | { kind: 'section'; sectionId: string }
  | { kind: 'block'; sectionId: string; blockId: string };

/**
 * A reviewer comment on a document. Threads are formed by sharing
 * `threadId` — the root comment of a thread carries
 * `parentCommentId === undefined` and all replies carry
 * `parentCommentId === root.commentId`. Replies inherit the root's
 * `anchor`.
 *
 * Resolution semantics: resolving the root marks every comment in
 * the thread as resolved (atomic operation in the service); replies
 * cannot be resolved independently in MVP. Reopen mirrors that.
 */
export interface DocumentComment {
  commentId: string;
  threadId: string;
  artifactId: string;
  organizationId: string;
  /** Root of a thread has parentCommentId === undefined. */
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
  /** Soft-delete: the comment row stays in the timeline so the
   *  audit trail is complete, but body is replaced with `''` and
   *  `deletedAt` is stamped. Replies on a deleted root keep working. */
  deletedBy?: string;
  deletedAt?: string;
}

/**
 * Aggregated view of a comment thread for UI rendering. The service
 * groups comments by `threadId` and returns:
 *   - `root`    The first comment in the thread (parentCommentId === undefined).
 *   - `replies` All other comments in the thread, ordered by createdAt asc.
 *   - `status`  Mirrors the root's status (resolution is thread-wide).
 *   - `anchor`  Mirrors the root's anchor.
 */
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
 * Per-section unresolved-comment counts for the editor canvas to
 * render thread badges next to section / block headings.
 */
export interface DocumentCommentSectionCounts {
  artifactId: string;
  organizationId: string;
  /** Sum of `'open'` thread counts across the entire artifact. */
  totalOpen: number;
  /** Sum of `'resolved'` thread counts across the entire artifact. */
  totalResolved: number;
  /** Per-section breakdown. The map omits sections with zero threads. */
  perSection: Record<string, { open: number; resolved: number }>;
  /** Per-block breakdown — only `'block'`-anchored threads contribute. */
  perBlock: Record<string, { open: number; resolved: number }>;
}

/**
 * Origin of a `DocumentVersionSnapshot` (Epic E5 Slice 5.2 / 5.3).
 *
 *   manual              Operator clicked "snapshot now" or wrote a label
 *                       at a meaningful moment.
 *   auto_status_change  Created automatically on a meaningful lifecycle
 *                       transition (e.g. → approved) so rollback can
 *                       always reach the cleared version.
 *   rollback_revert     Created right before a rollback overwrites the
 *                       current schema, so the operator never loses the
 *                       state they rolled away from.
 */
export type DocumentVersionSnapshotOrigin = 'manual' | 'auto_status_change' | 'rollback_revert';

/**
 * Frozen, addressable copy of a `DocumentSchema` at a point in time.
 * Snapshots are append-only; the rollback machinery in slice 5.3
 * restores a snapshot by writing a new "rollback_revert" snapshot of
 * the current schema, then activating the target snapshot's schema.
 */
export interface DocumentVersionSnapshot {
  versionId: string;
  artifactId: string;
  organizationId: string;
  /** Monotonic 1-based per-artifact counter. */
  versionNumber: number;
  capturedAt: string;
  capturedBy: string;
  label?: string;
  reason?: string;
  statusAtCapture: DocumentStatus;
  schema: DocumentSchema;
  origin: DocumentVersionSnapshotOrigin;
}

/**
 * Document Lifecycle (Epic E5).
 *
 *   draft        Working copy; freely mutable. Initial state on creation.
 *   in_review    Submitted for review; intended-immutable but mutations
 *                are allowed (no hard lock). Reviewers leave comments
 *                (Epic E6) and decide approve / send-back.
 *   approved     Cleared for publication. Auto-creates a "approved"
 *                version snapshot on entry so rollback can always get
 *                back to the cleared state.
 *   published    Externally shared / exported as official deliverable.
 *                Only path forward is `archived`. To revise, the operator
 *                rolls back to a snapshot or creates a new artifact.
 *   archived     Removed from the active list. Restorable to `draft`.
 */
export type DocumentStatus = 'draft' | 'in_review' | 'approved' | 'published' | 'archived';

export interface DocumentAuditEntry {
  auditId: string;
  artifactId: string;
  organizationId: string;
  proposalId?: string;
  action: DocumentAuditAction;
  actorId: string;
  occurredAt: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// MVP-2 — Document Template Architect
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

export interface TemplateSectionBlueprint {
  title: string;
  level: 1 | 2 | 3;
  purpose: string;
  required: boolean;
  expectedLengthHint: 'short' | 'medium' | 'long';
}

export interface TemplateExportRules {
  docx: boolean;
  pdf: boolean;
  markdown: boolean;
  approvalRequiredForExport: boolean;
}

/**
 * Canonical Document Template — the artifact that governs Mode 2 ("plan a
 * template") and Mode 3 ("generate from approved template"). Templates are
 * versioned and gated by approval before they become usable in Mode 3.
 */
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
  formattingSchema: FormattingSchema;
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

export type TemplateAuditAction =
  | 'template_drafted'
  | 'template_updated'
  | 'template_approved'
  | 'template_deprecated';

export interface TemplateAuditEntry {
  auditId: string;
  templateId: string;
  organizationId: string;
  action: TemplateAuditAction;
  actorId: string;
  occurredAt: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// Source Pack — Epic E4 (chat-first creation entry + connector ingestion).
// =============================================================================

/**
 * Concrete connector vocabulary. The pack registry is connector-agnostic;
 * each connector adapter normalizes its native shape into a `SourcePackItem`
 * that carries enough body text for the LLM and a stable `sourceRef` so the
 * resulting Document can cite the item via the existing
 * `DocumentSourceRef` plumbing without any schema migrations elsewhere.
 *
 *   - url           public web fetch (head + body, HTML stripped to text).
 *   - text          consultant-pasted raw text or markdown.
 *   - file          uploaded file content (text-extractable today; binary
 *                   handling is a follow-up).
 *   - integration   third-party connector (Notion / Drive / SharePoint).
 *                   Only stub validation in MVP; real handlers wire in
 *                   block by block.
 *   - v8_artifact   reference to an existing wave5 artifact in the same
 *                   tenant (e.g. interview transcript, finance pack).
 */
export type SourcePackItemType = 'url' | 'text' | 'file' | 'integration' | 'v8_artifact';

export type SourcePackStatus = 'draft' | 'ready' | 'archived';

export interface SourcePackItem {
  itemId: string;
  itemType: SourcePackItemType;
  title: string;
  /** Normalized text content the LLM can consume. Optional for pure refs. */
  body?: string;
  /** True when the connector trimmed `body` to fit a budget. */
  bodyTruncated?: boolean;
  /** Pre-truncation length (characters). 0 when no body was captured. */
  contentLength: number;
  /** Source URI / file path / integration handle. */
  uri?: string;
  /** ISO timestamp when the connector finished ingestion. */
  ingestedAt: string;
  ingestedBy: string;
  language?: 'pl' | 'en';
  notes?: string;
  /**
   * Stable `DocumentSourceRef` projected when the pack is attached to a
   * document. Built by the connector at ingest time so callers do not have
   * to re-derive the citation shape.
   */
  sourceRef: DocumentSourceRef;
}

export interface SourcePack {
  packId: string;
  organizationId: string;
  name: string;
  description?: string;
  language: 'pl' | 'en';
  items: SourcePackItem[];
  /** Sum of `contentLength` across all items at the moment of last write. */
  totalContentLength: number;
  status: SourcePackStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedBy?: string;
  archivedAt?: string;
  notes?: string;
}

export type SourcePackAuditAction =
  | 'pack_drafted'
  | 'pack_item_added'
  | 'pack_item_removed'
  | 'pack_marked_ready'
  | 'pack_archived'
  | 'pack_attached_to_document';

export interface SourcePackAuditEntry {
  auditId: string;
  packId: string;
  organizationId: string;
  action: SourcePackAuditAction;
  actorId: string;
  occurredAt: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// Epic E7 — Per-tenant Brand Voice profile
// =============================================================================

/**
 * Lifecycle status of a `BrandVoiceProfile`. Profiles enter as `draft`,
 * are promoted to `active` (at most one active row per organization at
 * any time — activation auto-archives the previous active), and end at
 * `archived`. Archived profiles are immutable but stay queryable for
 * audit purposes.
 */
export type BrandVoiceProfileStatus = 'draft' | 'active' | 'archived';

/**
 * Which document languages a profile applies to. `'all'` matches every
 * language; `'pl'` / `'en'` restrict the profile to a single language so
 * a tenant can run different lexicons on PL vs EN documents.
 */
export type BrandVoiceProfileLanguageScope = 'pl' | 'en' | 'all';

/**
 * Glossary entry — a directed pair (avoid, prefer). Brand QA emits a
 * finding when the document uses `avoid` and points the consultant at
 * `prefer` in the suggestion. `note` is optional reviewer guidance.
 */
export interface BrandVoiceGlossaryEntry {
  avoid: string;
  prefer: string;
  note?: string;
}

/**
 * Per-tenant Brand Voice profile. Layered on top of the global banned-
 * phrase catalogue baked into `documentQaService.runBrandQa`:
 *
 *   - `bannedPhrases` ADD to the global list (tenant-specific terms the
 *     org wants to ban: competitor names, deprecated product brands,
 *     internal jargon that leaked into client-facing text, …).
 *   - `disabledGlobalBannedPhrases` SUBTRACT from the global list — an
 *     escape-hatch for the small set of orgs whose voice intentionally
 *     uses one of the global "fluff" words (e.g. an innovation studio
 *     that genuinely sells "rewolucyjny"). Phrase comparison is
 *     case-insensitive.
 *   - `glossaryEntries` are directed (avoid → prefer) and surface a
 *     suggestion alongside the finding.
 *   - `requiredKeywords` are terms that MUST appear in the document at
 *     least once (e.g. company name in client-facing memos). Missing
 *     terms become a finding.
 *   - `registerOverride` lets the tenant pin every document to a stricter
 *     register than the schema requests (e.g. "always score documents
 *     against `executive` even when the schema says `professional`").
 *   - `languageScope` filters which language(s) the profile applies to.
 *
 * Activation rule: at most one `'active'` profile per organization at a
 * time. The service enforces this by auto-archiving the previous active
 * row when a new one is activated.
 */
export interface BrandVoiceProfile {
  profileId: string;
  organizationId: string;
  name: string;
  description?: string;
  status: BrandVoiceProfileStatus;
  /** Monotonic version string per profile id; bumped on every update. */
  version: string;
  languageScope: BrandVoiceProfileLanguageScope;
  bannedPhrases: string[];
  disabledGlobalBannedPhrases: string[];
  preferredPhrases: string[];
  glossaryEntries: BrandVoiceGlossaryEntry[];
  requiredKeywords: string[];
  registerOverride?: CommunicationRegister;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  activatedBy?: string;
  activatedAt?: string;
  archivedBy?: string;
  archivedAt?: string;
}

export interface BrandVoiceProfileDraftInput {
  name: string;
  description?: string;
  languageScope?: BrandVoiceProfileLanguageScope;
  bannedPhrases?: string[];
  disabledGlobalBannedPhrases?: string[];
  preferredPhrases?: string[];
  glossaryEntries?: BrandVoiceGlossaryEntry[];
  requiredKeywords?: string[];
  registerOverride?: CommunicationRegister;
  notes?: string;
}

export interface BrandVoiceProfileUpdateInput {
  name?: string;
  description?: string;
  languageScope?: BrandVoiceProfileLanguageScope;
  bannedPhrases?: string[];
  disabledGlobalBannedPhrases?: string[];
  preferredPhrases?: string[];
  glossaryEntries?: BrandVoiceGlossaryEntry[];
  requiredKeywords?: string[];
  registerOverride?: CommunicationRegister | null;
  notes?: string | null;
}

export type BrandVoiceProfileAuditAction =
  | 'profile_drafted'
  | 'profile_updated'
  | 'profile_activated'
  | 'profile_archived'
  | 'profile_superseded';

export interface BrandVoiceProfileAuditEntry {
  auditId: string;
  profileId: string;
  organizationId: string;
  action: BrandVoiceProfileAuditAction;
  actorId: string;
  occurredAt: string;
  details?: Record<string, unknown>;
}

// ────────────────────────────────────────────────────────────────────────────
// Epic E9 — Audience-driven warianty
// ────────────────────────────────────────────────────────────────────────────

/**
 * Lifecycle status for an AudienceProfile. Mirrors BrandVoiceProfileStatus:
 * profiles start as `'draft'`, become `'active'` (multiple actives allowed
 * per organization, unlike Brand Voice — different audiences are not
 * mutually exclusive), and end as `'archived'` (immutable, queryable).
 *
 * `'system'` profiles seeded by Document Studio itself (board / client /
 * engineering / pmo) are immutable and always `'active'`.
 */
export type AudienceProfileStatus = 'draft' | 'active' | 'archived';

/**
 * Policy for the document's executive summary section under projection.
 *
 *   - `'preserve'` (default): keep the executive summary verbatim.
 *   - `'expand'`: keep + flag for the AI editor to expand later (today
 *     a structural marker only — no LLM call in E9.1).
 *   - `'drop'`: remove the executive summary section entirely (e.g. an
 *     engineering variant that wants to skip the C-level recap).
 */
export type AudienceProfileExecutiveSummaryPolicy = 'preserve' | 'expand' | 'drop';

/** Policy for appendix sections under projection — keep them or drop them all. */
export type AudienceProfileAppendixPolicy = 'preserve' | 'drop';

/**
 * Policy for jargon substitution. Today purely declarative (the projector
 * carries the policy onto the variant for downstream tooling); a future
 * slice may wire this through an AI rewrite pass.
 */
export type AudienceProfileJargonPolicy = 'as_is' | 'plain_language';

/**
 * Section / block tag filter. Both lists are tag-name lists (the same
 * free-form strings authored on `DocumentSection.audienceTags` and
 * `DocumentBlock.audienceTags`).
 *
 *   - `include`: when non-empty, ONLY tagged elements with at least one
 *     matching tag survive. Untagged elements still survive (default-include).
 *   - `exclude`: tagged elements with any matching tag are dropped.
 *
 * `exclude` wins over `include` when both match.
 */
export interface AudienceProfileTagFilter {
  include?: string[];
  exclude?: string[];
}

/**
 * Audience-driven projection profile — Epic E9.
 *
 * An AudienceProfile is the configuration for a single audience-aware
 * variant of a document. Given a base `DocumentSchema`, the projector
 * (`projectDocumentForAudience`) produces a derived schema with:
 *
 *   - schema-level scalar overrides (`audience`, `communicationRegister`,
 *     `density`, `languageStyle`),
 *   - section / block tag filtering,
 *   - executive-summary and appendix policies,
 *   - jargon-policy metadata for downstream rewrite passes.
 *
 * The same audience-tag vocabulary is shared across all profiles in an
 * organization; profiles only differ in which tags they include / exclude
 * and which scalar overrides they apply.
 *
 * Multiple `'active'` AudienceProfiles can coexist per organization (unlike
 * Brand Voice profiles): a single document is typically projected into
 * several variants (board + client + engineering) at export time.
 */
export interface AudienceProfile {
  profileId: string;
  /** Owning organization — `'system'` for built-in seeds. */
  organizationId: string;
  name: string;
  description?: string;
  status: AudienceProfileStatus;
  /** Monotonic version string per profile id; bumped on every update. */
  version: string;
  /**
   * Audience labels written into the projected schema's `audience` array.
   * Empty array → keep the source schema's audience.
   */
  audienceLabels: string[];
  /** Override the source schema's `communicationRegister`. `null`/omitted → inherit. */
  registerOverride?: CommunicationRegister;
  /** Override the source schema's `density`. */
  densityOverride?: DocumentDensity;
  /** Override the source schema's `languageStyle`. */
  languageStyleOverride?: DocumentLanguageStyle;
  /** Section-level audience-tag filter. */
  sectionFilters: AudienceProfileTagFilter;
  /** Block-level audience-tag filter (applied within surviving sections). */
  blockFilters: AudienceProfileTagFilter;
  executiveSummaryPolicy: AudienceProfileExecutiveSummaryPolicy;
  appendixPolicy: AudienceProfileAppendixPolicy;
  jargonPolicy: AudienceProfileJargonPolicy;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  activatedBy?: string;
  activatedAt?: string;
  archivedBy?: string;
  archivedAt?: string;
}

export interface AudienceProfileDraftInput {
  name: string;
  description?: string;
  audienceLabels?: string[];
  registerOverride?: CommunicationRegister;
  densityOverride?: DocumentDensity;
  languageStyleOverride?: DocumentLanguageStyle;
  sectionFilters?: AudienceProfileTagFilter;
  blockFilters?: AudienceProfileTagFilter;
  executiveSummaryPolicy?: AudienceProfileExecutiveSummaryPolicy;
  appendixPolicy?: AudienceProfileAppendixPolicy;
  jargonPolicy?: AudienceProfileJargonPolicy;
  notes?: string;
}

export interface AudienceProfileUpdateInput {
  name?: string;
  description?: string | null;
  audienceLabels?: string[];
  registerOverride?: CommunicationRegister | null;
  densityOverride?: DocumentDensity | null;
  languageStyleOverride?: DocumentLanguageStyle | null;
  sectionFilters?: AudienceProfileTagFilter;
  blockFilters?: AudienceProfileTagFilter;
  executiveSummaryPolicy?: AudienceProfileExecutiveSummaryPolicy;
  appendixPolicy?: AudienceProfileAppendixPolicy;
  jargonPolicy?: AudienceProfileJargonPolicy;
  notes?: string | null;
}

export type AudienceProfileAuditAction =
  | 'profile_drafted'
  | 'profile_updated'
  | 'profile_activated'
  | 'profile_archived';

export interface AudienceProfileAuditEntry {
  auditId: string;
  profileId: string;
  organizationId: string;
  action: AudienceProfileAuditAction;
  actorId: string;
  occurredAt: string;
  details?: Record<string, unknown>;
}

/**
 * Provenance metadata stamped onto every projected DocumentSchema so a
 * variant can be traced back to its source artifact and the profile that
 * produced it. Returned alongside the projected schema by
 * `projectDocumentForAudience`; not part of the wire-line schema itself
 * (the projector does not mutate `DocumentSchema` to keep it stable).
 */
export interface DocumentVariantProvenance {
  sourceDocumentId: string;
  sourceArtifactId: string;
  profileId: string;
  profileVersion: string;
  projectedAt: string;
  /**
   * Per-section bookkeeping describing what survived projection. Useful
   * for explainability ("why is section X missing in the board variant?").
   */
  sectionsKept: string[];
  sectionsDropped: { sectionId: string; reason: string }[];
  blocksDropped: number;
}

export interface DocumentVariant {
  schema: DocumentSchema;
  provenance: DocumentVariantProvenance;
}

// ────────────────────────────────────────────────────────────────────────────
// Epic E10 — Enterprise Collaboration: Approval workflow
// ────────────────────────────────────────────────────────────────────────────

/**
 * Lifecycle state of a single ApprovalRequest.
 *
 *   - `'pending'`           — awaiting decisions from required reviewers.
 *   - `'approved'`          — quorum policy satisfied; document may move
 *                             to `DocumentStatus === 'approved'`.
 *   - `'rejected'`          — at least one required reviewer rejected
 *                             under the active quorum policy.
 *   - `'changes_requested'` — at least one reviewer requested changes;
 *                             the request is closed and the consultant
 *                             must address feedback + open a new approval.
 *   - `'cancelled'`         — author cancelled the approval request
 *                             (e.g. document withdrawn from review).
 *
 * Terminal states: approved, rejected, changes_requested, cancelled.
 */
export type DocumentApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'changes_requested'
  | 'cancelled';

/** A single reviewer's verdict on an open approval request. */
export type DocumentApprovalDecisionKind = 'approve' | 'reject' | 'request_changes';

/**
 * Quorum policy controlling when the request auto-resolves to `approved`.
 *
 *   - `'unanimous'`       — every required participant must `'approve'`.
 *   - `'majority'`        — strictly more than half of required
 *                           participants must `'approve'`.
 *   - `'single_approval'` — any required participant approving resolves
 *                           the request immediately.
 *
 * Rejection / changes-requested semantics are policy-independent: any
 * required reviewer's `'reject'` flips the request to `'rejected'`, and
 * any `'request_changes'` flips it to `'changes_requested'`.
 */
export type DocumentApprovalQuorumPolicy = 'unanimous' | 'majority' | 'single_approval';

/**
 * Reviewer slot on an approval request.
 *
 * `required` reviewers count toward the quorum. Optional reviewers may
 * still record decisions for visibility but are excluded from the quorum
 * arithmetic so a "FYI" stakeholder does not block approval.
 */
export interface DocumentApprovalParticipant {
  userId: string;
  role?: string;
  required: boolean;
}

/** A single reviewer decision attached to an approval request. */
export interface DocumentApprovalDecision {
  decisionId: string;
  approvalId: string;
  reviewerId: string;
  kind: DocumentApprovalDecisionKind;
  comment?: string;
  occurredAt: string;
}

/**
 * Multi-reviewer approval ticket attached to a document artifact.
 *
 * Lifecycle: `'pending'` → terminal (`'approved'` / `'rejected'` /
 * `'changes_requested'` / `'cancelled'`). At most one non-terminal
 * approval per `(organization, artifact)` pair — the service rejects
 * a second open request with `approval_already_open` so two parallel
 * tracks cannot drift.
 *
 * Decisions are append-only; `recordApprovalDecision` rejects a second
 * decision from the same reviewer with `decision_already_recorded` to
 * keep the audit trail honest.
 */
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

export type DocumentApprovalAuditAction =
  | 'approval_requested'
  | 'approval_decision_recorded'
  | 'approval_resolved'
  | 'approval_cancelled';

export interface DocumentApprovalAuditEntry {
  auditId: string;
  approvalId: string;
  organizationId: string;
  artifactId: string;
  action: DocumentApprovalAuditAction;
  actorId: string;
  occurredAt: string;
  details?: Record<string, unknown>;
}

// ────────────────────────────────────────────────────────────────────────────
// Epic E10 — Enterprise Collaboration: Reusable Content Block library
// ────────────────────────────────────────────────────────────────────────────

/**
 * Lifecycle status for a Content Block library entry. Mirrors the
 * BrandVoiceProfile / AudienceProfile lifecycle: `draft → active →
 * archived`. Archived entries stay queryable for audit but cannot be
 * inserted into new documents.
 */
export type DocumentContentBlockStatus = 'draft' | 'active' | 'archived';

/**
 * Reusable, named content snippet stored in the tenant's library so a
 * consultant can re-use boilerplate language (standard intros,
 * compliance disclaimers, methodology blurbs, …) across documents
 * without copy/pasting from older artifacts.
 *
 * The `block` is a payload-only `DocumentBlock` — the same shape used
 * inside a `DocumentSection.blocks` array. Inserting a content block
 * into a document allocates a fresh `blockId` so two copies of the
 * same library entry never share an id.
 *
 * Multiple `'active'` content blocks are allowed (different blocks
 * serve different purposes). The library is tenant-scoped; system
 * seeds may ship in a future slice.
 */
export interface DocumentContentBlockTemplate {
  contentBlockId: string;
  organizationId: string;
  name: string;
  description?: string;
  status: DocumentContentBlockStatus;
  /** Monotonic version string per content-block id; bumped on every update. */
  version: string;
  /** Optional free-form tags (e.g. 'compliance', 'standard_intro'). */
  tags: string[];
  /** Document types the snippet is intended for; empty array → applicable to all types. */
  documentTypes: DocumentTypeKey[];
  /** Language scope (`'all'` matches every language, otherwise a specific one). */
  languageScope: 'pl' | 'en' | 'all';
  /** Payload — the same shape as a `DocumentBlock` inside a section. */
  block: Omit<DocumentBlock, 'blockId'>;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  activatedBy?: string;
  activatedAt?: string;
  archivedBy?: string;
  archivedAt?: string;
}

export interface DocumentContentBlockDraftInput {
  name: string;
  description?: string;
  tags?: string[];
  documentTypes?: DocumentTypeKey[];
  languageScope?: 'pl' | 'en' | 'all';
  block: Omit<DocumentBlock, 'blockId'>;
  notes?: string;
}

export interface DocumentContentBlockUpdateInput {
  name?: string;
  description?: string | null;
  tags?: string[];
  documentTypes?: DocumentTypeKey[];
  languageScope?: 'pl' | 'en' | 'all';
  block?: Omit<DocumentBlock, 'blockId'>;
  notes?: string | null;
}

export type DocumentContentBlockAuditAction =
  | 'content_block_drafted'
  | 'content_block_updated'
  | 'content_block_activated'
  | 'content_block_archived';

export interface DocumentContentBlockAuditEntry {
  auditId: string;
  contentBlockId: string;
  organizationId: string;
  action: DocumentContentBlockAuditAction;
  actorId: string;
  occurredAt: string;
  details?: Record<string, unknown>;
}

/** Canonical default consulting formatting schema for Mode 1 (no template). */
export const DEFAULT_CONSULTING_FORMATTING_SCHEMA: FormattingSchema = {
  fonts: { body: 'Aptos 11', heading: 'Aptos Display' },
  headingStyles: {
    h1: '16pt bold numbered',
    h2: '13pt bold numbered',
    h3: '11pt bold',
  },
  tableStyles: { default: 'consultify_clean_table' },
  listStyles: { bullet: 'consultify_bullet', numbered: 'consultify_numbered' },
  page: { size: 'A4', marginsCm: { top: 2.0, bottom: 2.0, left: 2.3, right: 2.3 } },
  headers: { enabled: true },
  footers: { enabled: true, pageNumbering: true, confidentialityLabel: true },
  toc: true,
  coverPage: true,
  appendixStyle: 'lettered',
  citationStyle: 'inline_marker',
};
