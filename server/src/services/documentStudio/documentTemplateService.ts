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
import {
  __resetTemplateRegistryDaoForTests,
  loadAuditForTemplate,
  loadTemplatesForOrg,
  persistAuditEntry,
  persistTemplate,
  SYSTEM_ORG_ID,
} from './documentTemplateRegistryDao.js';
import { seedSystemDocumentTemplates } from './documentTemplateSeeder.js';

// In-process registry. Key = `${organizationId}::${templateId}` so we never
// leak across tenants by accidental key collision. The registry is the
// SYNCHRONOUS source of truth; persistence is best-effort write-through to
// the DAO and lazy hydration on the first read per organization.
const registryStore = new Map<string, DocumentTemplate>();
const auditStore = new Map<string, TemplateAuditEntry[]>();

// Sprint-1 hydration bookkeeping. `hydratedOrgs` records which tenants have
// already been hydrated from the DAO (and bracketed with the system seeder
// on first invocation). `hydrationInflight` deduplicates concurrent
// requests so two parallel route handlers don't double-load the catalogue.
const hydratedOrgs = new Set<string>();
const hydrationInflight = new Map<string, Promise<void>>();
let systemSeedInflight: Promise<void> | null = null;

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
  // Best-effort write-through to persistence; never blocks the synchronous
  // service surface and never throws (DAO returns `{ ok: false }` on
  // failure, which we deliberately swallow because the in-process audit is
  // already captured for the running session).
  void persistAuditEntry(entry).catch(() => undefined);
}

async function ensureHydrated(organizationId: string): Promise<void> {
  if (hydratedOrgs.has(organizationId)) return;
  const inflight = hydrationInflight.get(organizationId);
  if (inflight) return inflight;

  const promise = (async () => {
    // Seed the system catalogue once per process. The seeder is idempotent
    // at the DAO level (ON CONFLICT DO NOTHING), so concurrent processes
    // are safe; we still gate locally to keep the cold path tight.
    if (!systemSeedInflight) {
      systemSeedInflight = seedSystemDocumentTemplates()
        .then(() => undefined)
        .catch(() => undefined);
    }
    await systemSeedInflight;

    // Load the tenant-scoped templates AND the system-scoped templates so
    // every organization sees the curated catalogue without per-tenant
    // duplication.
    try {
      const [tenantTemplates, systemTemplates] = await Promise.all([
        loadTemplatesForOrg(organizationId),
        organizationId === SYSTEM_ORG_ID
          ? Promise.resolve([])
          : loadTemplatesForOrg(SYSTEM_ORG_ID),
      ]);
      for (const template of tenantTemplates) {
        registryStore.set(templateKey(template.organizationId, template.templateId), template);
        const audit = await loadAuditForTemplate(template.templateId, template.organizationId);
        if (audit.length > 0) {
          auditStore.set(templateKey(template.organizationId, template.templateId), audit);
        }
      }
      for (const template of systemTemplates) {
        registryStore.set(templateKey(SYSTEM_ORG_ID, template.templateId), template);
      }
    } catch {
      // Persistence offline → cache stays empty; subsequent writes will
      // still attempt write-through and the in-process state remains
      // operational for the current process.
    }
    hydratedOrgs.add(organizationId);
  })();

  hydrationInflight.set(organizationId, promise);
  try {
    await promise;
  } finally {
    hydrationInflight.delete(organizationId);
  }
}

/**
 * Public hydration trigger used by route handlers before list/get reads so
 * a cold-start process serves the persisted catalogue (including the
 * 22 × 2 system-seeded templates) on the first request. Idempotent per
 * organization; subsequent calls are no-ops.
 */
export async function ensureTemplateRegistryHydrated(organizationId: string): Promise<void> {
  return ensureHydrated(organizationId);
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
  void persistTemplate(template).catch(() => undefined);
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
  void persistTemplate(refined).catch(() => undefined);
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
  // Tenant-scoped lookup wins; system-org fallback exposes the curated
  // catalogue to every tenant without per-tenant duplication. Non-system
  // organizations cannot pierce another tenant's namespace.
  const tenantHit = registryStore.get(templateKey(organizationId, templateId));
  if (tenantHit) return tenantHit;
  if (organizationId === SYSTEM_ORG_ID) return null;
  return registryStore.get(templateKey(SYSTEM_ORG_ID, templateId)) ?? null;
}

export interface ListTemplatesOptions {
  status?: 'draft' | 'approved' | 'deprecated';
  documentType?: DocumentTypeKey;
}

export function listTemplates(
  organizationId: string,
  options: ListTemplatesOptions = {}
): DocumentTemplate[] {
  const tenantPrefix = `${organizationId}::`;
  const systemPrefix = `${SYSTEM_ORG_ID}::`;
  const templates: DocumentTemplate[] = [];
  // Tenant-scoped templates first.
  for (const [key, template] of registryStore.entries()) {
    if (!key.startsWith(tenantPrefix)) continue;
    if (options.status && template.status !== options.status) continue;
    if (options.documentType && template.documentType !== options.documentType) continue;
    templates.push(template);
  }
  // Merge system catalogue, but never duplicate or self-merge for the
  // synthetic system organization itself.
  if (organizationId !== SYSTEM_ORG_ID) {
    for (const [key, template] of registryStore.entries()) {
      if (!key.startsWith(systemPrefix)) continue;
      if (options.status && template.status !== options.status) continue;
      if (options.documentType && template.documentType !== options.documentType) continue;
      templates.push(template);
    }
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
  void persistTemplate(next).catch(() => undefined);
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
  void persistTemplate(next).catch(() => undefined);
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
  hydratedOrgs.clear();
  hydrationInflight.clear();
  systemSeedInflight = null;
}

/**
 * @internal Test-only helper that ALSO clears the persistence DAO state
 * (in-memory mock backing the wave5 storage). Call from suites that exercise
 * hydration/seeding paths so each test starts from a clean slate.
 */
export async function __resetTemplateRegistryAndPersistenceForTests(): Promise<void> {
  __resetTemplateRegistryForTests();
  await __resetTemplateRegistryDaoForTests();
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
