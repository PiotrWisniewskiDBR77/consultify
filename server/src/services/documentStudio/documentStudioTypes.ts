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

export interface DocumentSourceRef {
  sourceType: string;
  sourceId: string;
  sourceTitle?: string;
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

export type DocumentEditorScope = 'local' | 'section' | 'global';
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
  | 'qa_override_denied';

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
