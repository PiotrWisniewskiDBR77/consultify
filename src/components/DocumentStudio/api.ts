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
  DocumentAuditEntry,
  DocumentEditorProposal,
  DocumentIntake,
  DocumentOutline,
  DocumentSchema,
  DocumentTemplate,
  DocumentTypeKey,
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

interface PlanResponse {
  outline: DocumentOutline;
  llmRefined?: boolean;
}

interface GenerateResponse {
  artifactId: string;
  schema: DocumentSchema;
}

interface GetArtifactResponse {
  schema: DocumentSchema;
}

export interface DocumentExportPayload {
  format: 'markdown' | 'docx' | 'pdf';
  filename: string;
  contentText?: string;
  contentBase64?: string;
  manifest?: Record<string, unknown>;
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

export async function getDocumentStudioArtifact(artifactId: string): Promise<DocumentSchema> {
  const res = await fetchWithRetry(`${BASE}/${encodeURIComponent(artifactId)}`, {
    method: 'GET',
    headers: getHeaders(),
  });
  const json = await handleResponse<GetArtifactResponse>(res, 'DocumentStudio get');
  return json.schema;
}

export async function exportDocumentStudioArtifact(
  artifactId: string,
  format: 'markdown' | 'docx' | 'pdf'
): Promise<DocumentExportPayload> {
  const res = await fetchWithRetry(`${BASE}/${encodeURIComponent(artifactId)}/export/${format}`, {
    method: 'GET',
    headers: getHeaders(),
  });
  return handleResponse<DocumentExportPayload>(res, 'DocumentStudio export');
}

export interface CreateLocalProposalPayload {
  sectionId: string;
  blockId: string;
  instruction: string;
  scope: 'local';
}

export async function createDocumentStudioLocalProposal(
  artifactId: string,
  payload: CreateLocalProposalPayload
): Promise<DocumentEditorProposal> {
  const res = await fetchWithRetry(
    `${BASE}/${encodeURIComponent(artifactId)}/editor/proposals/local`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
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
  payload: { sectionId: string; instruction: string }
): Promise<DocumentEditorProposal> {
  const res = await fetchWithRetry(
    `${BASE}/${encodeURIComponent(artifactId)}/editor/proposals/section`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
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
  payload: { instruction: string }
): Promise<DocumentEditorProposal> {
  const res = await fetchWithRetry(
    `${BASE}/${encodeURIComponent(artifactId)}/editor/proposals/global`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    }
  );
  const json = await handleResponse<{ proposal: DocumentEditorProposal }>(
    res,
    'DocumentStudio create global proposal'
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
