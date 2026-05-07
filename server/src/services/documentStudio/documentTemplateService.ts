/**
 * Consultify Document Studio — Document Template Service (MVP-2).
 *
 * Implements the Document Template Architect doctrine from
 * `docs/product/CONSULTIFY_DOCUMENT_STUDIO_V1_SSOT.md`:
 *
 *   - Mode 2: AI plans a template; user approves; template lands in registry.
 *   - Mode 3: an approved template hydrates the outline and FormattingSchema
 *     for the standard generation pipeline.
 *
 * Storage (MVP-2 boundary): templates live in a tenant-scoped in-process
 * registry, mirroring the editor proposal store from
 * `documentStudioService.ts`. Persistence to a tenant-aware artifact table is
 * scheduled for MVP-3 governance hardening; the service surface is shaped so
 * the swap is mechanical (`registryStore` → DAO, no signature changes).
 *
 * Governance contract:
 *   draft  -> approve   (records `template_approved` audit entry)
 *   draft  -> deprecate (records `template_deprecated` audit entry)
 *   approved -> deprecate (records `template_deprecated` audit entry)
 *   No re-approval of deprecated templates; create a new draft instead.
 *
 * Tenant boundary: every operation accepts and validates `organizationId`;
 * cross-tenant reads return `null`/`not_found` deny-by-default.
 */

import { planDocumentOutline } from './documentNarrativePlanner.js';
import type {
  CommunicationRegister,
  DocumentConfidentiality,
  DocumentDensity,
  DocumentLanguageStyle,
  DocumentTemplate,
  DocumentTypeKey,
  TemplateAuditAction,
  TemplateAuditEntry,
  TemplateCategory,
  TemplateDraftInput,
  TemplateExportRules,
  TemplateSectionBlueprint,
} from './documentStudioTypes.js';
import { DEFAULT_CONSULTING_FORMATTING_SCHEMA } from './documentStudioTypes.js';
import { refineTemplateWithLlm } from './documentTemplateRefiner.js';

// In-process registry. Key = `${organizationId}::${templateId}` so we never
// leak across tenants by accidental key collision.
const registryStore = new Map<string, DocumentTemplate>();
const auditStore = new Map<string, TemplateAuditEntry[]>();

function makeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function templateKey(organizationId: string, templateId: string): string {
  return `${organizationId}::${templateId}`;
}

function pushAudit(entry: TemplateAuditEntry): void {
  const key = templateKey(entry.organizationId, entry.templateId);
  const current = auditStore.get(key) ?? [];
  current.push(entry);
  auditStore.set(key, current);
}

function defaultExportRules(category: TemplateCategory): TemplateExportRules {
  const clientFacing: TemplateCategory[] = [
    'report',
    'proposal',
    'audit',
    'business_case',
    'discovery',
  ];
  const approvalRequiredForExport = clientFacing.includes(category);
  return {
    docx: true,
    pdf: true,
    markdown: true,
    approvalRequiredForExport,
  };
}

function categoryForDocumentType(documentType: DocumentTypeKey): TemplateCategory {
  switch (documentType) {
    case 'executive_memo':
    case 'decision_memo':
      return 'memo';
    case 'project_status_report':
    case 'steering_committee_report':
    case 'benefits_tracking_report':
    case 'portfolio_overview':
    case 'board_report':
    case 'research_report':
    case 'client_final_report':
      return 'report';
    case 'ai_audit_report':
    case 'interview_summary_report':
      return 'audit';
    case 'business_case':
    case 'due_diligence_note':
      return 'business_case';
    case 'sales_proposal':
      return 'proposal';
    case 'sop_document':
      return 'sop';
    case 'implementation_plan':
    case 'change_management_plan':
    case 'digital_transformation_roadmap':
      return 'plan';
    case 'internal_policy_document':
      return 'governance';
    case 'client_discovery_report':
    case 'workshop_summary':
      return 'discovery';
    case 'risk_register_report':
      return 'governance';
    default:
      return 'other';
  }
}

function deriveBlueprintFromDocumentType(
  documentType: DocumentTypeKey,
  density: DocumentDensity
): TemplateSectionBlueprint[] {
  const probeIntake = {
    description: 'Template architect probe',
    documentType,
    density,
  };
  const outline = planDocumentOutline(probeIntake);
  return outline.sections.map((section) => ({
    title: section.title,
    level: section.level,
    purpose: section.purpose,
    required:
      section.title.toLowerCase().includes('executive summary') ||
      section.title.toLowerCase() === 'next steps' ||
      section.title.toLowerCase() === 'recommendations',
    expectedLengthHint: section.expectedLengthHint,
  }));
}

function defaultLanguageStyleFor(category: TemplateCategory): DocumentLanguageStyle {
  if (category === 'sop' || category === 'governance') return 'formal';
  if (category === 'proposal' || category === 'business_case') return 'consulting';
  return 'consulting';
}

function defaultRegisterFor(category: TemplateCategory): CommunicationRegister {
  if (category === 'memo' || category === 'report') return 'executive';
  if (category === 'sop' || category === 'governance') return 'professional';
  return 'professional';
}

function defaultConfidentialityFor(category: TemplateCategory): DocumentConfidentiality {
  if (category === 'proposal' || category === 'discovery') return 'client_confidential';
  if (category === 'governance' || category === 'sop') return 'restricted';
  return 'internal';
}

export interface DraftTemplateParams {
  organizationId: string;
  userId: string;
  input: TemplateDraftInput;
}

export interface DraftTemplateResult {
  template: DocumentTemplate;
}

/**
 * Draft a new template using the deterministic Document Type Taxonomy as a
 * starting point. Higher-fidelity AI refinement of the blueprint is wired
 * through `refineTemplateWithLlm` (see `documentTemplateRefiner.ts`) and is
 * opt-in via `useLlm` on the route layer; this base function stays
 * deterministic so callers always have a usable fallback.
 */
export function draftTemplate(params: DraftTemplateParams): DraftTemplateResult {
  if (!params.organizationId) throw new Error('organizationId is required');
  if (!params.userId) throw new Error('userId is required');
  if (!params.input || typeof params.input.purpose !== 'string') {
    throw new Error('template purpose is required');
  }
  if (params.input.purpose.trim().length === 0) {
    throw new Error('template purpose must not be empty');
  }

  const documentType: DocumentTypeKey = params.input.documentType ?? 'generic_document';
  const category = params.input.category ?? categoryForDocumentType(documentType);
  const density: DocumentDensity = params.input.density ?? 'standard';
  const languageStyle = params.input.languageStyle ?? defaultLanguageStyleFor(category);
  const register = params.input.communicationRegister ?? defaultRegisterFor(category);
  const confidentiality = params.input.confidentiality ?? defaultConfidentialityFor(category);
  const audience = Array.isArray(params.input.audience) ? params.input.audience : [];
  const requiredInputs = Array.isArray(params.input.requiredInputs)
    ? params.input.requiredInputs
    : [];
  const blueprint = deriveBlueprintFromDocumentType(documentType, density);
  const now = nowIso();

  const template: DocumentTemplate = {
    templateId: makeId('doc-template'),
    organizationId: params.organizationId,
    name: params.input.name?.trim() || `${documentType.replace(/_/g, ' ')} template`,
    category,
    documentType,
    purpose: params.input.purpose.trim(),
    audience,
    language: params.input.language ?? 'pl',
    languageStyle,
    communicationRegister: register,
    density,
    confidentiality,
    requiredInputs,
    sectionBlueprint: blueprint,
    formattingSchema: { ...DEFAULT_CONSULTING_FORMATTING_SCHEMA },
    exportRules: defaultExportRules(category),
    status: 'draft',
    version: '0.1',
    createdBy: params.userId,
    createdAt: now,
    updatedAt: now,
    notes: params.input.notes?.trim() || undefined,
  };

  registryStore.set(templateKey(params.organizationId, template.templateId), template);
  pushAudit({
    auditId: makeId('doc-template-audit'),
    templateId: template.templateId,
    organizationId: params.organizationId,
    action: 'template_drafted',
    actorId: params.userId,
    occurredAt: now,
    details: { documentType, category },
  });
  return { template };
}

export interface DraftTemplateAsyncParams extends DraftTemplateParams {
  /** Optional opt-in LLM refinement of section purposes + template name. */
  useLlm?: boolean;
}

export interface DraftTemplateAsyncResult extends DraftTemplateResult {
  llmRefined: boolean;
}

/**
 * Draft + optionally refine a template via the bounded AI Template Architect.
 * On any LLM failure path the deterministic draft is preserved unchanged.
 * The persisted registry record is the (possibly refined) template, plus an
 * extra `template_updated` audit entry when refinement actually changed
 * anything.
 */
export async function draftTemplateAsync(
  params: DraftTemplateAsyncParams
): Promise<DraftTemplateAsyncResult> {
  const baseResult = draftTemplate(params);
  if (!params.useLlm) return { ...baseResult, llmRefined: false };

  const refined = await refineTemplateWithLlm(baseResult.template, params.input, {
    enable: true,
  });

  const changed =
    refined.name !== baseResult.template.name ||
    refined.sectionBlueprint.some((section, idx) => {
      const original = baseResult.template.sectionBlueprint[idx];
      return original ? section.purpose !== original.purpose : true;
    });

  if (!changed) return { ...baseResult, llmRefined: false };

  registryStore.set(templateKey(params.organizationId, refined.templateId), refined);
  pushAudit({
    auditId: makeId('doc-template-audit'),
    templateId: refined.templateId,
    organizationId: params.organizationId,
    action: 'template_updated',
    actorId: params.userId,
    occurredAt: refined.updatedAt,
    details: { source: 'ai_template_architect_refiner' },
  });

  return { template: refined, llmRefined: true };
}

export function getTemplate(templateId: string, organizationId: string): DocumentTemplate | null {
  return registryStore.get(templateKey(organizationId, templateId)) ?? null;
}

export interface ListTemplatesOptions {
  status?: 'draft' | 'approved' | 'deprecated';
  documentType?: DocumentTypeKey;
}

export function listTemplates(
  organizationId: string,
  options: ListTemplatesOptions = {}
): DocumentTemplate[] {
  const prefix = `${organizationId}::`;
  const templates: DocumentTemplate[] = [];
  for (const [key, template] of registryStore.entries()) {
    if (!key.startsWith(prefix)) continue;
    if (options.status && template.status !== options.status) continue;
    if (options.documentType && template.documentType !== options.documentType) continue;
    templates.push(template);
  }
  // Newest first.
  return templates.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
}

export interface ApproveTemplateParams {
  templateId: string;
  organizationId: string;
  userId: string;
  notes?: string;
}

export function approveTemplate(params: ApproveTemplateParams): DocumentTemplate {
  const template = getTemplate(params.templateId, params.organizationId);
  if (!template) throw new Error('template_not_found');
  if (template.status === 'deprecated') throw new Error('template_deprecated');
  if (template.status === 'approved') return template;
  const now = nowIso();
  const next: DocumentTemplate = {
    ...template,
    status: 'approved',
    version: bumpVersion(template.version, 'approve'),
    approvedBy: params.userId,
    approvedAt: now,
    updatedAt: now,
    notes: params.notes?.trim() || template.notes,
  };
  registryStore.set(templateKey(params.organizationId, template.templateId), next);
  pushAudit({
    auditId: makeId('doc-template-audit'),
    templateId: template.templateId,
    organizationId: params.organizationId,
    action: 'template_approved',
    actorId: params.userId,
    occurredAt: now,
    details: { previousStatus: template.status, version: next.version },
  });
  return next;
}

export interface DeprecateTemplateParams {
  templateId: string;
  organizationId: string;
  userId: string;
  reason?: string;
}

export function deprecateTemplate(params: DeprecateTemplateParams): DocumentTemplate {
  const template = getTemplate(params.templateId, params.organizationId);
  if (!template) throw new Error('template_not_found');
  if (template.status === 'deprecated') return template;
  const now = nowIso();
  const next: DocumentTemplate = {
    ...template,
    status: 'deprecated',
    deprecatedBy: params.userId,
    deprecatedAt: now,
    updatedAt: now,
  };
  registryStore.set(templateKey(params.organizationId, template.templateId), next);
  pushAudit({
    auditId: makeId('doc-template-audit'),
    templateId: template.templateId,
    organizationId: params.organizationId,
    action: 'template_deprecated',
    actorId: params.userId,
    occurredAt: now,
    details: { previousStatus: template.status, reason: params.reason },
  });
  return next;
}

export function listTemplateAuditEntries(
  templateId: string,
  organizationId: string
): TemplateAuditEntry[] {
  return [...(auditStore.get(templateKey(organizationId, templateId)) ?? [])];
}

/**
 * MVP-2 boundary helper: callers in the orchestrator use this to confirm a
 * template is usable for Mode 3 generation. Defensively returns false for
 * mismatched tenants.
 */
export function isTemplateUsableForGeneration(
  template: DocumentTemplate | null,
  organizationId: string
): boolean {
  if (!template) return false;
  if (template.organizationId !== organizationId) return false;
  return template.status === 'approved';
}

function bumpVersion(version: string, action: 'approve'): string {
  // Promote the patch-level version on first approval; subsequent approvals
  // are no-ops in MVP-2 (deprecate + redraft is the supported flow).
  const match = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(version);
  if (!match) return action === 'approve' ? '1.0' : version;
  const major = Number(match[1] || '0');
  const minor = Number(match[2] || '0');
  if (major === 0) return '1.0';
  return `${major}.${minor + 1}`;
}

// ===== Test-only helpers =====
// These exist purely so the in-process registry can be reset between tests.
// Production callers MUST NOT use them (the wave5 persistence migration in
// MVP-3 will remove them).
/** @internal */
export function __resetTemplateRegistryForTests(): void {
  registryStore.clear();
  auditStore.clear();
}

/** @internal */
export function __recordTemplateAuditActionForTests(
  templateId: string,
  organizationId: string,
  action: TemplateAuditAction,
  actorId: string
): void {
  pushAudit({
    auditId: makeId('doc-template-audit-test'),
    templateId,
    organizationId,
    action,
    actorId,
    occurredAt: nowIso(),
  });
}
