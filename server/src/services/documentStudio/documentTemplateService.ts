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
  DocumentSchema,
  DocumentTemplate,
  DocumentTypeKey,
  FormattingSchema,
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
        organizationId === SYSTEM_ORG_ID ? Promise.resolve([]) : loadTemplatesForOrg(SYSTEM_ORG_ID),
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
  return outline.sections.map((section) => {
    const normalized = section.title.toLowerCase();
    const premiumBusinessCase =
      documentType === 'business_case'
        ? normalized.includes('executive summary')
          ? {
              formattingStyle: 'executive_kpi_strip_with_recommendation_callout',
              contentHints: ['Lead with the investment decision', 'Show value, cost and timing'],
            }
          : normalized.includes('scenario')
            ? {
                formattingStyle: 'scenario_comparison_table_with_assumptions',
                contentHints: ['Compare investment, value and delivery risk by scenario'],
              }
            : normalized.includes('risk')
              ? { formattingStyle: 'risk_table_with_owner_and_mitigation' }
              : normalized.includes('30/60/90')
                ? { formattingStyle: 'thirty_sixty_ninety_day_roadmap' }
                : normalized.includes('recommendation')
                  ? { formattingStyle: 'decision_callout_with_conditions' }
                  : {}
        : {};
    return {
      title: section.title,
      level: section.level,
      purpose: section.purpose,
      required:
        section.title.toLowerCase().includes('executive summary') ||
        section.title.toLowerCase() === 'next steps' ||
        section.title.toLowerCase() === 'recommendations',
      expectedLengthHint: section.expectedLengthHint,
      ...premiumBusinessCase,
    };
  });
}

function validateBusinessCaseBlueprint(sections: TemplateSectionBlueprint[]): void {
  const titles = sections.map((section) => section.title.toLowerCase()).join(' | ');
  if (!/(methodology|approach|scope)/i.test(titles)) {
    throw new Error('business_case_scope_or_approach_required');
  }
  if (!/(assumption|scenario)/i.test(titles)) {
    throw new Error('business_case_assumptions_or_scenarios_required');
  }
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

/** Coarse block-count → length-hint heuristic for cloned sections (no word-count pass). */
function lengthHintFromBlockCount(
  blockCount: number
): TemplateSectionBlueprint['expectedLengthHint'] {
  if (blockCount <= 2) return 'short';
  if (blockCount <= 5) return 'medium';
  return 'long';
}

export interface CreateTemplateFromArtifactParams {
  organizationId: string;
  userId: string;
  /** Full schema of the source native artifact (Document Studio), as returned by `getDocumentArtifact`. */
  schema: DocumentSchema;
  /** Optional template name override; defaults to `${schema.title} (Copy)`. */
  name?: string;
  notes?: string;
  /**
   * Fala 2 (2026-07-28) — "Zrób z tego wzorzec" clarifying question #1
   * ("Czy każda sekcja ma zawsze występować, czy niektóre są opcjonalne?").
   * `sectionId`s the author marked as NOT always present. Everything the
   * mechanical extraction CAN deduce (titles, order, level, length) stays
   * automatic — this is the one thing it cannot: whether a section is a
   * fixed fixture of the template or only showed up in this one instance.
   * Unset/absent sectionIds default to `required: true` (unchanged from the
   * pre-Fala-2 behaviour).
   */
  optionalSectionIds?: string[];
  /**
   * Clarifying question #2 ("Które dane mają się za każdym razem
   * odświeżać?"). Free text, one item per line from the modal — appended to
   * `notes` verbatim (never fabricated into fake per-section `dataNeeded`,
   * which the mechanical extraction has no evidence for).
   */
  dataRefreshHints?: string[];
  /**
   * Clarifying question #3 ("Kolory razem z treścią, czy osobno?"). `true`
   * (default) keeps `schema.formattingSchema` as-is, including any
   * `colorTemplateId` the source document carried. `false` strips
   * `colorTemplateId` so the new template has NO saved color pattern — the
   * consultant then picks one explicitly per generation, or sets one later
   * in the Template Architect (Fala 1's `ColorPatternPicker`). This is the
   * literal N31 "można je nakładać, ale niekoniecznie" choice, applied at
   * extraction time instead of only at generation time.
   */
  carryColorPattern?: boolean;
  /**
   * Clarifying question #4 ("Czy coś jest specyficzne tylko dla tego
   * klienta i trzeba to usunąć?"). The mechanical extraction only copies
   * section TITLES/purposes, never body content — so there is no
   * automatic redaction to perform. This free text is instead surfaced
   * prominently in `notes` (prefixed) so a human reviews it before
   * approving the draft (templates are draft-until-approved regardless —
   * this makes the review target obvious rather than silently trusting the
   * extraction).
   */
  sensitiveContentNotes?: string;
}

/**
 * CLONE — Word (Document Studio) native artifact → draft template.
 *
 * Companion to `draftTemplate` (which plans a template from a taxonomy
 * probe with no real content). This one carries over the ACTUAL structure
 * of an existing document (`schema.sections`) into `sectionBlueprint`, so
 * "save an existing document as a template" (clone → edit → save-as-new)
 * produces a template that mirrors what the author already built instead
 * of a generic deterministic outline.
 *
 * Persists through the same draft/registry/DAO path as `draftTemplate`
 * (in-process registry + best-effort write-through to
 * `document_studio_templates`); the resulting draft template is
 * immediately usable via `POST /document-studio/generate` with
 * `templateId` (Mode 3), same as any other drafted template.
 */
export function createTemplateFromArtifact(
  params: CreateTemplateFromArtifactParams
): DraftTemplateResult {
  if (!params.organizationId) throw new Error('organizationId is required');
  if (!params.userId) throw new Error('userId is required');
  const schema = params.schema;
  if (!schema || typeof schema !== 'object') {
    throw new Error('source document schema is required');
  }

  const documentType: DocumentTypeKey = schema.documentType ?? 'generic_document';
  const category = categoryForDocumentType(documentType);
  const density: DocumentDensity = schema.density ?? 'standard';

  // Fala 2 — question #1: everything else about the blueprint (titles,
  // order, level, expectedLengthHint) is deduced mechanically; `required`
  // is the one field a human must decide (default true, matching the
  // pre-Fala-2 behaviour when no answer is given).
  const optionalSectionIds = new Set(
    Array.isArray(params.optionalSectionIds) ? params.optionalSectionIds : []
  );
  const sourceSections = Array.isArray(schema.sections) ? schema.sections : [];
  const clonedBlueprint: TemplateSectionBlueprint[] = sourceSections
    .slice()
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
    .map((section) => ({
      title: section.title,
      level: section.level,
      purpose: section.purpose?.trim() || section.title,
      required: !optionalSectionIds.has(section.sectionId),
      expectedLengthHint: lengthHintFromBlockCount(
        Array.isArray(section.blocks) ? section.blocks.length : 0
      ),
    }));
  const blueprint =
    clonedBlueprint.length > 0
      ? clonedBlueprint
      : deriveBlueprintFromDocumentType(documentType, density);

  // Fala 2 — question #3: "razem" (default) keeps formattingSchema as-is
  // (including any colorTemplateId); "osobno" strips the pattern so the new
  // template has none saved (see `CreateTemplateFromArtifactParams` doc).
  const sourceFormattingSchema = schema.formattingSchema ?? {
    ...DEFAULT_CONSULTING_FORMATTING_SCHEMA,
  };
  const formattingSchema =
    params.carryColorPattern === false
      ? { ...sourceFormattingSchema, colorTemplateId: undefined }
      : sourceFormattingSchema;

  // Fala 2 — questions #2/#4: no automatic per-section splitting or
  // redaction is attempted (no evidence to base it on) — both are
  // surfaced verbatim in `notes` so a human sees them before approving.
  const noteParts: string[] = [];
  if (params.notes?.trim()) noteParts.push(params.notes.trim());
  else noteParts.push(`Cloned from artifact ${schema.artifactId || schema.documentId}`);
  const dataRefreshHints = (params.dataRefreshHints || [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (dataRefreshHints.length > 0) {
    noteParts.push(`Dane do odświeżania za każdym razem: ${dataRefreshHints.join('; ')}`);
  }
  if (params.sensitiveContentNotes?.trim()) {
    noteParts.push(
      `⚠ Do przejrzenia przed użyciem (treść specyficzna dla klienta): ${params.sensitiveContentNotes.trim()}`
    );
  }

  const now = nowIso();
  const template: DocumentTemplate = {
    templateId: makeId('doc-template'),
    organizationId: params.organizationId,
    name: params.name?.trim() || `${schema.title || 'Untitled document'} (Copy)`,
    category,
    documentType,
    purpose: schema.title?.trim() || `${documentType.replace(/_/g, ' ')} template`,
    audience: Array.isArray(schema.audience) ? schema.audience : [],
    language: schema.language ?? 'pl',
    languageStyle: schema.languageStyle ?? defaultLanguageStyleFor(category),
    communicationRegister: schema.communicationRegister ?? defaultRegisterFor(category),
    density,
    confidentiality: schema.confidentiality ?? defaultConfidentialityFor(category),
    requiredInputs: [],
    sectionBlueprint: blueprint,
    formattingSchema,
    exportRules: defaultExportRules(category),
    status: 'draft',
    version: '0.1',
    createdBy: params.userId,
    createdAt: now,
    updatedAt: now,
    notes: noteParts.join(' | '),
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
    details: {
      documentType,
      category,
      clonedFromArtifactId: schema.artifactId || null,
      optionalSectionCount: optionalSectionIds.size,
      carryColorPattern: params.carryColorPattern !== false,
      hasDataRefreshHints: dataRefreshHints.length > 0,
      hasSensitiveContentNotes: Boolean(params.sensitiveContentNotes?.trim()),
    },
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

export interface ReviseTemplateStructureParams {
  templateId: string;
  organizationId: string;
  userId: string;
  /**
   * Author-authored section blueprint. Unlike the LLM refiner
   * (`documentTemplateRefiner.ts`, purpose-rewrite only), this path accepts
   * full STRUCTURAL edits — add / remove / reorder / rename — because the
   * user is the template author. Only anti-garbage guards remain (non-empty
   * titles, at least one section, a sane cap).
   */
  sections: TemplateSectionBlueprint[];
  /**
   * Fala 1 (2026-07-28) — "wzorzec kolorów" (N31). `undefined` = field not
   * sent, leave `formattingSchema.colorTemplateId` untouched. `null` or
   * `''` = explicitly cleared. Saved alongside structure edits because both
   * are draft-only author actions on the same screen (the Template
   * Architect's outline editor) — see `DocumentStudioTemplateArchitectView.tsx`.
   */
  colorTemplateId?: string | null;
  /** Complete author-owned Word formatting contract (draft-only). */
  formattingSchema?: FormattingSchema;
  /** Source-pack inputs required before Mode 3 generation. */
  requiredInputs?: string[];
}

const MAX_TEMPLATE_SECTIONS = 60;
// Mirrors the Deck Template Architect's contentHints cap
// (`presentationTemplateDraftService.ts`) — kept in sync manually.
const MAX_CONTENT_HINTS_PER_SECTION = 4;
const MAX_CONTENT_HINT_CHARS = 100;
// Mirrors the caps in `documentTemplateRefiner.ts` — kept in sync manually.
const MAX_KEY_MESSAGE_CHARS = 200;
const MAX_DATA_NEEDED_ITEMS = 6;
const MAX_DATA_NEEDED_CHARS = 100;
const MAX_SUGGESTED_EVIDENCE_CHARS = 150;
const MAX_HEADER_FOOTER_CONTENT_CHARS = 200;

function normalizeTemplateFormattingSchema(schema: FormattingSchema): FormattingSchema {
  const normalized = JSON.parse(JSON.stringify(schema)) as FormattingSchema;
  const normalizeContent = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim().slice(0, MAX_HEADER_FOOTER_CONTENT_CHARS);
    return trimmed.length > 0 ? trimmed : undefined;
  };
  const headerContent = normalizeContent(normalized.headers?.content);
  const footerContent = normalizeContent(normalized.footers?.content);
  if (headerContent) normalized.headers.content = headerContent;
  else delete normalized.headers.content;
  if (footerContent) normalized.footers.content = footerContent;
  else delete normalized.footers.content;
  return normalized;
}

/**
 * Sanitize a single author-supplied section blueprint. Coerces the two
 * enum-ish fields to their legal range, trims text, and defends every
 * optional array field. Throws `template_section_title_required` when the
 * title is blank — the one hard structural guard we keep.
 */
function sanitizeAuthoredSection(raw: unknown): TemplateSectionBlueprint {
  const input = (raw ?? {}) as Partial<TemplateSectionBlueprint>;
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (title.length === 0) throw new Error('template_section_title_required');
  const level = input.level === 2 ? 2 : input.level === 3 ? 3 : 1;
  const expectedLengthHint =
    input.expectedLengthHint === 'short' || input.expectedLengthHint === 'long'
      ? input.expectedLengthHint
      : 'medium';
  const cleanStringArray = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const cleaned = value
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
    return cleaned.length > 0 ? cleaned : undefined;
  };
  // Lenient — an invalid/missing value just means "no hints", mirrors
  // `sanitizeContentHints` in `documentTemplateRefiner.ts` /
  // `presentationTemplateDraftService.ts`.
  const cleanContentHints = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const cleaned = value
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .map((v) => v.trim().slice(0, MAX_CONTENT_HINT_CHARS))
      .slice(0, MAX_CONTENT_HINTS_PER_SECTION);
    return cleaned.length > 0 ? cleaned : undefined;
  };
  const section: TemplateSectionBlueprint = {
    title,
    level,
    purpose: typeof input.purpose === 'string' ? input.purpose.trim() : '',
    required: input.required === true,
    expectedLengthHint,
  };
  const requiredData = cleanStringArray(input.requiredData);
  if (requiredData) section.requiredData = requiredData;
  const optionalData = cleanStringArray(input.optionalData);
  if (optionalData) section.optionalData = optionalData;
  if (typeof input.formattingStyle === 'string' && input.formattingStyle.trim().length > 0) {
    section.formattingStyle = input.formattingStyle.trim();
  }
  if (input.approvalRequired === true) section.approvalRequired = true;
  const contentHints = cleanContentHints(input.contentHints);
  if (contentHints) section.contentHints = contentHints;
  // Lenient — analogous caps to `contentHints`, mirrors
  // `documentTemplateRefiner.ts`'s sanitize* helpers.
  if (typeof input.keyMessage === 'string' && input.keyMessage.trim().length > 0) {
    section.keyMessage = input.keyMessage.trim().slice(0, MAX_KEY_MESSAGE_CHARS);
  }
  const dataNeeded = Array.isArray(input.dataNeeded)
    ? input.dataNeeded
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .map((v) => v.trim().slice(0, MAX_DATA_NEEDED_CHARS))
        .slice(0, MAX_DATA_NEEDED_ITEMS)
    : [];
  if (dataNeeded.length > 0) section.dataNeeded = dataNeeded;
  if (typeof input.suggestedEvidence === 'string' && input.suggestedEvidence.trim().length > 0) {
    section.suggestedEvidence = input.suggestedEvidence
      .trim()
      .slice(0, MAX_SUGGESTED_EVIDENCE_CHARS);
  }
  return section;
}

/**
 * Persist an author's manual structural edits to a draft template's section
 * blueprint (robota C1). Structural changes (add / remove / reorder / rename)
 * are ACCEPTED here — the deterministic draft and the LLM refiner are only
 * *starting points*; the human author has final say over structure. Guards
 * kept: draft-only (approved / deprecated templates are immutable), at least
 * one section, no blank titles, a sane upper bound.
 */
export function reviseTemplateStructure(params: ReviseTemplateStructureParams): DocumentTemplate {
  if (!params.organizationId) throw new Error('organizationId is required');
  if (!params.userId) throw new Error('userId is required');
  const template = getTemplate(params.templateId, params.organizationId);
  if (!template) throw new Error('template_not_found');
  // Only a draft that this tenant owns is editable. Never mutate the shared
  // system catalogue or an already-governed (approved/deprecated) record.
  const ownedByTenant = registryStore.has(templateKey(params.organizationId, params.templateId));
  if (!ownedByTenant) throw new Error('template_not_found');
  if (template.status !== 'draft') throw new Error('template_not_draft');
  if (!Array.isArray(params.sections) || params.sections.length === 0) {
    throw new Error('template_sections_required');
  }
  if (params.sections.length > MAX_TEMPLATE_SECTIONS) {
    throw new Error('template_sections_too_many');
  }

  const sectionBlueprint = params.sections.map(sanitizeAuthoredSection);
  if (template.documentType === 'business_case') validateBusinessCaseBlueprint(sectionBlueprint);
  const now = nowIso();
  // Fala 1 (2026-07-28) — "wzorzec kolorów" (N31). `undefined` leaves the
  // existing formattingSchema untouched; `null`/`''` clears the pattern.
  let formattingSchema = params.formattingSchema
    ? normalizeTemplateFormattingSchema(params.formattingSchema)
    : template.formattingSchema;
  if (params.colorTemplateId !== undefined) {
    formattingSchema = { ...formattingSchema, colorTemplateId: params.colorTemplateId || null };
  }
  const requiredInputs =
    params.requiredInputs === undefined
      ? template.requiredInputs
      : [...new Set(params.requiredInputs.map((v) => String(v).trim()).filter(Boolean))];
  const next: DocumentTemplate = {
    ...template,
    sectionBlueprint,
    formattingSchema,
    requiredInputs,
    updatedAt: now,
  };
  registryStore.set(templateKey(params.organizationId, template.templateId), next);
  void persistTemplate(next).catch(() => undefined);
  pushAudit({
    auditId: makeId('doc-template-audit'),
    templateId: template.templateId,
    organizationId: params.organizationId,
    action: 'template_updated',
    actorId: params.userId,
    occurredAt: now,
    details: {
      source: 'author_manual_structure_edit',
      sectionCount: sectionBlueprint.length,
      previousSectionCount: template.sectionBlueprint.length,
      colorTemplateChanged: params.colorTemplateId !== undefined,
      formattingChanged: params.formattingSchema !== undefined,
      requiredInputsChanged: params.requiredInputs !== undefined,
    },
  });
  return next;
}

export interface UpdateTemplateContentParams {
  templateId: string;
  organizationId: string;
  userId: string;
  name?: string;
  notes?: string;
  sections?: TemplateSectionBlueprint[];
}

/**
 * Direct author-owned content edit (fala sprzątania 1b, 2026-07-27) — the
 * Template Library "Biblioteka" CRUD path
 * (`server/src/services/deliverableTemplateService.ts` PUT
 * `/api/deliverables/templates/:id`), NOT the AI Template Architect
 * governance flow. `reviseTemplateStructure` above is deliberately
 * draft-only — it protects the drafted-then-human-reviewed Architect
 * lifecycle. This path is for templates a user authored directly
 * end-to-end via the shared Template Library form and owns outright, where
 * there is no separate "draft vs. approved" review step to protect —
 * mirrors the always-editable behaviour the legacy `report_builder_templates`
 * rows had (no approval concept at all). Allowed on `draft` OR `approved`
 * templates; `deprecated` templates stay immutable (create a new draft
 * instead, same rule as `reviseTemplateStructure`).
 */
export function updateTemplateContent(params: UpdateTemplateContentParams): DocumentTemplate {
  if (!params.organizationId) throw new Error('organizationId is required');
  if (!params.userId) throw new Error('userId is required');
  const template = getTemplate(params.templateId, params.organizationId);
  if (!template) throw new Error('template_not_found');
  const ownedByTenant = registryStore.has(templateKey(params.organizationId, params.templateId));
  if (!ownedByTenant) throw new Error('template_not_found');
  if (template.status === 'deprecated') throw new Error('template_deprecated');

  let sectionBlueprint = template.sectionBlueprint;
  if (params.sections !== undefined) {
    if (!Array.isArray(params.sections) || params.sections.length === 0) {
      throw new Error('template_sections_required');
    }
    if (params.sections.length > MAX_TEMPLATE_SECTIONS) {
      throw new Error('template_sections_too_many');
    }
    sectionBlueprint = params.sections.map(sanitizeAuthoredSection);
  }

  const now = nowIso();
  const trimmedName = params.name?.trim();
  const next: DocumentTemplate = {
    ...template,
    name: trimmedName || template.name,
    notes: params.notes !== undefined ? params.notes.trim() || undefined : template.notes,
    sectionBlueprint,
    updatedAt: now,
  };
  registryStore.set(templateKey(params.organizationId, template.templateId), next);
  void persistTemplate(next).catch(() => undefined);
  pushAudit({
    auditId: makeId('doc-template-audit'),
    templateId: template.templateId,
    organizationId: params.organizationId,
    action: 'template_updated',
    actorId: params.userId,
    occurredAt: now,
    details: { source: 'template_library_content_edit' },
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
 *
 * R1 (doc slice, 2026-07-24) — SYSTEM catalogue fix. `getTemplate` above
 * deliberately falls back to the SYSTEM org so the curated catalogue is
 * visible to every tenant "without per-tenant duplication" (see :484-490).
 * A strict `organizationId` equality here contradicted that: every curated
 * template resolved through the fallback carries `organizationId ===
 * SYSTEM_ORG_ID` and therefore failed Mode 3 with `template_not_usable`.
 * On demo that is 44 of 45 document templates — i.e. the exact rows the
 * Template Library surfaces. Accepting the SYSTEM org restores the
 * documented intent while keeping the approval requirement.
 *
 * Cross-tenant access remains impossible: `getTemplate` never returns
 * another tenant's row, so the only extra rows admitted here are the
 * curated system ones this module already publishes to all tenants.
 */
export function isTemplateUsableForGeneration(
  template: DocumentTemplate | null,
  organizationId: string
): boolean {
  if (!template) return false;
  if (template.organizationId !== organizationId && template.organizationId !== SYSTEM_ORG_ID) {
    return false;
  }
  return template.status === 'approved';
}

// =============================================================================
// Slice E14 — Template product fields (usage telemetry + feedback aggregate).
//
// FR-06 closure: "discover the right template" requires registry-side
// signal that drives sort order + visibility. E14 delivers the SUBSTRATE
// (in-process accumulators + audit-trail entries + service-side helpers
// the FE-E2 template picker can consume). The DAO / migration that
// persists these fields across process restarts is a follow-up slice
// (E14.persistence) — keeping this slice substrate-only minimizes
// blast radius and avoids file collisions with parallel agents that
// are currently active in the DAO layer.
//
// All product fields are optional on `DocumentTemplate`; absent values
// are treated as "no signal yet" and backwards-compatible with every
// pre-E14 consumer.
// =============================================================================

export interface RecordTemplateUsageParams {
  templateId: string;
  organizationId: string;
  /** Actor who triggered the Mode-3 generation that consumed the template. */
  userId: string;
  /** Optional override for `lastUsedAt` (testing / backfill). Defaults to now. */
  occurredAt?: string;
  /** Optional pointer to the artifact produced from this usage (audit trail). */
  artifactId?: string;
}

/**
 * Increment `usageCount` and refresh `lastUsedAt` on the template. Emits a
 * `template_usage_recorded` audit entry so the registry has a per-event
 * trail (the running counter is a denormalized projection of the trail).
 *
 * Returns the updated template, or `null` when the template is not in
 * the cache for the given organization (caller decides whether to
 * surface a 404 or silently skip — the in-process registry is the
 * source of truth for live tenants).
 *
 * Failure modes resolve to `null`. The audit entry is best-effort
 * write-through-persisted via the existing `pushAudit()` plumbing.
 */
export function recordTemplateUsage(params: RecordTemplateUsageParams): DocumentTemplate | null {
  const { templateId, organizationId, userId } = params;
  const trimmedTemplateId = (templateId ?? '').trim();
  const trimmedOrgId = (organizationId ?? '').trim();
  const trimmedUserId = (userId ?? '').trim();
  if (!trimmedTemplateId || !trimmedOrgId || !trimmedUserId) {
    return null;
  }

  const key = templateKey(trimmedOrgId, trimmedTemplateId);
  const existing = registryStore.get(key);
  if (!existing) return null;

  const occurredAt = params.occurredAt ?? nowIso();
  const previousCount = typeof existing.usageCount === 'number' ? existing.usageCount : 0;
  const next: DocumentTemplate = {
    ...existing,
    usageCount: previousCount + 1,
    lastUsedAt: occurredAt,
    updatedAt: occurredAt,
  };
  registryStore.set(key, next);
  void persistTemplate(next).catch(() => undefined);

  pushAudit({
    auditId: makeId('doc-template-audit'),
    templateId: trimmedTemplateId,
    organizationId: trimmedOrgId,
    action: 'template_usage_recorded',
    actorId: trimmedUserId,
    occurredAt,
    details: {
      previousUsageCount: previousCount,
      nextUsageCount: previousCount + 1,
      ...(params.artifactId ? { artifactId: params.artifactId } : {}),
    },
  });
  return next;
}

export interface RecordTemplateFeedbackParams {
  templateId: string;
  organizationId: string;
  /** Actor submitting the rating. */
  userId: string;
  /** 1..5 inclusive integer rating. Out-of-range values are rejected. */
  rating: number;
  /** Optional free-form comment (audit-trail only; not surfaced on the template). */
  comment?: string;
  /** Optional override for the audit timestamp; defaults to now. */
  occurredAt?: string;
}

/**
 * Record a 1..5 quality rating on the template, updating the running
 * average + sample size in O(1):
 *   nextScore = (prevScore * prevSize + rating) / (prevSize + 1)
 *   nextSize  = prevSize + 1
 *
 * Returns the updated template, or `null` when:
 *   - template is not in the cache for the given organization;
 *   - rating is not a finite integer in [1..5];
 *   - any required string param is empty/whitespace.
 *
 * The full rating event is captured as a `template_feedback_recorded`
 * audit entry so reviewers can drill down from the aggregate to the
 * underlying ratings (with optional consultant comments).
 */
export function recordTemplateFeedback(
  params: RecordTemplateFeedbackParams
): DocumentTemplate | null {
  const { templateId, organizationId, userId, rating } = params;
  const trimmedTemplateId = (templateId ?? '').trim();
  const trimmedOrgId = (organizationId ?? '').trim();
  const trimmedUserId = (userId ?? '').trim();
  if (!trimmedTemplateId || !trimmedOrgId || !trimmedUserId) {
    return null;
  }
  if (!Number.isFinite(rating) || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return null;
  }

  const key = templateKey(trimmedOrgId, trimmedTemplateId);
  const existing = registryStore.get(key);
  if (!existing) return null;

  const prevScore =
    typeof existing.feedbackQualityScore === 'number' ? existing.feedbackQualityScore : 0;
  const prevSize =
    typeof existing.feedbackSampleSize === 'number' ? existing.feedbackSampleSize : 0;
  const nextSize = prevSize + 1;
  const nextScore = (prevScore * prevSize + rating) / nextSize;

  const occurredAt = params.occurredAt ?? nowIso();
  const next: DocumentTemplate = {
    ...existing,
    feedbackQualityScore: nextScore,
    feedbackSampleSize: nextSize,
    updatedAt: occurredAt,
  };
  registryStore.set(key, next);
  void persistTemplate(next).catch(() => undefined);

  pushAudit({
    auditId: makeId('doc-template-audit'),
    templateId: trimmedTemplateId,
    organizationId: trimmedOrgId,
    action: 'template_feedback_recorded',
    actorId: trimmedUserId,
    occurredAt,
    details: {
      rating,
      previousScore: prevScore,
      previousSampleSize: prevSize,
      nextScore,
      nextSampleSize: nextSize,
      ...(params.comment ? { comment: params.comment } : {}),
    },
  });
  return next;
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
