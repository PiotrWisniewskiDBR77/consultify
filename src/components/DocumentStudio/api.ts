/**
 * Consultify Document Studio — Frontend API Client (MVP-1, Mode 1).
 *
 * Talks to /api/document-studio (server/src/routes/document-studio.routes.ts).
 *
 * The MVP-1 endpoints return plain JSON (no `{ data: ... }` envelope), so this
 * client returns response bodies directly and exposes them through small,
 * typed wrappers.
 */

import { fetchWithRetry, getHeaders, handleResponse } from '@/services/api/baseClient';

import type {
  DocumentAccessHistoryEntry,
  DocumentApprovalDecisionKind,
  DocumentApprovalQuorumPolicy,
  DocumentApprovalRequest,
  DocumentAuditEntry,
  DocumentBlock,
  DocumentComment,
  DocumentCommentAnchor,
  DocumentCommentSectionCounts,
  DocumentCommentThread,
  DocumentContentBlockTemplate,
  DocumentEditorProposal,
  DocumentGenerationWarning,
  DocumentIntake,
  DocumentOutline,
  DocumentQaReport,
  DocumentSchema,
  DocumentSchemaDiffResponse,
  DocumentShareLink,
  DocumentShareLinkAccessScope,
  DocumentStudioPolicy,
  DocumentTemplate,
  DocumentTypeKey,
  DocumentVariant,
  DocumentVariantSummary,
  DocumentVersionSnapshotSummary,
  TemplateAuditEntry,
  TemplateDraftInput,
  TemplateStatus,
} from './types';

const BASE = '/api/document-studio';

/**
 * Structured error for the Mode 3 source-pack preflight failure. Surfaces
 * the missing requirements so callers can render a remediation checklist
 * rather than a raw 400 message.
 */
export class MissingRequiredSourceError extends Error {
  readonly code = 'missing_required_source';
  readonly missing: string[];
  constructor(missing: string[]) {
    super(`Missing required sources: ${missing.join(', ')}`);
    this.name = 'MissingRequiredSourceError';
    this.missing = missing;
  }
}

/**
 * Structured error for the export QA gate. Surfaces the full QA report so
 * the document panel can render findings without a second round-trip and
 * offer the audited override action when policy allows.
 */
export class QaBlockingError extends Error {
  readonly code = 'qa_blocking';
  readonly report: DocumentQaReport;
  constructor(report: DocumentQaReport, message?: string) {
    super(message ?? 'QA blocking findings prevent export');
    this.name = 'QaBlockingError';
    this.report = report;
  }
}

/**
 * Thrown when the user attempts a `qaOverride` export but their role is
 * not in the privileged set. The frontend hides the override button when
 * `policy.canOverrideQa === false`, but the error path remains for users
 * who arrive at the override via deep-link or stale UI state.
 */
export class QaOverrideUnauthorizedError extends Error {
  readonly code = 'qa_override_unauthorized';
  readonly role: string | null;
  constructor(message: string, role: string | null = null) {
    super(message);
    this.name = 'QaOverrideUnauthorizedError';
    this.role = role;
  }
}

interface PlanResponse {
  outline: DocumentOutline;
  llmRefined?: boolean;
}

interface GenerateResponse {
  artifactId: string;
  schema: DocumentSchema;
  /** A4 — generation-time warnings (LLM prose fallback etc.). */
  generationWarnings?: DocumentGenerationWarning[];
}

interface GetArtifactResponse {
  schema: DocumentSchema;
  /** A4 — persisted generation-time warnings for this artifact. */
  generationWarnings?: DocumentGenerationWarning[];
}

/** A4 — artifact + its persisted generation warnings, returned by GET. */
export interface DocumentStudioArtifactResult {
  schema: DocumentSchema;
  generationWarnings: DocumentGenerationWarning[];
}

export interface DocumentExportPayload {
  format: 'markdown' | 'docx' | 'pdf';
  filename: string;
  contentText?: string;
  contentBase64?: string;
  manifest?: Record<string, unknown>;
  /** A4 — export-time warnings (chart rasterization / logo fallbacks). */
  generationWarnings?: DocumentGenerationWarning[];
}

export interface PlanDocumentStudioOptions {
  useLlm?: boolean;
}

export async function planDocumentStudioOutline(
  intake: DocumentIntake,
  options: PlanDocumentStudioOptions = {}
): Promise<DocumentOutline> {
  const res = await fetchWithRetry(`${BASE}/plan`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ intake, useLlm: options.useLlm === true }),
  });
  const json = await handleResponse<PlanResponse>(res, 'DocumentStudio plan');
  return json.outline;
}

export interface GenerateDocumentParams {
  intake: DocumentIntake;
  outline?: DocumentOutline;
  sourceRefs?: { sourceType: string; sourceId: string; sourceTitle?: string }[];
  projectId?: string;
  useLlm?: boolean;
  /** Mode 3: when set, generation hydrates from this approved template. */
  templateId?: string;
}

export async function generateDocumentStudioArtifact(
  params: GenerateDocumentParams
): Promise<GenerateResponse> {
  const res = await fetchWithRetry(`${BASE}/generate`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(params),
  });
  if (res.status === 400) {
    // Decode structured Mode-3 preflight failure before letting handleResponse
    // collapse the body into a generic Error message.
    let body: { error?: string; missing?: unknown } = {};
    try {
      body = (await res.clone().json()) as { error?: string; missing?: unknown };
    } catch {
      // Fall through to the generic handler below.
    }
    if (body.error === 'missing_required_source' && Array.isArray(body.missing)) {
      throw new MissingRequiredSourceError(body.missing.map((m) => String(m)));
    }
  }
  return handleResponse<GenerateResponse>(res, 'DocumentStudio generate');
}

export async function getDocumentStudioArtifact(
  artifactId: string
): Promise<DocumentStudioArtifactResult> {
  const res = await fetchWithRetry(`${BASE}/${encodeURIComponent(artifactId)}`, {
    method: 'GET',
    headers: getHeaders(),
  });
  const json = await handleResponse<GetArtifactResponse>(res, 'DocumentStudio get');
  return {
    schema: json.schema,
    generationWarnings: json.generationWarnings ?? [],
  };
}

export interface ExportArtifactOptions {
  /**
   * Bypass the export QA gate. Audited server-side as `qa_override_export`.
   * Use only when the user has explicitly chosen to ship a document with
   * known blocking findings.
   */
  qaOverride?: boolean;
}

export async function exportDocumentStudioArtifact(
  artifactId: string,
  format: 'markdown' | 'docx' | 'pdf',
  options: ExportArtifactOptions = {}
): Promise<DocumentExportPayload> {
  const params = new URLSearchParams();
  if (options.qaOverride) params.set('qaOverride', 'true');
  const query = params.toString().length > 0 ? `?${params.toString()}` : '';
  const res = await fetchWithRetry(
    `${BASE}/${encodeURIComponent(artifactId)}/export/${format}${query}`,
    {
      method: 'GET',
      headers: getHeaders(),
    }
  );
  if (res.status === 403) {
    let body: {
      error?: string;
      message?: string;
      report?: DocumentQaReport;
      role?: string | null;
    } = {};
    try {
      body = (await res.clone().json()) as typeof body;
    } catch {
      // Fall through to handleResponse for the generic error mapping.
    }
    if (body.error === 'qa_blocking' && body.report) {
      throw new QaBlockingError(body.report);
    }
    if (body.error === 'qa_override_unauthorized') {
      throw new QaOverrideUnauthorizedError(
        body.message ?? 'You are not authorized to override the export QA gate.',
        body.role ?? null
      );
    }
  }
  return handleResponse<DocumentExportPayload>(res, 'DocumentStudio export');
}

export async function getDocumentStudioPolicy(): Promise<DocumentStudioPolicy> {
  const res = await fetchWithRetry(`${BASE}/policy`, {
    method: 'GET',
    headers: getHeaders(),
  });
  const json = await handleResponse<{ policy: DocumentStudioPolicy }>(res, 'DocumentStudio policy');
  return json.policy;
}

export interface CreateLocalProposalPayload {
  sectionId: string;
  blockId: string;
  instruction: string;
  scope: 'local';
}

export interface CreateProposalOptions {
  /** Opt-in bounded LLM rewrite. Falls back deterministically on any failure. */
  useLlm?: boolean;
}

export async function createDocumentStudioLocalProposal(
  artifactId: string,
  payload: CreateLocalProposalPayload,
  options: CreateProposalOptions = {}
): Promise<DocumentEditorProposal> {
  const res = await fetchWithRetry(
    `${BASE}/${encodeURIComponent(artifactId)}/editor/proposals/local`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ ...payload, useLlm: options.useLlm === true }),
    }
  );
  const json = await handleResponse<{ proposal: DocumentEditorProposal }>(
    res,
    'DocumentStudio create proposal'
  );
  return json.proposal;
}

export async function approveDocumentStudioProposal(
  artifactId: string,
  proposalId: string
): Promise<{ proposal: DocumentEditorProposal; schema: DocumentSchema }> {
  const res = await fetchWithRetry(
    `${BASE}/${encodeURIComponent(artifactId)}/editor/proposals/${encodeURIComponent(proposalId)}/approve`,
    {
      method: 'POST',
      headers: getHeaders(),
    }
  );
  return handleResponse<{ proposal: DocumentEditorProposal; schema: DocumentSchema }>(
    res,
    'DocumentStudio approve proposal'
  );
}

export async function rejectDocumentStudioProposal(
  artifactId: string,
  proposalId: string
): Promise<DocumentEditorProposal> {
  const res = await fetchWithRetry(
    `${BASE}/${encodeURIComponent(artifactId)}/editor/proposals/${encodeURIComponent(proposalId)}/reject`,
    {
      method: 'POST',
      headers: getHeaders(),
    }
  );
  const json = await handleResponse<{ proposal: DocumentEditorProposal }>(
    res,
    'DocumentStudio reject proposal'
  );
  return json.proposal;
}

// MVP-3 — section + global edit proposals.
export async function createDocumentStudioSectionProposal(
  artifactId: string,
  payload: { sectionId: string; instruction: string },
  options: CreateProposalOptions = {}
): Promise<DocumentEditorProposal> {
  const res = await fetchWithRetry(
    `${BASE}/${encodeURIComponent(artifactId)}/editor/proposals/section`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ ...payload, useLlm: options.useLlm === true }),
    }
  );
  const json = await handleResponse<{ proposal: DocumentEditorProposal }>(
    res,
    'DocumentStudio create section proposal'
  );
  return json.proposal;
}

export async function createDocumentStudioGlobalProposal(
  artifactId: string,
  payload: { instruction: string },
  options: CreateProposalOptions = {}
): Promise<DocumentEditorProposal> {
  const res = await fetchWithRetry(
    `${BASE}/${encodeURIComponent(artifactId)}/editor/proposals/global`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ ...payload, useLlm: options.useLlm === true }),
    }
  );
  const json = await handleResponse<{ proposal: DocumentEditorProposal }>(
    res,
    'DocumentStudio create global proposal'
  );
  return json.proposal;
}

// Slice E3.5 — methodology scope client. Operates on every editable
// block in methodology-aligned sections (e.g. methodology, approach,
// research_design). Backend returns 400 `no_methodology_sections` when
// the document type does not surface any such section. Used by the
// Teresa intent-classifier flow and (future) by the FE-E2 5-scope
// editor UI.
export async function createDocumentStudioMethodologyProposal(
  artifactId: string,
  payload: { instruction: string },
  options: CreateProposalOptions = {}
): Promise<DocumentEditorProposal> {
  const res = await fetchWithRetry(
    `${BASE}/${encodeURIComponent(artifactId)}/editor/proposals/methodology`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ ...payload, useLlm: options.useLlm === true }),
    }
  );
  const json = await handleResponse<{ proposal: DocumentEditorProposal }>(
    res,
    'DocumentStudio create methodology proposal'
  );
  return json.proposal;
}

// Slice E3.5 — source scope client. Operates on blocks anchored to a
// `sourceRef`, preserving the citation multiset (E3.2 refiner guard).
// Backend returns 400 `no_source_anchored_blocks` when no source-
// backed blocks exist; UI should surface a remediation hint.
export async function createDocumentStudioSourceProposal(
  artifactId: string,
  payload: { instruction: string },
  options: CreateProposalOptions = {}
): Promise<DocumentEditorProposal> {
  const res = await fetchWithRetry(
    `${BASE}/${encodeURIComponent(artifactId)}/editor/proposals/source`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ ...payload, useLlm: options.useLlm === true }),
    }
  );
  const json = await handleResponse<{ proposal: DocumentEditorProposal }>(
    res,
    'DocumentStudio create source proposal'
  );
  return json.proposal;
}

// Slice E3.6 — transformative scope client (6th poziom edycji). The
// user has explicitly authorized a dramatic rebuild. Service-side
// guardrails relax structural constraints (the model may merge / split
// paragraphs, shift register fundamentally) but keep absolute safety
// caps. Audit trail tags the proposal with
// `authority: 'user_explicit_rebuild'` so reviewers can filter for
// elevated-authority edits. UI must require explicit user confirmation
// before invoking — this is the most-aggressive editor scope.
export async function createDocumentStudioTransformativeProposal(
  artifactId: string,
  payload: { instruction: string },
  options: CreateProposalOptions = {}
): Promise<DocumentEditorProposal> {
  const res = await fetchWithRetry(
    `${BASE}/${encodeURIComponent(artifactId)}/editor/proposals/transformative`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ ...payload, useLlm: options.useLlm === true }),
    }
  );
  const json = await handleResponse<{ proposal: DocumentEditorProposal }>(
    res,
    'DocumentStudio create transformative proposal'
  );
  return json.proposal;
}

export async function getDocumentStudioAuditTrail(
  artifactId: string
): Promise<DocumentAuditEntry[]> {
  const res = await fetchWithRetry(`${BASE}/${encodeURIComponent(artifactId)}/editor/audit`, {
    method: 'GET',
    headers: getHeaders(),
  });
  const json = await handleResponse<{ auditEntries: DocumentAuditEntry[] }>(
    res,
    'DocumentStudio audit trail'
  );
  return json.auditEntries;
}

// MVP-3 hardening — QA Engine (Brand QA + Language QA, deterministic).
export async function getDocumentStudioQaReport(artifactId: string): Promise<DocumentQaReport> {
  const res = await fetchWithRetry(`${BASE}/${encodeURIComponent(artifactId)}/qa`, {
    method: 'GET',
    headers: getHeaders(),
  });
  const json = await handleResponse<{ report: DocumentQaReport }>(res, 'DocumentStudio QA report');
  return json.report;
}

// =============================================================================
// MVP-2 — Document Template Architect endpoints.
// =============================================================================

export interface ListTemplatesOptions {
  status?: TemplateStatus;
  documentType?: DocumentTypeKey;
}

export async function listDocumentStudioTemplates(
  options: ListTemplatesOptions = {}
): Promise<DocumentTemplate[]> {
  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (options.documentType) params.set('documentType', options.documentType);
  const url =
    params.toString().length > 0 ? `${BASE}/templates?${params.toString()}` : `${BASE}/templates`;
  const res = await fetchWithRetry(url, {
    method: 'GET',
    headers: getHeaders(),
  });
  const json = await handleResponse<{ templates: DocumentTemplate[] }>(
    res,
    'DocumentStudio list templates'
  );
  return json.templates;
}

export interface PlanTemplateOptions {
  useLlm?: boolean;
}

export async function planDocumentStudioTemplate(
  input: TemplateDraftInput,
  options: PlanTemplateOptions = {}
): Promise<{ template: DocumentTemplate; llmRefined: boolean }> {
  const res = await fetchWithRetry(`${BASE}/templates/plan`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ input, useLlm: options.useLlm === true }),
  });
  const json = await handleResponse<{ template: DocumentTemplate; llmRefined?: boolean }>(
    res,
    'DocumentStudio plan template'
  );
  return { template: json.template, llmRefined: Boolean(json.llmRefined) };
}

export async function getDocumentStudioTemplate(templateId: string): Promise<DocumentTemplate> {
  const res = await fetchWithRetry(`${BASE}/templates/${encodeURIComponent(templateId)}`, {
    method: 'GET',
    headers: getHeaders(),
  });
  const json = await handleResponse<{ template: DocumentTemplate }>(
    res,
    'DocumentStudio get template'
  );
  return json.template;
}

export async function approveDocumentStudioTemplate(
  templateId: string,
  notes?: string
): Promise<DocumentTemplate> {
  const res = await fetchWithRetry(`${BASE}/templates/${encodeURIComponent(templateId)}/approve`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ notes }),
  });
  const json = await handleResponse<{ template: DocumentTemplate }>(
    res,
    'DocumentStudio approve template'
  );
  return json.template;
}

export async function deprecateDocumentStudioTemplate(
  templateId: string,
  reason?: string
): Promise<DocumentTemplate> {
  const res = await fetchWithRetry(
    `${BASE}/templates/${encodeURIComponent(templateId)}/deprecate`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason }),
    }
  );
  const json = await handleResponse<{ template: DocumentTemplate }>(
    res,
    'DocumentStudio deprecate template'
  );
  return json.template;
}

export async function getDocumentStudioTemplateAudit(
  templateId: string
): Promise<TemplateAuditEntry[]> {
  const res = await fetchWithRetry(`${BASE}/templates/${encodeURIComponent(templateId)}/audit`, {
    method: 'GET',
    headers: getHeaders(),
  });
  const json = await handleResponse<{ auditEntries: TemplateAuditEntry[] }>(
    res,
    'DocumentStudio template audit'
  );
  return json.auditEntries;
}

// =============================================================================
// FE-E3/FE-E4/FR-37 — right-rail review and sharing endpoints.
// =============================================================================

export async function getDocumentStudioAccessHistory(
  artifactId: string,
  options: { limit?: number } = {}
): Promise<DocumentAccessHistoryEntry[]> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetchWithRetry(
    `${BASE}/${encodeURIComponent(artifactId)}/access-history${query}`,
    {
      method: 'GET',
      headers: getHeaders(),
    }
  );
  const json = await handleResponse<{ entries: DocumentAccessHistoryEntry[] }>(
    res,
    'DocumentStudio access history'
  );
  return json.entries;
}

export async function getDocumentStudioCommentThreads(
  artifactId: string
): Promise<DocumentCommentThread[]> {
  const res = await fetchWithRetry(`${BASE}/${encodeURIComponent(artifactId)}/comments/threads`, {
    method: 'GET',
    headers: getHeaders(),
  });
  const json = await handleResponse<{ threads: DocumentCommentThread[] }>(
    res,
    'DocumentStudio comment threads'
  );
  return json.threads;
}

export async function createDocumentStudioComment(
  artifactId: string,
  payload: { body: string; anchor: DocumentCommentAnchor }
): Promise<DocumentCommentThread[]> {
  const res = await fetchWithRetry(`${BASE}/${encodeURIComponent(artifactId)}/comments`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  await handleResponse(res, 'DocumentStudio create comment');
  return getDocumentStudioCommentThreads(artifactId);
}

/**
 * B5 — per-section / per-block unresolved-thread counts. Drives the
 * right-rail Comments tool badge and the panel filter counters.
 */
export async function getDocumentStudioCommentCounts(
  artifactId: string
): Promise<DocumentCommentSectionCounts> {
  const res = await fetchWithRetry(`${BASE}/${encodeURIComponent(artifactId)}/comments/counts`, {
    method: 'GET',
    headers: getHeaders(),
  });
  const json = await handleResponse<{ counts: DocumentCommentSectionCounts }>(
    res,
    'DocumentStudio comment counts'
  );
  return json.counts;
}

/** B5 — reply inside a thread (replies always target the thread root). */
export async function replyToDocumentStudioComment(
  artifactId: string,
  commentId: string,
  body: string
): Promise<DocumentComment> {
  const res = await fetchWithRetry(
    `${BASE}/${encodeURIComponent(artifactId)}/comments/${encodeURIComponent(commentId)}/reply`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ body }),
    }
  );
  const json = await handleResponse<{ comment: DocumentComment }>(
    res,
    'DocumentStudio reply to comment'
  );
  return json.comment;
}

/** B5 — resolve the whole thread (optional reason recorded on the root). */
export async function resolveDocumentStudioComment(
  artifactId: string,
  commentId: string,
  reason?: string
): Promise<DocumentComment> {
  const res = await fetchWithRetry(
    `${BASE}/${encodeURIComponent(artifactId)}/comments/${encodeURIComponent(commentId)}/resolve`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(reason ? { reason } : {}),
    }
  );
  const json = await handleResponse<{ comment: DocumentComment }>(
    res,
    'DocumentStudio resolve comment'
  );
  return json.comment;
}

/** B5 — reopen a resolved thread (optional reason). */
export async function reopenDocumentStudioComment(
  artifactId: string,
  commentId: string,
  reason?: string
): Promise<DocumentComment> {
  const res = await fetchWithRetry(
    `${BASE}/${encodeURIComponent(artifactId)}/comments/${encodeURIComponent(commentId)}/reopen`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(reason ? { reason } : {}),
    }
  );
  const json = await handleResponse<{ comment: DocumentComment }>(
    res,
    'DocumentStudio reopen comment'
  );
  return json.comment;
}

/** B5 — author-only soft-delete (backend blanks the body, keeps the row). */
export async function deleteDocumentStudioComment(
  artifactId: string,
  commentId: string
): Promise<DocumentComment> {
  const res = await fetchWithRetry(
    `${BASE}/${encodeURIComponent(artifactId)}/comments/${encodeURIComponent(commentId)}`,
    {
      method: 'DELETE',
      headers: getHeaders(),
    }
  );
  const json = await handleResponse<{ comment: DocumentComment }>(
    res,
    'DocumentStudio delete comment'
  );
  return json.comment;
}

export async function listDocumentStudioShareLinks(
  artifactId: string
): Promise<DocumentShareLink[]> {
  const res = await fetchWithRetry(`${BASE}/${encodeURIComponent(artifactId)}/share-links`, {
    method: 'GET',
    headers: getHeaders(),
  });
  const json = await handleResponse<{ shareLinks: DocumentShareLink[] }>(
    res,
    'DocumentStudio share links'
  );
  return json.shareLinks;
}

export async function createDocumentStudioShareLink(
  artifactId: string,
  payload: {
    accessScope: DocumentShareLinkAccessScope;
    label?: string;
    expiresAt?: string;
  }
): Promise<DocumentShareLink> {
  const res = await fetchWithRetry(`${BASE}/${encodeURIComponent(artifactId)}/share-links`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await handleResponse<{ shareLink: DocumentShareLink }>(
    res,
    'DocumentStudio create share link'
  );
  return json.shareLink;
}

export async function listDocumentStudioVariants(
  artifactId: string
): Promise<DocumentVariantSummary[]> {
  const res = await fetchWithRetry(`${BASE}/${encodeURIComponent(artifactId)}/variants`, {
    method: 'GET',
    headers: getHeaders(),
  });
  const json = await handleResponse<{ variants: DocumentVariantSummary[] }>(
    res,
    'DocumentStudio variants'
  );
  return json.variants;
}

export async function getDocumentStudioVariant(
  artifactId: string,
  profileId: string
): Promise<DocumentVariant> {
  const res = await fetchWithRetry(
    `${BASE}/${encodeURIComponent(artifactId)}/variants/${encodeURIComponent(profileId)}`,
    {
      method: 'GET',
      headers: getHeaders(),
    }
  );
  const json = await handleResponse<{ variant: DocumentVariant }>(res, 'DocumentStudio variant');
  return json.variant;
}

export async function listDocumentStudioSnapshots(
  artifactId: string
): Promise<DocumentVersionSnapshotSummary[]> {
  const res = await fetchWithRetry(`${BASE}/${encodeURIComponent(artifactId)}/snapshots`, {
    method: 'GET',
    headers: getHeaders(),
  });
  const json = await handleResponse<{ snapshots: DocumentVersionSnapshotSummary[] }>(
    res,
    'DocumentStudio snapshots'
  );
  return json.snapshots;
}

export async function getDocumentStudioSchemaDiff(
  artifactId: string,
  versionId?: string
): Promise<DocumentSchemaDiffResponse> {
  const params = new URLSearchParams();
  if (versionId) params.set('versionId', versionId);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetchWithRetry(`${BASE}/${encodeURIComponent(artifactId)}/diff${query}`, {
    method: 'GET',
    headers: getHeaders(),
  });
  return handleResponse<DocumentSchemaDiffResponse>(res, 'DocumentStudio schema diff');
}

export async function listDocumentStudioApprovals(
  artifactId: string
): Promise<DocumentApprovalRequest[]> {
  const res = await fetchWithRetry(`${BASE}/${encodeURIComponent(artifactId)}/approvals`, {
    method: 'GET',
    headers: getHeaders(),
  });
  const json = await handleResponse<{ approvals: DocumentApprovalRequest[] }>(
    res,
    'DocumentStudio approvals'
  );
  return json.approvals;
}

export async function requestDocumentStudioApproval(
  artifactId: string,
  payload: {
    participants: { userId: string; role?: string; required: boolean }[];
    quorumPolicy?: DocumentApprovalQuorumPolicy;
    reason?: string;
  }
): Promise<DocumentApprovalRequest> {
  const res = await fetchWithRetry(`${BASE}/${encodeURIComponent(artifactId)}/approvals`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await handleResponse<{ approval: DocumentApprovalRequest }>(
    res,
    'DocumentStudio request approval'
  );
  return json.approval;
}

export async function recordDocumentStudioApprovalDecision(
  artifactId: string,
  approvalId: string,
  payload: { kind: DocumentApprovalDecisionKind; comment?: string }
): Promise<DocumentApprovalRequest> {
  const res = await fetchWithRetry(
    `${BASE}/${encodeURIComponent(artifactId)}/approvals/${encodeURIComponent(approvalId)}/decisions`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    }
  );
  const json = await handleResponse<{ approval: DocumentApprovalRequest }>(
    res,
    'DocumentStudio approval decision'
  );
  return json.approval;
}

export async function cancelDocumentStudioApproval(
  artifactId: string,
  approvalId: string,
  reason?: string
): Promise<DocumentApprovalRequest> {
  const res = await fetchWithRetry(
    `${BASE}/${encodeURIComponent(artifactId)}/approvals/${encodeURIComponent(approvalId)}/cancel`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason }),
    }
  );
  const json = await handleResponse<{ approval: DocumentApprovalRequest }>(
    res,
    'DocumentStudio cancel approval'
  );
  return json.approval;
}

export async function listDocumentStudioContentBlocks(
  options: {
    documentType?: DocumentTypeKey;
    language?: 'pl' | 'en';
  } = {}
): Promise<DocumentContentBlockTemplate[]> {
  const params = new URLSearchParams();
  params.set('status', 'active');
  if (options.documentType) params.set('documentType', options.documentType);
  if (options.language) params.set('language', options.language);
  const res = await fetchWithRetry(`${BASE}/content-blocks?${params.toString()}`, {
    method: 'GET',
    headers: getHeaders(),
  });
  const json = await handleResponse<{ contentBlocks: DocumentContentBlockTemplate[] }>(
    res,
    'DocumentStudio content blocks'
  );
  return json.contentBlocks;
}

export async function instantiateDocumentStudioContentBlock(
  contentBlockId: string
): Promise<{ block: DocumentBlock; template: DocumentContentBlockTemplate }> {
  const res = await fetchWithRetry(
    `${BASE}/content-blocks/${encodeURIComponent(contentBlockId)}/instantiate`,
    {
      method: 'POST',
      headers: getHeaders(),
    }
  );
  return handleResponse<{ block: DocumentBlock; template: DocumentContentBlockTemplate }>(
    res,
    'DocumentStudio instantiate content block'
  );
}

export async function insertDocumentStudioContentBlock(
  artifactId: string,
  contentBlockId: string,
  payload: {
    sectionId: string;
    position?: 'start' | 'end' | 'after_block';
    afterBlockId?: string;
  }
): Promise<{ schema: DocumentSchema; insertedBlock: DocumentBlock }> {
  const res = await fetchWithRetry(
    `${BASE}/${encodeURIComponent(artifactId)}/content-blocks/${encodeURIComponent(contentBlockId)}/insert`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    }
  );
  return handleResponse<{ schema: DocumentSchema; insertedBlock: DocumentBlock }>(
    res,
    'DocumentStudio insert content block'
  );
}
