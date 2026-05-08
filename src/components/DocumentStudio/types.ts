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
}

// Slice E3.5 widened from 3 → 5 scopes to match the SSOT 5-scope
// editor doctrine (local / section / global / methodology / source).
// Slice E3.6 completes the 6-scope doctrine by adding `transformative`:
// the user has explicitly authorized a dramatic rebuild; the service
// relaxes structural guardrails but keeps absolute safety caps and
// tags the audit trail with `authority: 'user_explicit_rebuild'`.
export type DocumentEditorScope =
  | 'local'
  | 'section'
  | 'global'
  | 'methodology'
  | 'source'
  | 'transformative';
export type DocumentProposalStatus = 'proposed' | 'approved' | 'rejected' | 'executed';

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

// Slice E14 — frontend mirror of the server-side DocumentTemplate
// product fields. All fields are OPTIONAL and pre-E14 templates omit
// them; consumers MUST treat the omission as "no signal yet". The
// FE-E2 template picker uses these fields to power the FR-06
// "discover the right template" experience: usage-based sort, quality
// score with sample-size disclosure, persona / region / brand chip
// filters, and dependency-gated visibility.
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
