/**
 * Consultify Document Studio — Orchestrator.
 *
 * Pipeline:
 *   1) `planDocumentOutline` — Document Narrative Planner produces an outline.
 *   2) `materializeDocumentArtifact` — content generator fills the schema and
 *      persists a V8 native artifact via wave5ArtifactRuntimeService. The
 *      artifact `content` field carries the rendered markdown projection of
 *      the schema; the schema itself is stored in the artifact metadata for
 *      structured re-use.
 *   3) `getDocumentArtifact` — fetches the artifact and returns the schema.
 *   4) `exportDocumentArtifact` — returns markdown plus the wave5 export manifest.
 *
 * Modes:
 *   - Mode 1 (no template): outline planned from intake; FormattingSchema is
 *     the canonical default consulting profile.
 *   - Mode 3 (approved template): outline + FormattingSchema + per-section
 *     metadata are hydrated from the registered template. Template draft mode
 *     (Mode 2) is owned by `documentTemplateService.ts`.
 */

import {
  buildWave5ExportManifest,
  createWave5Artifact,
  getWave5Artifact,
  markWave5ArtifactExported,
} from '../wave5ArtifactRuntimeService.js';
import {
  ensureBrandVoiceRegistryHydrated,
  getActiveBrandVoiceProfile,
} from './documentBrandVoiceService.js';
import type {
  CreateDocumentCommentParams,
  DeleteDocumentCommentParams,
  ListDocumentCommentsOptions,
  ListDocumentCommentThreadsOptions,
  ReopenDocumentCommentParams,
  ReplyToDocumentCommentParams,
  ResolveDocumentCommentParams,
} from './documentCommentsService.js';
import {
  createDocumentComment as createDocumentCommentInternal,
  deleteDocumentComment as deleteDocumentCommentInternal,
  DocumentCommentError,
  ensureDocumentCommentsHydrated,
  getDocumentComment,
  getDocumentCommentSectionCounts,
  listDocumentComments,
  listDocumentCommentThreads,
  registerDocumentCommentsAuditPump,
  reopenDocumentComment as reopenDocumentCommentInternal,
  replyToDocumentComment as replyToDocumentCommentInternal,
  resolveDocumentComment as resolveDocumentCommentInternal,
} from './documentCommentsService.js';
import { buildDocumentSchema } from './documentContentGenerator.js';
import { renderDocumentSchemaToDocxBuffer } from './documentDocxRenderer.js';
import { refineEditorTextWithLlm } from './documentEditorRefiner.js';
import type {
  DocumentLifecycleState,
  TransitionDocumentStatusParams,
} from './documentLifecycleService.js';
import {
  __forceTransitionDocumentStatusForRollback,
  DocumentLifecycleTransitionError,
  ensureDocumentLifecycleHydrated,
  getDocumentLifecycleState,
  getDocumentStatusOrDefault,
  initializeDocumentLifecycle,
  registerDocumentLifecycleAuditPump,
  transitionDocumentStatus as transitionDocumentStatusInternal,
} from './documentLifecycleService.js';
import { planDocumentOutline } from './documentNarrativePlanner.js';
import { refineOutlineWithLlm } from './documentNarrativeRefiner.js';
import { renderDocumentSchemaToPdfBuffer } from './documentPdfRenderer.js';
import {
  canOverrideQa,
  QaBlockingError,
  QaOverrideUnauthorizedError,
  requiresApprovalForExport,
  runDocumentQa,
} from './documentQaService.js';
import {
  computeDocumentSchemaDiff,
  summarizeDocumentSchemaDiff,
} from './documentSchemaDiffService.js';
import { renderSchemaToMarkdown } from './documentSchemaRenderer.js';
import type {
  DocumentAuditEntry,
  DocumentEditorProposal,
  DocumentEditorProposalInput,
  DocumentExportResult,
  DocumentIntake,
  DocumentOutline,
  DocumentProposalStatus,
  DocumentQaReport,
  DocumentRunResult,
  DocumentSchema,
  DocumentSourceRef,
  DocumentTemplate,
  DocumentVersionSnapshot,
  DocumentVersionSnapshotOrigin,
} from './documentStudioTypes.js';
import {
  getTemplate as getRegisteredTemplate,
  isTemplateUsableForGeneration,
  recordTemplateUsage,
} from './documentTemplateService.js';
import {
  createDocumentVersionSnapshot as createDocumentVersionSnapshotInternal,
  ensureDocumentVersionSnapshotsHydrated,
  getDocumentVersionSnapshot,
  getDocumentVersionSnapshotByNumber,
  getMostRecentDocumentVersionSnapshot,
  listDocumentVersionSnapshots,
  registerDocumentVersionSnapshotAuditPump,
} from './documentVersionSnapshotService.js';

/**
 * Slice E15.wiring.snapshot.proposal — return the `versionId` of
 * the most recent snapshot for the artifact, or `undefined` when
 * no snapshot exists yet. Best-effort: any failure resolves to
 * `undefined` so proposal creation never fails because of the
 * `versionBeforeId` wiring.
 */
function resolveProposalVersionBeforeId(
  artifactId: string,
  organizationId: string
): string | undefined {
  try {
    const recent = getMostRecentDocumentVersionSnapshot(artifactId, organizationId);
    return recent?.versionId;
  } catch {
    return undefined;
  }
}

const SCHEMA_METADATA_KEY = 'documentStudioSchema';
const STUDIO_MODE_METADATA_KEY = 'documentStudioMode';
const STUDIO_DOC_TYPE_METADATA_KEY = 'documentStudioDocumentType';
const STUDIO_TEMPLATE_ID_METADATA_KEY = 'documentStudioTemplateId';
const STUDIO_TEMPLATE_VERSION_METADATA_KEY = 'documentStudioTemplateVersion';
const proposalStore = new Map<string, DocumentEditorProposal>();
const auditStore = new Map<string, DocumentAuditEntry[]>();
/**
 * Per-artifact schema overlay — Epic E5 Slice 5.3.
 *
 * Wave5 stores the schema in `artifact.metadata_json` (and a mirror in
 * `artifact.content_json`), but the wave5 mutation pipeline is
 * heavyweight (proposal → approval → commit) and not the right shape
 * for non-content lifecycle operations like rollback. The overlay
 * holds the live schema in-process; `getDocumentArtifact` consults
 * the overlay first and falls back to wave5.
 *
 * Today only the rollback orchestrator writes here, so existing
 * proposal-based edits keep flowing through wave5. A follow-up slice
 * will consolidate proposal commits to also write through here so
 * subsequent reads reflect the executed proposal.
 */
const schemaOverlayStore = new Map<string, DocumentSchema>();

function schemaOverlayKey(artifactId: string, organizationId: string): string {
  return `${artifactId}::${organizationId}`;
}

export interface PlanDocumentParams {
  intake: DocumentIntake;
}

export interface PlanDocumentResult {
  outline: DocumentOutline;
}

function validateIntake(
  intake: DocumentIntake | null | undefined
): asserts intake is DocumentIntake {
  if (!intake || typeof intake.description !== 'string') {
    throw new Error('Document intake requires a description string.');
  }
  if (intake.description.trim().length === 0) {
    throw new Error('Document intake description must not be empty.');
  }
}

export function planDocument(params: PlanDocumentParams): PlanDocumentResult {
  validateIntake(params.intake);
  return { outline: planDocumentOutline(params.intake) };
}

/**
 * Async variant of `planDocument` that optionally applies LLM refinement to
 * the deterministic outline. The refinement is bounded (reorder + purpose
 * rewrite) and falls back silently to the deterministic outline on any
 * failure path. See `documentNarrativeRefiner.ts`.
 */
export async function planDocumentAsync(
  params: PlanDocumentParams & { useLlm?: boolean }
): Promise<PlanDocumentResult> {
  validateIntake(params.intake);
  const deterministic = planDocumentOutline(params.intake);
  if (!params.useLlm) return { outline: deterministic };
  const refined = await refineOutlineWithLlm(deterministic, params.intake, { enable: true });
  return { outline: refined };
}

export interface MaterializeDocumentParams {
  organizationId: string;
  userId: string;
  intake: DocumentIntake;
  outline?: DocumentOutline;
  sourceRefs?: DocumentSourceRef[];
  projectId?: string | null;
  useLlm?: boolean;
  /**
   * When set, hydrate the outline and FormattingSchema from an approved
   * registered template (Mode 3). The template must belong to the same
   * organization as the call site; cross-tenant template IDs are rejected.
   */
  templateId?: string | null;
  /**
   * Slice E15.wiring.materialize — explicit `sourcePackId` propagated
   * onto the resulting `DocumentSchema.sourcePackId` artifact-ref
   * field (spec §8.1). When present, downstream consumers can resolve
   * the source pack without re-reading the wave5 attach audit row.
   * Optional; defaults to undefined.
   */
  sourcePackId?: string | null;
  /**
   * Slice E15.wiring.materialize — explicit `clientId` propagated
   * onto `DocumentSchema.clientId` (spec §8.1). When present, the
   * artifact carries the client binding without forcing consumers to
   * walk the project / source-pack graph. Optional; defaults to
   * undefined.
   */
  clientId?: string | null;
}

/**
 * Source-pack preflight error. Surfaced to callers when a Mode 3 template
 * declares `requiredInputs` that are not satisfied by the call-site source
 * pack. Carries structured `missing` so the UI can render a remediation
 * checklist instead of a generic 400.
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
 * A required input is satisfied when at least one provided source ref
 * mentions every significant token of the requirement, across `sourceType`,
 * `sourceId`, and `sourceTitle`. Match is case-insensitive and tokenized on
 * non-alphanumeric characters; this stays generous on purpose so consultants
 * can express requirements in plain language ("Discovery interview
 * transcript") and still pass when the source pack carries an item titled
 * "Discovery Interview – CFO transcript".
 */
const STOP_WORDS = new Set(['a', 'an', 'and', 'the', 'of', 'for', 'to', 'with', 'on', 'in', 'or']);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function isRequirementSatisfied(requirement: string, sourceRefs: DocumentSourceRef[]): boolean {
  const tokens = tokenize(requirement);
  if (tokens.length === 0) return true;
  return sourceRefs.some((ref) => {
    const haystack = tokenize(
      [ref.sourceType ?? '', ref.sourceId ?? '', ref.sourceTitle ?? ''].join(' ')
    );
    if (haystack.length === 0) return false;
    const haystackSet = new Set(haystack);
    return tokens.every((token) => haystackSet.has(token));
  });
}

export function preflightRequiredSources(
  template: DocumentTemplate | null,
  sourceRefs: DocumentSourceRef[]
): { ok: true } | { ok: false; missing: string[] } {
  if (!template || template.requiredInputs.length === 0) return { ok: true };
  const missing = template.requiredInputs.filter((req) => !isRequirementSatisfied(req, sourceRefs));
  if (missing.length === 0) return { ok: true };
  return { ok: false, missing };
}

function outlineFromTemplate(template: DocumentTemplate, intake: DocumentIntake): DocumentOutline {
  return {
    documentType: template.documentType,
    title: intake.title?.trim() || `${template.documentType.replace(/_/g, ' ')}: ${template.name}`,
    sections: template.sectionBlueprint.map((blueprint) => ({
      title: blueprint.title,
      level: blueprint.level,
      purpose: blueprint.purpose,
      expectedLengthHint: blueprint.expectedLengthHint,
    })),
    recommendedDensity: template.density,
    recommendedRegister: template.communicationRegister,
    recommendedLanguageStyle: template.languageStyle,
  };
}

export async function materializeDocumentArtifact(
  params: MaterializeDocumentParams
): Promise<DocumentRunResult> {
  if (!params.organizationId) throw new Error('organizationId is required');
  if (!params.userId) throw new Error('userId is required');

  // Mode resolution: Mode 3 (template-driven) takes precedence if a templateId
  // is provided AND the template is approved for the calling organization.
  let mode: 'mode_1' | 'mode_3' = 'mode_1';
  let template: DocumentTemplate | null = null;
  if (params.templateId) {
    const candidate = getRegisteredTemplate(params.templateId, params.organizationId);
    if (!isTemplateUsableForGeneration(candidate, params.organizationId)) {
      throw new Error('template_not_usable');
    }
    template = candidate;
    mode = 'mode_3';
  }

  // Source-pack preflight. Runs only when a template is in play; templates
  // express their data dependencies explicitly via `requiredInputs`. Mode 1
  // falls back to per-block `isAssumption` flags emitted by the content
  // generator, which is sufficient for the looser "no template" doctrine.
  const incomingSourceRefs = params.sourceRefs ?? [];
  if (template) {
    const preflight = preflightRequiredSources(template, incomingSourceRefs);
    if (!preflight.ok) {
      throw new MissingRequiredSourceError(preflight.missing);
    }
  }

  let outline: DocumentOutline;
  if (params.outline) {
    outline = params.outline;
  } else if (template) {
    outline = outlineFromTemplate(template, params.intake);
  } else {
    outline = planDocumentOutline(params.intake);
    if (params.useLlm) {
      outline = await refineOutlineWithLlm(outline, params.intake, { enable: true });
    }
  }

  const sourceRefs = incomingSourceRefs;

  const provisionalArtifactId = `documentstudio-pending-${Date.now()}`;
  const provisionalSchema = buildDocumentSchema({
    artifactId: provisionalArtifactId,
    intake: params.intake,
    outline,
    sourceRefs,
  });
  if (template) {
    provisionalSchema.formattingSchema = template.formattingSchema;
    provisionalSchema.confidentiality = template.confidentiality;
    provisionalSchema.languageStyle = template.languageStyle;
    provisionalSchema.communicationRegister = template.communicationRegister;
    provisionalSchema.density = template.density;
    // Slice E15.wiring.materialize — populate the §15.1 artifact-ref
    // `templateRef` substrate field so audit / lifecycle / FE-E2
    // consumers can recover the canonical (templateId, version) pair
    // directly from the schema, without re-walking wave5 metadata.
    provisionalSchema.templateRef = {
      templateId: template.templateId,
      templateVersion: template.version,
    };
  }
  // Slice E15.wiring.materialize — populate the remaining §15.1
  // artifact-ref substrate fields. `sourcePackId` flows from the
  // chat-first creation orchestration; `clientId` flows from the
  // intake or an explicit override; `owner` is the caller user id
  // (the source-of-truth for "who created this artifact").
  if (params.sourcePackId) {
    provisionalSchema.sourcePackId = params.sourcePackId;
  }
  if (params.clientId) {
    provisionalSchema.clientId = params.clientId;
  }
  provisionalSchema.owner = params.userId;

  const markdown = renderSchemaToMarkdown(provisionalSchema);

  const metadata: Record<string, unknown> = {
    [SCHEMA_METADATA_KEY]: provisionalSchema,
    [STUDIO_MODE_METADATA_KEY]: mode,
    [STUDIO_DOC_TYPE_METADATA_KEY]: outline.documentType,
  };
  if (template) {
    metadata[STUDIO_TEMPLATE_ID_METADATA_KEY] = template.templateId;
    metadata[STUDIO_TEMPLATE_VERSION_METADATA_KEY] = template.version;
  }

  const artifact = await createWave5Artifact({
    organizationId: params.organizationId,
    userId: params.userId,
    artifactType: 'report',
    title: provisionalSchema.title,
    content: markdown,
    canonicalFormat: 'markdown',
    contentMd: markdown,
    contentJson: provisionalSchema,
    contentSchemaVersion: 'document_studio_v1',
    projectId: params.projectId ?? null,
    sourceRefs: sourceRefs as unknown[],
    metadata,
  });

  const artifactId = String(artifact?.artifactId ?? artifact?.artifact_id ?? provisionalArtifactId);
  const finalSchema: DocumentSchema = { ...provisionalSchema, artifactId };

  // Slice E14.recordUsage.wiring — when a template was actually
  // consumed by this materialization, increment `usageCount` and
  // refresh `lastUsedAt`. Best-effort: the registry hot path treats a
  // missing template as a no-op and never throws.
  if (template) {
    try {
      recordTemplateUsage({
        templateId: template.templateId,
        organizationId: params.organizationId,
        userId: params.userId,
        artifactId,
      });
    } catch {
      // Recording usage MUST NEVER fail materialization. The audit
      // trail lives in the document audit log via the
      // `template_usage_recorded` action.
    }
  }

  // Epic E5 — seed lifecycle state at draft on first materialization.
  // initializeDocumentLifecycle is idempotent so repeated calls (e.g.
  // re-tries) do not reset the status of an in-progress document.
  initializeDocumentLifecycle({
    organizationId: params.organizationId,
    artifactId,
    actorId: params.userId,
  });
  const lifecycle = getDocumentStatusOrDefault(artifactId, params.organizationId);
  finalSchema.documentStatus = lifecycle.status;
  finalSchema.statusChangedAt = lifecycle.statusChangedAt;
  finalSchema.statusChangedBy = lifecycle.statusChangedBy;

  return { artifactId, schema: finalSchema };
}

export async function getDocumentArtifact(
  artifactId: string,
  organizationId: string
): Promise<DocumentSchema | null> {
  // Epic E5 — consult the in-process schema overlay first so callers
  // see the post-rollback schema even though wave5 still holds the
  // pre-rollback row. The overlay is tenant-scoped via the composite
  // key so a cross-tenant request never resolves another tenant's
  // overlaid schema.
  const overlay = schemaOverlayStore.get(schemaOverlayKey(artifactId, organizationId));
  if (overlay) {
    const lifecycle = getDocumentStatusOrDefault(artifactId, organizationId);
    return {
      ...overlay,
      documentStatus: lifecycle.status,
      statusChangedAt: lifecycle.statusChangedAt,
      statusChangedBy: lifecycle.statusChangedBy,
      statusReason: lifecycle.statusReason,
    };
  }

  const artifact = await getWave5Artifact(artifactId, organizationId);
  if (!artifact) return null;

  const metadata = parseMetadata(artifact.metadata_json ?? artifact.metadata);
  const schemaCandidate = metadata?.[SCHEMA_METADATA_KEY];
  let schema: DocumentSchema | null = null;
  if (schemaCandidate && typeof schemaCandidate === 'object') {
    schema = schemaCandidate as DocumentSchema;
  } else {
    const contentJson = parseMetadata(artifact.content_json);
    if (contentJson && typeof contentJson === 'object') {
      schema = contentJson as unknown as DocumentSchema;
    }
  }
  if (schema) {
    // Overlay current lifecycle state. Historical artifacts that
    // pre-date Epic E5 do not have lifecycle persisted yet — overlay
    // returns 'draft' as a safe default.
    const lifecycle = getDocumentStatusOrDefault(artifactId, organizationId);
    return {
      ...schema,
      documentStatus: lifecycle.status,
      statusChangedAt: lifecycle.statusChangedAt,
      statusChangedBy: lifecycle.statusChangedBy,
      statusReason: lifecycle.statusReason,
    };
  }

  return null;
}

export interface ExportDocumentOptions {
  /** Actor performing the export; required to audit QA-block / override events. */
  userId?: string;
  /**
   * Effective role of the actor as resolved by the auth middleware
   * (`SUPERADMIN`, `OWNER`, `ADMIN`, `PROJECT_MANAGER`, `MEMBER`, …).
   * The service uses it to enforce `canOverrideQa(role)` when
   * `qaOverride: true` is passed.
   */
  userRole?: string;
  /**
   * When `true`, bypass the QA blocking gate and emit a `qa_override_export`
   * audit entry. The service enforces `canOverrideQa(userRole)` and
   * throws `QaOverrideUnauthorizedError` when the role is not allowed
   * (auditing the denied attempt as `qa_override_denied`).
   */
  qaOverride?: boolean;
}

export async function exportDocumentArtifact(
  artifactId: string,
  organizationId: string,
  format: 'markdown' | 'docx' | 'pdf',
  options: ExportDocumentOptions = {}
): Promise<DocumentExportResult> {
  const artifact = await getWave5Artifact(artifactId, organizationId);
  if (!artifact) throw new Error('Document artifact not found');

  const manifest = await buildWave5ExportManifest(artifactId, organizationId);
  const filename = `${(artifact.title || 'document')
    .toString()
    .replace(/[^a-z0-9_-]+/gi, '_')
    .toLowerCase()}.${format}`;

  // QA gate: load the schema (also needed for binary renderers below) and
  // run QA when the document type is approval-gated. The gate runs for
  // every export format — including markdown — so callers can't sidestep
  // by switching format. Markdown export of an artifact missing a schema
  // (legacy path) preserves the original behavior and skips the gate.
  const schema = await getDocumentArtifact(artifactId, organizationId);
  if (!schema) {
    if (format === 'markdown') {
      return {
        format,
        filename,
        contentText: String(artifact.content ?? ''),
        manifest,
      };
    }
    throw new Error('Document schema not found on artifact');
  }

  if (requiresApprovalForExport(schema.documentType)) {
    // Role-gated override: enforce BEFORE running QA so that an
    // unauthorized override attempt is logged independently of whether
    // QA itself would have passed.
    if (options.qaOverride && !canOverrideQa(options.userRole)) {
      pushAuditEntry({
        auditId: makeId('doc-audit'),
        artifactId,
        organizationId,
        action: 'qa_override_denied',
        actorId: options.userId ?? 'system',
        occurredAt: nowIso(),
        details: {
          format,
          documentType: schema.documentType,
          attemptedRole: options.userRole ?? null,
        },
      });
      throw new QaOverrideUnauthorizedError(options.userRole ?? '');
    }

    // Resolve the tenant's active brand voice profile (Epic E7) so QA
    // can layer tenant lexicon on top of the global catalogue. Hydration
    // is idempotent + best-effort; persistence outage degrades to the
    // global baseline silently.
    await ensureBrandVoiceRegistryHydrated(organizationId);
    const activeBrandVoiceProfile = getActiveBrandVoiceProfile(organizationId);

    const report = runDocumentQa(schema, { brandVoiceProfile: activeBrandVoiceProfile });
    report.organizationId = organizationId;

    // Compact, audit-friendly snapshot of the report. Used both in the
    // export manifest and in the audit `details` so the audit panel can
    // replay the QA state at export time without re-running QA.
    const reportSnapshot = {
      anyBlocking: report.anyBlocking,
      categories: report.categories.map((c) => ({
        category: c.category,
        score: c.score,
        blocking: c.blocking,
        findingsCount: c.findings.length,
      })),
      blockingFindings: report.categories
        .filter((c) => c.blocking)
        .flatMap((c) =>
          c.findings.map((f) => ({
            category: c.category,
            severity: f.severity,
            code: f.code,
            sectionId: f.sectionId,
            blockId: f.blockId,
          }))
        ),
    };

    if (report.anyBlocking && !options.qaOverride) {
      pushAuditEntry({
        auditId: makeId('doc-audit'),
        artifactId,
        organizationId,
        action: 'qa_blocked_export',
        actorId: options.userId ?? 'system',
        occurredAt: nowIso(),
        details: {
          format,
          documentType: schema.documentType,
          blockingCategories: report.categories.filter((c) => c.blocking).map((c) => c.category),
          qaReport: reportSnapshot,
        },
      });
      throw new QaBlockingError(report);
    }
    if (report.anyBlocking && options.qaOverride) {
      pushAuditEntry({
        auditId: makeId('doc-audit'),
        artifactId,
        organizationId,
        action: 'qa_override_export',
        actorId: options.userId ?? 'system',
        occurredAt: nowIso(),
        details: {
          format,
          documentType: schema.documentType,
          actorRole: options.userRole ?? null,
          blockingCategories: report.categories.filter((c) => c.blocking).map((c) => c.category),
          qaReport: reportSnapshot,
        },
      });
      (manifest as Record<string, unknown>).qaOverride = true;
    }
    (manifest as Record<string, unknown>).qaReportSummary = {
      anyBlocking: report.anyBlocking,
      categories: report.categories.map((c) => ({
        category: c.category,
        score: c.score,
        blocking: c.blocking,
      })),
    };
  }

  if (format === 'markdown') {
    return {
      format,
      filename,
      contentText: String(artifact.content ?? ''),
      manifest,
    };
  }

  // DOCX/PDF: render directly from the structured DocumentSchema so the
  // FormattingSchema (page, margins, headers, footers, page numbering,
  // confidentiality) is honored without round-tripping through markdown.
  // Persist the export through the wave5 pipeline by marking the artifact
  // as `exported` once a binary payload has been produced (audit-friendly:
  // matches `markWave5ArtifactExported` semantics used by the V8 runtime).
  let binary: Buffer;
  if (format === 'docx') {
    binary = await renderDocumentSchemaToDocxBuffer(schema);
  } else {
    binary = await renderDocumentSchemaToPdfBuffer(schema);
  }

  try {
    await markWave5ArtifactExported(artifactId, organizationId);
  } catch (err) {
    // The export status update is best-effort. We surface failure in the
    // manifest so callers can audit it but never block the binary delivery.
    (manifest as Record<string, unknown>).exportStatusUpdateError =
      err instanceof Error ? err.message : String(err);
  }

  return {
    format,
    filename,
    contentBase64: binary.toString('base64'),
    manifest: {
      ...manifest,
      renderedFromSchema: true,
      byteLength: binary.byteLength,
    },
  };
}

// Re-export QA-related errors and policy so the route layer can catch
// them and consult the policy without reaching into the QA service
// module directly.
export {
  canOverrideQa,
  QaBlockingError,
  QaOverrideUnauthorizedError,
} from './documentQaService.js';

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`;
}

function proposalKey(artifactId: string, proposalId: string): string {
  return `${artifactId}:${proposalId}`;
}

function getAuditKey(artifactId: string, organizationId: string): string {
  return `${artifactId}:${organizationId}`;
}

function pushAuditEntry(entry: DocumentAuditEntry): void {
  const key = getAuditKey(entry.artifactId, entry.organizationId);
  const current = auditStore.get(key) ?? [];
  current.push(entry);
  auditStore.set(key, current);
}

// Wire the lifecycle + snapshot services' audit emissions into the
// studio's per-artifact audit store so every status change / snapshot
// creation / rollback shows up in `listDocumentAuditEntries(...)`
// alongside proposals + QA decisions. Registration is module-scope so
// it runs exactly once per process boot (and is harmless when the
// studio service is re-imported in isolated test files — the
// downstream module overwrites the pump).
registerDocumentLifecycleAuditPump(pushAuditEntry);
registerDocumentVersionSnapshotAuditPump(pushAuditEntry);
registerDocumentCommentsAuditPump(pushAuditEntry);

function blockToEditableText(content: unknown): string {
  if (!content || typeof content !== 'object') return '';
  const payload = content as Record<string, unknown>;
  const text = payload.text;
  if (typeof text === 'string') return text;
  if (Array.isArray(payload.items)) {
    return payload.items.map((item) => String(item)).join('\n');
  }
  return JSON.stringify(content);
}

function applyInstruction(before: string, instruction: string): string {
  const normalizedInstruction = instruction.trim();
  if (!normalizedInstruction) {
    throw new Error('instruction is required');
  }
  const trimmedBefore = before.trim();
  if (!trimmedBefore) {
    return `Edited content: ${normalizedInstruction}`;
  }
  return `${trimmedBefore}\n\n[Edited with instruction: ${normalizedInstruction}]`;
}

function withBlockText(content: unknown, text: string): unknown {
  if (!content || typeof content !== 'object') {
    return { text };
  }
  const payload = { ...(content as Record<string, unknown>) };
  if (typeof payload.text === 'string') {
    payload.text = text;
    return payload;
  }
  if (Array.isArray(payload.items)) {
    payload.items = text
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    return payload;
  }
  payload.text = text;
  return payload;
}

function cloneSchema(schema: DocumentSchema): DocumentSchema {
  return JSON.parse(JSON.stringify(schema)) as DocumentSchema;
}

function findSectionAndBlock(schema: DocumentSchema, sectionId: string, blockId: string) {
  const section = schema.sections.find((item) => item.sectionId === sectionId);
  if (!section) {
    throw new Error('section_not_found');
  }
  const block = section.blocks.find((item) => item.blockId === blockId);
  if (!block) {
    throw new Error('block_not_found');
  }
  return { section, block };
}

async function computeRefinedAfter(
  before: string,
  instruction: string,
  context: {
    schema: DocumentSchema;
    scope: 'local' | 'section' | 'global';
  },
  useLlm: boolean,
  fallback: string
): Promise<string> {
  if (!useLlm) return fallback;
  const refined = await refineEditorTextWithLlm(before, instruction, {
    documentType: context.schema.documentType,
    scope: context.scope,
    communicationRegister: context.schema.communicationRegister,
    language: context.schema.language,
  });
  return refined ?? fallback;
}

export interface CreateLocalEditProposalParams {
  artifactId: string;
  organizationId: string;
  userId: string;
  input: DocumentEditorProposalInput;
  /** Opt-in bounded LLM rewrite. Falls back deterministically on any failure. */
  useLlm?: boolean;
}

export async function createLocalEditProposal(
  params: CreateLocalEditProposalParams
): Promise<DocumentEditorProposal> {
  const { artifactId, organizationId, userId, input } = params;
  if (input.scope !== 'local') {
    throw new Error('unsupported_scope');
  }
  if (!input.sectionId || !input.blockId) {
    throw new Error('section_and_block_required');
  }
  const schema = await getDocumentArtifact(artifactId, organizationId);
  if (!schema) {
    throw new Error('artifact_not_found');
  }
  const { block } = findSectionAndBlock(schema, input.sectionId, input.blockId);
  const before = blockToEditableText(block.content);
  const deterministicAfter = applyInstruction(before, input.instruction);
  const after = await computeRefinedAfter(
    before,
    input.instruction,
    { schema, scope: 'local' },
    Boolean(params.useLlm),
    deterministicAfter
  );
  const createdAt = nowIso();
  const proposal: DocumentEditorProposal = {
    proposalId: makeId('doc-proposal'),
    artifactId,
    organizationId,
    scope: 'local',
    sectionId: input.sectionId,
    blockId: input.blockId,
    instruction: input.instruction.trim(),
    affectedSectionIds: [input.sectionId],
    status: 'proposed',
    diff: { before, after },
    createdBy: userId,
    createdAt,
    // Slice E15.wiring.snapshot.proposal — pin the proposal to the
    // most recent snapshot so audit / FE-E2 review surfaces can
    // recover the exact schema state the proposal was authored
    // against. `versionAfterId` is set in a follow-up slice when an
    // accept-proposal / apply path lands.
    versionBeforeId: resolveProposalVersionBeforeId(artifactId, organizationId),
  };
  proposalStore.set(proposalKey(artifactId, proposal.proposalId), proposal);
  pushAuditEntry({
    auditId: makeId('doc-audit'),
    artifactId,
    organizationId,
    proposalId: proposal.proposalId,
    action: 'proposal_created',
    actorId: userId,
    occurredAt: createdAt,
    details: { scope: proposal.scope, sectionId: input.sectionId, blockId: input.blockId },
  });
  return proposal;
}

// =============================================================================
// MVP-3 — Editor section + global scope proposals.
// =============================================================================

interface SectionMarkdownProjection {
  sectionId: string;
  title: string;
  before: string;
  after: string;
}

function projectSectionToText(section: DocumentSchema['sections'][number]): string {
  const lines: string[] = [`## ${section.title}`];
  for (const block of section.blocks) {
    const text = blockToEditableText(block.content).trim();
    if (text.length > 0) lines.push(text);
  }
  return lines.join('\n\n');
}

function applyInstructionToBlock(content: unknown, instruction: string): unknown {
  const before = blockToEditableText(content);
  const after = applyInstruction(before, instruction);
  return withBlockText(content, after);
}

export interface CreateSectionEditProposalParams {
  artifactId: string;
  organizationId: string;
  userId: string;
  sectionId: string;
  instruction: string;
  /** Opt-in bounded LLM rewrite. Falls back deterministically on any failure. */
  useLlm?: boolean;
}

export async function createSectionEditProposal(
  params: CreateSectionEditProposalParams
): Promise<DocumentEditorProposal> {
  const { artifactId, organizationId, userId, sectionId, instruction } = params;
  const trimmed = instruction.trim();
  if (!trimmed) throw new Error('instruction is required');
  const schema = await getDocumentArtifact(artifactId, organizationId);
  if (!schema) throw new Error('artifact_not_found');
  const section = schema.sections.find((s) => s.sectionId === sectionId);
  if (!section) throw new Error('section_not_found');

  const before = projectSectionToText(section);
  const blockRewrites: Record<string, string> = {};
  let llmRefined = false;
  if (params.useLlm) {
    for (const block of section.blocks) {
      const blockBefore = blockToEditableText(block.content);
      const refined = await refineEditorTextWithLlm(blockBefore, trimmed, {
        documentType: schema.documentType,
        scope: 'section',
        communicationRegister: schema.communicationRegister,
        language: schema.language,
      });
      if (refined) {
        blockRewrites[block.blockId] = refined;
        llmRefined = true;
      }
    }
  }
  const previewAfter = llmRefined
    ? section.blocks
        .map((block) => blockRewrites[block.blockId] ?? blockToEditableText(block.content))
        .join('\n\n')
    : `${before}\n\n[Section-scope edit applied at approval: ${trimmed}]`;
  const createdAt = nowIso();
  const proposal: DocumentEditorProposal = {
    proposalId: makeId('doc-proposal'),
    artifactId,
    organizationId,
    scope: 'section',
    sectionId,
    instruction: trimmed,
    affectedSectionIds: [sectionId],
    blockRewrites: llmRefined ? blockRewrites : undefined,
    llmRefined: llmRefined || undefined,
    status: 'proposed',
    diff: { before, after: previewAfter },
    createdBy: userId,
    createdAt,
    // Slice E15.wiring.snapshot.proposal — pin the proposal to the
    // most recent snapshot so audit / FE-E2 review surfaces can
    // recover the exact schema state the proposal was authored
    // against. `versionAfterId` is set in a follow-up slice when an
    // accept-proposal / apply path lands.
    versionBeforeId: resolveProposalVersionBeforeId(artifactId, organizationId),
  };
  proposalStore.set(proposalKey(artifactId, proposal.proposalId), proposal);
  pushAuditEntry({
    auditId: makeId('doc-audit'),
    artifactId,
    organizationId,
    proposalId: proposal.proposalId,
    action: 'proposal_created',
    actorId: userId,
    occurredAt: createdAt,
    details: { scope: 'section', sectionId },
  });
  return proposal;
}

export interface CreateGlobalEditProposalParams {
  artifactId: string;
  organizationId: string;
  userId: string;
  instruction: string;
  /** Opt-in bounded LLM rewrite. Falls back deterministically on any failure. */
  useLlm?: boolean;
}

export async function createGlobalEditProposal(
  params: CreateGlobalEditProposalParams
): Promise<DocumentEditorProposal> {
  const { artifactId, organizationId, userId, instruction } = params;
  const trimmed = instruction.trim();
  if (!trimmed) throw new Error('instruction is required');
  const schema = await getDocumentArtifact(artifactId, organizationId);
  if (!schema) throw new Error('artifact_not_found');
  if (schema.sections.length === 0) {
    throw new Error('document_has_no_sections');
  }

  const blockRewrites: Record<string, string> = {};
  let llmRefined = false;
  if (params.useLlm) {
    for (const section of schema.sections) {
      for (const block of section.blocks) {
        const blockBefore = blockToEditableText(block.content);
        const refined = await refineEditorTextWithLlm(blockBefore, trimmed, {
          documentType: schema.documentType,
          scope: 'global',
          communicationRegister: schema.communicationRegister,
          language: schema.language,
        });
        if (refined) {
          blockRewrites[block.blockId] = refined;
          llmRefined = true;
        }
      }
    }
  }

  const projections: SectionMarkdownProjection[] = schema.sections.map((section) => {
    const before = projectSectionToText(section);
    const after = llmRefined
      ? [
          `## ${section.title}`,
          ...section.blocks.map(
            (block) => blockRewrites[block.blockId] ?? blockToEditableText(block.content)
          ),
        ]
          .filter((line) => line.trim().length > 0)
          .join('\n\n')
      : `${before}\n\n[Global edit at approval: ${trimmed}]`;
    return {
      sectionId: section.sectionId,
      title: section.title,
      before,
      after,
    };
  });

  const before = projections.map((p) => p.before).join('\n\n---\n\n');
  const after = projections.map((p) => p.after).join('\n\n---\n\n');
  const createdAt = nowIso();
  const proposal: DocumentEditorProposal = {
    proposalId: makeId('doc-proposal'),
    artifactId,
    organizationId,
    scope: 'global',
    instruction: trimmed,
    affectedSectionIds: schema.sections.map((s) => s.sectionId),
    blockRewrites: llmRefined ? blockRewrites : undefined,
    llmRefined: llmRefined || undefined,
    status: 'proposed',
    diff: { before, after },
    createdBy: userId,
    createdAt,
    // Slice E15.wiring.snapshot.proposal — pin the proposal to the
    // most recent snapshot so audit / FE-E2 review surfaces can
    // recover the exact schema state the proposal was authored
    // against. `versionAfterId` is set in a follow-up slice when an
    // accept-proposal / apply path lands.
    versionBeforeId: resolveProposalVersionBeforeId(artifactId, organizationId),
  };
  proposalStore.set(proposalKey(artifactId, proposal.proposalId), proposal);
  pushAuditEntry({
    auditId: makeId('doc-audit'),
    artifactId,
    organizationId,
    proposalId: proposal.proposalId,
    action: 'proposal_created',
    actorId: userId,
    occurredAt: createdAt,
    details: { scope: 'global', affectedSectionCount: proposal.affectedSectionIds.length },
  });
  return proposal;
}

// =============================================================================
// Sprint 4 (Epic E3) — Editor methodology + source scope proposals.
// =============================================================================

/**
 * Title heuristics for methodology-aligned sections. PL+EN. Matched against
 * a normalized (lowercased, diacritics-stripped, ł→l) title prefix.
 */
const METHODOLOGY_SECTION_HINTS: ReadonlyArray<string> = [
  'methodology',
  'method',
  'approach',
  'scope',
  'assumptions',
  'scenarios',
  'sensitivity',
  'risks',
  'metodologia',
  'metoda',
  'podejscie',
  'zakres',
  'zalozenia',
  'scenariusze',
  'wrazliwosc',
  'ryzyka',
  'ryzyko',
];

function normalizeSectionTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Polish "ł" (U+0142) does not decompose under NFD; map it explicitly
      // so the lexicon match works on titles like "Założenia" / "Wnioski
      // końcowe" / "Cele biznesowe".
      .replace(/ł/g, 'l')
      .trim()
  );
}

function isMethodologyAlignedSection(section: DocumentSchema['sections'][number]): boolean {
  const norm = normalizeSectionTitle(section.title || '');
  if (!norm) return false;
  return METHODOLOGY_SECTION_HINTS.some((hint) => norm.startsWith(hint));
}

export interface CreateMethodologyEditProposalParams {
  artifactId: string;
  organizationId: string;
  userId: string;
  instruction: string;
  /** Opt-in bounded LLM rewrite. Falls back deterministically on any failure. */
  useLlm?: boolean;
}

/**
 * Methodology-scope edit proposal. Operates on every editable block in
 * sections whose title matches METHODOLOGY_SECTION_HINTS (Methodology,
 * Approach, Scope, Assumptions, Scenarios, Sensitivity, Risks; PL+EN).
 * Other sections are untouched.
 *
 * The refiner system prompt for `methodology` scope adds explicit
 * guardrails: no new methodology steps, no reordering, no removal —
 * prose-only refinement.
 */
export async function createMethodologyEditProposal(
  params: CreateMethodologyEditProposalParams
): Promise<DocumentEditorProposal> {
  const { artifactId, organizationId, userId, instruction } = params;
  const trimmed = instruction.trim();
  if (!trimmed) throw new Error('instruction is required');
  const schema = await getDocumentArtifact(artifactId, organizationId);
  if (!schema) throw new Error('artifact_not_found');

  const targetSections = schema.sections.filter(isMethodologyAlignedSection);
  if (targetSections.length === 0) {
    throw new Error('no_methodology_sections');
  }

  const blockRewrites: Record<string, string> = {};
  let llmRefined = false;
  if (params.useLlm) {
    for (const section of targetSections) {
      for (const block of section.blocks) {
        const blockBefore = blockToEditableText(block.content);
        if (!blockBefore.trim()) continue;
        const refined = await refineEditorTextWithLlm(blockBefore, trimmed, {
          documentType: schema.documentType,
          scope: 'methodology',
          communicationRegister: schema.communicationRegister,
          language: schema.language,
        });
        if (refined) {
          blockRewrites[block.blockId] = refined;
          llmRefined = true;
        }
      }
    }
  }

  const projections: SectionMarkdownProjection[] = targetSections.map((section) => {
    const before = projectSectionToText(section);
    const after = llmRefined
      ? [
          `## ${section.title}`,
          ...section.blocks.map(
            (block) => blockRewrites[block.blockId] ?? blockToEditableText(block.content)
          ),
        ]
          .filter((line) => line.trim().length > 0)
          .join('\n\n')
      : `${before}\n\n[Methodology-scope edit applied at approval: ${trimmed}]`;
    return {
      sectionId: section.sectionId,
      title: section.title,
      before,
      after,
    };
  });

  const before = projections.map((p) => p.before).join('\n\n---\n\n');
  const after = projections.map((p) => p.after).join('\n\n---\n\n');
  const createdAt = nowIso();
  const proposal: DocumentEditorProposal = {
    proposalId: makeId('doc-proposal'),
    artifactId,
    organizationId,
    scope: 'methodology',
    instruction: trimmed,
    affectedSectionIds: targetSections.map((s) => s.sectionId),
    blockRewrites: llmRefined ? blockRewrites : undefined,
    llmRefined: llmRefined || undefined,
    status: 'proposed',
    diff: { before, after },
    createdBy: userId,
    createdAt,
    // Slice E15.wiring.snapshot.proposal — pin the proposal to the
    // most recent snapshot so audit / FE-E2 review surfaces can
    // recover the exact schema state the proposal was authored
    // against. `versionAfterId` is set in a follow-up slice when an
    // accept-proposal / apply path lands.
    versionBeforeId: resolveProposalVersionBeforeId(artifactId, organizationId),
  };
  proposalStore.set(proposalKey(artifactId, proposal.proposalId), proposal);
  pushAuditEntry({
    auditId: makeId('doc-audit'),
    artifactId,
    organizationId,
    proposalId: proposal.proposalId,
    action: 'proposal_created',
    actorId: userId,
    occurredAt: createdAt,
    details: {
      scope: 'methodology',
      affectedSectionCount: proposal.affectedSectionIds.length,
    },
  });
  return proposal;
}

export interface CreateSourceEditProposalParams {
  artifactId: string;
  organizationId: string;
  userId: string;
  instruction: string;
  /** Opt-in bounded LLM rewrite. Falls back deterministically on any failure. */
  useLlm?: boolean;
}

/**
 * Source-scope edit proposal. Operates on every editable block whose
 * `block.sourceRef` is set. Other blocks are untouched.
 *
 * The refiner system prompt for `source` scope adds explicit guardrails:
 * no number changes, no name changes, no citation marker drift —
 * prose-only refinement. Additionally, the refiner runs a multiset
 * preservation guard on numbers and bracketed citations and falls back
 * to deterministic if either drifts.
 */
export async function createSourceEditProposal(
  params: CreateSourceEditProposalParams
): Promise<DocumentEditorProposal> {
  const { artifactId, organizationId, userId, instruction } = params;
  const trimmed = instruction.trim();
  if (!trimmed) throw new Error('instruction is required');
  const schema = await getDocumentArtifact(artifactId, organizationId);
  if (!schema) throw new Error('artifact_not_found');

  const targetBlocks: Array<{
    section: DocumentSchema['sections'][number];
    block: DocumentSchema['sections'][number]['blocks'][number];
  }> = [];
  for (const section of schema.sections) {
    for (const block of section.blocks) {
      if (block.sourceRef && blockToEditableText(block.content).trim().length > 0) {
        targetBlocks.push({ section, block });
      }
    }
  }
  if (targetBlocks.length === 0) {
    throw new Error('no_source_anchored_blocks');
  }

  const blockRewrites: Record<string, string> = {};
  let llmRefined = false;
  if (params.useLlm) {
    for (const { block } of targetBlocks) {
      const blockBefore = blockToEditableText(block.content);
      const refined = await refineEditorTextWithLlm(blockBefore, trimmed, {
        documentType: schema.documentType,
        scope: 'source',
        communicationRegister: schema.communicationRegister,
        language: schema.language,
      });
      if (refined) {
        blockRewrites[block.blockId] = refined;
        llmRefined = true;
      }
    }
  }

  const affectedSectionIds = Array.from(new Set(targetBlocks.map((t) => t.section.sectionId)));
  const projections: SectionMarkdownProjection[] = affectedSectionIds.map((sectionId) => {
    const section = schema.sections.find((s) => s.sectionId === sectionId);
    if (!section) {
      return { sectionId, title: '', before: '', after: '' };
    }
    const before = projectSectionToText(section);
    const after = llmRefined
      ? [
          `## ${section.title}`,
          ...section.blocks.map(
            (block) => blockRewrites[block.blockId] ?? blockToEditableText(block.content)
          ),
        ]
          .filter((line) => line.trim().length > 0)
          .join('\n\n')
      : `${before}\n\n[Source-scope edit applied at approval: ${trimmed}]`;
    return {
      sectionId: section.sectionId,
      title: section.title,
      before,
      after,
    };
  });

  const before = projections.map((p) => p.before).join('\n\n---\n\n');
  const after = projections.map((p) => p.after).join('\n\n---\n\n');
  const createdAt = nowIso();
  const proposal: DocumentEditorProposal = {
    proposalId: makeId('doc-proposal'),
    artifactId,
    organizationId,
    scope: 'source',
    instruction: trimmed,
    affectedSectionIds,
    blockRewrites: llmRefined ? blockRewrites : undefined,
    llmRefined: llmRefined || undefined,
    status: 'proposed',
    diff: { before, after },
    createdBy: userId,
    createdAt,
    // Slice E15.wiring.snapshot.proposal — pin the proposal to the
    // most recent snapshot so audit / FE-E2 review surfaces can
    // recover the exact schema state the proposal was authored
    // against. `versionAfterId` is set in a follow-up slice when an
    // accept-proposal / apply path lands.
    versionBeforeId: resolveProposalVersionBeforeId(artifactId, organizationId),
  };
  proposalStore.set(proposalKey(artifactId, proposal.proposalId), proposal);
  pushAuditEntry({
    auditId: makeId('doc-audit'),
    artifactId,
    organizationId,
    proposalId: proposal.proposalId,
    action: 'proposal_created',
    actorId: userId,
    occurredAt: createdAt,
    details: {
      scope: 'source',
      affectedSectionCount: affectedSectionIds.length,
      affectedBlockCount: targetBlocks.length,
    },
  });
  return proposal;
}

// =============================================================================
// Slice E3.6 — Transformative scope. Completes the SSOT 6-scope edit
// doctrine. Operates on every editable block of every section just like
// `global` but the refiner relaxes structural guardrails and the audit
// payload calls out the elevated authority. No source-preservation
// guard runs (the user has explicitly opted into a rebuild). The
// approval / execution / audit envelope is unchanged.
// =============================================================================

export interface CreateTransformativeEditProposalParams {
  artifactId: string;
  organizationId: string;
  userId: string;
  instruction: string;
  /** Opt-in bounded LLM rewrite. Falls back deterministically on any failure. */
  useLlm?: boolean;
}

export async function createTransformativeEditProposal(
  params: CreateTransformativeEditProposalParams
): Promise<DocumentEditorProposal> {
  const { artifactId, organizationId, userId, instruction } = params;
  const trimmed = instruction.trim();
  if (!trimmed) throw new Error('instruction is required');
  const schema = await getDocumentArtifact(artifactId, organizationId);
  if (!schema) throw new Error('artifact_not_found');
  if (schema.sections.length === 0) {
    throw new Error('document_has_no_sections');
  }

  const blockRewrites: Record<string, string> = {};
  let llmRefined = false;
  if (params.useLlm) {
    for (const section of schema.sections) {
      for (const block of section.blocks) {
        const blockBefore = blockToEditableText(block.content);
        if (!blockBefore.trim()) continue;
        const refined = await refineEditorTextWithLlm(blockBefore, trimmed, {
          documentType: schema.documentType,
          scope: 'transformative',
          communicationRegister: schema.communicationRegister,
          language: schema.language,
        });
        if (refined) {
          blockRewrites[block.blockId] = refined;
          llmRefined = true;
        }
      }
    }
  }

  const projections: SectionMarkdownProjection[] = schema.sections.map((section) => {
    const before = projectSectionToText(section);
    const after = llmRefined
      ? [
          `## ${section.title}`,
          ...section.blocks.map(
            (block) => blockRewrites[block.blockId] ?? blockToEditableText(block.content)
          ),
        ]
          .filter((line) => line.trim().length > 0)
          .join('\n\n')
      : `${before}\n\n[Transformative edit at approval: ${trimmed}]`;
    return {
      sectionId: section.sectionId,
      title: section.title,
      before,
      after,
    };
  });

  const before = projections.map((p) => p.before).join('\n\n---\n\n');
  const after = projections.map((p) => p.after).join('\n\n---\n\n');
  const createdAt = nowIso();
  const proposal: DocumentEditorProposal = {
    proposalId: makeId('doc-proposal'),
    artifactId,
    organizationId,
    scope: 'transformative',
    instruction: trimmed,
    affectedSectionIds: schema.sections.map((s) => s.sectionId),
    blockRewrites: llmRefined ? blockRewrites : undefined,
    llmRefined: llmRefined || undefined,
    status: 'proposed',
    diff: { before, after },
    createdBy: userId,
    createdAt,
    // Slice E15.wiring.snapshot.proposal — pin the proposal to the
    // most recent snapshot so audit / FE-E2 review surfaces can
    // recover the exact schema state the proposal was authored
    // against. `versionAfterId` is set in a follow-up slice when an
    // accept-proposal / apply path lands.
    versionBeforeId: resolveProposalVersionBeforeId(artifactId, organizationId),
  };
  proposalStore.set(proposalKey(artifactId, proposal.proposalId), proposal);
  pushAuditEntry({
    auditId: makeId('doc-audit'),
    artifactId,
    organizationId,
    proposalId: proposal.proposalId,
    action: 'proposal_created',
    actorId: userId,
    occurredAt: createdAt,
    details: {
      scope: 'transformative',
      affectedSectionCount: proposal.affectedSectionIds.length,
      // Audit-trail tag so reviewers can filter for the elevated-authority
      // edit doctrine when triaging proposals.
      authority: 'user_explicit_rebuild',
    },
  });
  return proposal;
}

function updateProposalStatus(
  proposal: DocumentEditorProposal,
  status: DocumentProposalStatus
): DocumentEditorProposal {
  return { ...proposal, status };
}

function getStoredProposal(
  artifactId: string,
  organizationId: string,
  proposalId: string
): DocumentEditorProposal {
  const proposal = proposalStore.get(proposalKey(artifactId, proposalId));
  if (!proposal || proposal.organizationId !== organizationId) {
    throw new Error('proposal_not_found');
  }
  return proposal;
}

export interface ApproveEditProposalResult {
  proposal: DocumentEditorProposal;
  schema: DocumentSchema;
}

/** @deprecated kept for back-compat with MVP-1 callers; alias for `ApproveEditProposalResult`. */
export type ApproveLocalEditProposalResult = ApproveEditProposalResult;

/**
 * Apply a stored proposal to a fresh copy of the schema, dispatching by
 * scope. Local: rewrite a single block. Section: rewrite every editable
 * block in one section. Global: rewrite every editable block in every
 * section. Section/global edits are deterministic: they append the
 * instruction marker to each block, mirroring the local-scope behavior so
 * the diff stays auditable in MVP-3 without an LLM rewrite step.
 */
function applyProposalToSchema(
  schema: DocumentSchema,
  proposal: DocumentEditorProposal
): DocumentSchema {
  const next = cloneSchema(schema);
  const rewrites = proposal.blockRewrites ?? {};

  if (proposal.scope === 'local') {
    if (!proposal.sectionId || !proposal.blockId) {
      throw new Error('proposal_missing_targets');
    }
    const { block } = findSectionAndBlock(next, proposal.sectionId, proposal.blockId);
    // Local proposals encode the rewrite directly in `diff.after`; LLM and
    // deterministic paths share the same field.
    block.content = withBlockText(block.content, proposal.diff.after);
    next.updatedAt = nowIso();
    return next;
  }

  if (proposal.scope === 'section') {
    if (!proposal.sectionId) throw new Error('proposal_missing_targets');
    const section = next.sections.find((s) => s.sectionId === proposal.sectionId);
    if (!section) throw new Error('section_not_found');
    for (const block of section.blocks) {
      const refinedText = rewrites[block.blockId];
      block.content = refinedText
        ? withBlockText(block.content, refinedText)
        : applyInstructionToBlock(block.content, proposal.instruction);
    }
    next.updatedAt = nowIso();
    return next;
  }

  // Resolve which sections this proposal is allowed to touch. For
  // `global` scope we touch every section; for `methodology` / `source`
  // scope we restrict to the recorded `affectedSectionIds`. Source scope
  // additionally restricts to blocks whose sourceRef is set.
  const allowedSectionIds: ReadonlySet<string> | null =
    proposal.scope === 'global' ? null : new Set(proposal.affectedSectionIds);
  const sourceRestrictedScope = proposal.scope === 'source';

  for (const section of next.sections) {
    if (allowedSectionIds && !allowedSectionIds.has(section.sectionId)) continue;
    for (const block of section.blocks) {
      if (sourceRestrictedScope && !block.sourceRef) continue;
      const refinedText = rewrites[block.blockId];
      block.content = refinedText
        ? withBlockText(block.content, refinedText)
        : applyInstructionToBlock(block.content, proposal.instruction);
    }
  }
  next.updatedAt = nowIso();
  return next;
}

export async function approveEditProposal(params: {
  artifactId: string;
  organizationId: string;
  userId: string;
  proposalId: string;
}): Promise<ApproveEditProposalResult> {
  const proposal = getStoredProposal(params.artifactId, params.organizationId, params.proposalId);
  if (proposal.status !== 'proposed') {
    throw new Error('proposal_not_pending');
  }
  const schema = await getDocumentArtifact(params.artifactId, params.organizationId);
  if (!schema) {
    throw new Error('artifact_not_found');
  }
  const nextSchema = applyProposalToSchema(schema, proposal);

  // Slice E16.diff.proposal — compute the structural diff between
  // the schema before and after the proposal applied. The result
  // surfaces in the `proposal_executed` audit row so an approver
  // (and downstream automation) can see exactly what shape change
  // landed without re-deriving it from the proposal payload. The
  // computation is wrapped in `try { … } catch { … }` so a
  // diff-service hiccup can never abort an approval that already
  // succeeded structurally.
  let structuralDiffSummary: string | undefined;
  let structuralDiffStats: ReturnType<typeof computeDocumentSchemaDiff>['stats'] | undefined;
  try {
    const diff = computeDocumentSchemaDiff(schema, nextSchema);
    structuralDiffSummary = summarizeDocumentSchemaDiff(diff);
    structuralDiffStats = diff.stats;
  } catch {
    structuralDiffSummary = undefined;
    structuralDiffStats = undefined;
  }

  const approvedAt = nowIso();
  let nextProposal = updateProposalStatus(proposal, 'approved');
  nextProposal = {
    ...nextProposal,
    approvedBy: params.userId,
    approvedAt,
  };
  const executedAt = nowIso();
  nextProposal = {
    ...nextProposal,
    status: 'executed',
    executedAt,
  };
  proposalStore.set(proposalKey(params.artifactId, params.proposalId), nextProposal);
  pushAuditEntry({
    auditId: makeId('doc-audit'),
    artifactId: params.artifactId,
    organizationId: params.organizationId,
    proposalId: proposal.proposalId,
    action: 'proposal_approved',
    actorId: params.userId,
    occurredAt: approvedAt,
  });
  pushAuditEntry({
    auditId: makeId('doc-audit'),
    artifactId: params.artifactId,
    organizationId: params.organizationId,
    proposalId: proposal.proposalId,
    action: 'proposal_executed',
    actorId: params.userId,
    occurredAt: executedAt,
    details: {
      scope: proposal.scope,
      affectedSectionIds: proposal.affectedSectionIds,
      sectionId: proposal.sectionId,
      blockId: proposal.blockId,
      llmRefined: proposal.llmRefined === true,
      blockRewritesCount: proposal.blockRewrites ? Object.keys(proposal.blockRewrites).length : 0,
      // Slice E16.diff.proposal — structural diff fields land alongside
      // the existing scope/section/block metadata so an audit consumer
      // can render "what shape change landed" without rehydrating the
      // before/after schemas. `undefined` when computation failed.
      structuralDiffSummary,
      structuralDiffStats,
    },
  });
  return { proposal: nextProposal, schema: nextSchema };
}

/**
 * @deprecated MVP-1 alias retained for back-compat. New callers should use
 * `approveEditProposal`. Routes still mount under
 * `/proposals/:proposalId/approve` regardless of scope.
 */
export const approveLocalEditProposal = approveEditProposal;

/**
 * Reject a proposal of any scope. Same governance contract as the local
 * rejection from MVP-1; only the recorded audit detail records the scope.
 */
export function rejectEditProposal(params: {
  artifactId: string;
  organizationId: string;
  userId: string;
  proposalId: string;
}): DocumentEditorProposal {
  const proposal = getStoredProposal(params.artifactId, params.organizationId, params.proposalId);
  if (proposal.status !== 'proposed') {
    throw new Error('proposal_not_pending');
  }
  const rejectedAt = nowIso();
  const nextProposal: DocumentEditorProposal = {
    ...proposal,
    status: 'rejected',
    rejectedBy: params.userId,
    rejectedAt,
  };
  proposalStore.set(proposalKey(params.artifactId, params.proposalId), nextProposal);
  pushAuditEntry({
    auditId: makeId('doc-audit'),
    artifactId: params.artifactId,
    organizationId: params.organizationId,
    proposalId: proposal.proposalId,
    action: 'proposal_rejected',
    actorId: params.userId,
    occurredAt: rejectedAt,
    details: { scope: proposal.scope },
  });
  return nextProposal;
}

/**
 * @deprecated MVP-1 alias retained for back-compat. New callers should use
 * `rejectEditProposal`.
 */
export const rejectLocalEditProposal = rejectEditProposal;

export function listDocumentAuditEntries(
  artifactId: string,
  organizationId: string
): DocumentAuditEntry[] {
  return [...(auditStore.get(getAuditKey(artifactId, organizationId)) ?? [])];
}

// =============================================================================
// Epic E5 — Document Lifecycle public surface (delegates to the
// lifecycle service so the studio service stays the single import
// surface routes / external callers consume).
// =============================================================================

export {
  DocumentLifecycleTransitionError,
  ensureDocumentLifecycleHydrated,
  getDocumentLifecycleState,
};
export type { DocumentLifecycleState, TransitionDocumentStatusParams };

/**
 * Mutate the lifecycle status of a document. Validates the transition
 * against the matrix in `documentLifecycleService.ALLOWED_TRANSITIONS`,
 * appends a transition entry to the lifecycle history, and writes a
 * `document_status_changed` audit row into the per-artifact audit
 * store via the registered audit pump.
 *
 * Throws `DocumentLifecycleTransitionError` on invalid transitions /
 * unknown statuses / unknown artifacts so the route layer can map the
 * error code to an actionable HTTP status.
 */
export function transitionDocumentStatus(
  params: TransitionDocumentStatusParams
): DocumentLifecycleState {
  return transitionDocumentStatusInternal(params);
}

// =============================================================================
// Epic E5 — Version snapshots (slice 5.2). The studio service is the
// resolver of "current schema" and orchestrates the snapshot service.
// =============================================================================

export {
  ensureDocumentVersionSnapshotsHydrated,
  getDocumentVersionSnapshot,
  getDocumentVersionSnapshotByNumber,
  listDocumentVersionSnapshots,
};

export interface CreateDocumentSnapshotParams {
  organizationId: string;
  artifactId: string;
  userId: string;
  label?: string;
  reason?: string;
  /** Defaults to 'manual'. */
  origin?: DocumentVersionSnapshotOrigin;
}

/**
 * Capture the current schema as a versioned snapshot. Resolves the
 * live schema via `getDocumentArtifact` (which already overlays the
 * current lifecycle status) and forwards the deep clone to the
 * snapshot service together with the lifecycle status at capture time.
 *
 * Throws when the artifact does not exist (so callers don't silently
 * snapshot nothing).
 */
export async function createDocumentSnapshot(
  params: CreateDocumentSnapshotParams
): Promise<DocumentVersionSnapshot> {
  if (!params.organizationId) throw new Error('organizationId is required');
  if (!params.artifactId) throw new Error('artifactId is required');
  if (!params.userId) throw new Error('userId is required');

  const schema = await getDocumentArtifact(params.artifactId, params.organizationId);
  if (!schema) {
    throw new Error('document_not_found');
  }
  const lifecycle = getDocumentStatusOrDefault(params.artifactId, params.organizationId);
  return createDocumentVersionSnapshotInternal({
    organizationId: params.organizationId,
    artifactId: params.artifactId,
    userId: params.userId,
    schema,
    statusAtCapture: lifecycle.status,
    label: params.label,
    reason: params.reason,
    origin: params.origin ?? 'manual',
  });
}

// =============================================================================
// Epic E5 — Rollback (slice 5.3). Orchestrates a transactional rollback
// of a document artifact to a previous snapshot:
//
//   1. Resolve the target snapshot (must exist + same tenant).
//   2. Read the live schema (post-overlay) so the operator never loses
//      the pre-rollback state.
//   3. Capture a `rollback_revert` snapshot of the live schema with the
//      lifecycle status at the time of rollback.
//   4. Write the target snapshot's schema into the overlay store (the
//      next `getDocumentArtifact` returns the rolled-back schema).
//   5. Force lifecycle status to `'draft'` via the rollback bypass so
//      the editor / reviewer flow restarts cleanly. The matrix is not
//      consulted — rollback is a system-driven path. The audit row is
//      tagged with `details.system: 'rollback'`.
//   6. Record a `document_rolled_back` audit row pointing at the
//      target versionId, the revert snapshot's versionId, and the
//      lifecycle status before / after.
// =============================================================================

export class DocumentRollbackError extends Error {
  readonly code: 'invalid_input' | 'snapshot_not_found' | 'document_not_found' | 'tenant_mismatch';
  constructor(
    code: 'invalid_input' | 'snapshot_not_found' | 'document_not_found' | 'tenant_mismatch',
    message: string
  ) {
    super(message);
    this.name = 'DocumentRollbackError';
    this.code = code;
  }
}

export interface RollbackDocumentToVersionParams {
  organizationId: string;
  artifactId: string;
  userId: string;
  versionId: string;
  reason?: string;
}

export interface RollbackDocumentToVersionResult {
  schema: DocumentSchema;
  /** Snapshot taken right before the rollback overwrote the live schema. */
  revertSnapshot: DocumentVersionSnapshot;
  /** The target snapshot that was restored. */
  restoredFrom: DocumentVersionSnapshot;
  /** Lifecycle state after the rollback (status forced to 'draft'). */
  lifecycle: DocumentLifecycleState;
}

/**
 * Restore a previous snapshot as the active schema. Always preserves
 * the pre-rollback state by writing a `rollback_revert` snapshot
 * first, so the operator can roll forward again if needed. Forces the
 * lifecycle status to `'draft'` so the document re-enters the
 * editor / reviewer flow cleanly.
 *
 * Throws `DocumentRollbackError`:
 *   - 'invalid_input'      — missing required field.
 *   - 'document_not_found' — wave5 returns null for the artifact.
 *   - 'snapshot_not_found' — versionId does not resolve to a snapshot
 *                            (or resolves to a different tenant — same
 *                            error code so existence is not leaked).
 *   - 'tenant_mismatch'    — snapshot.artifactId does not match
 *                            params.artifactId (defense in depth on
 *                            top of versionIndex tenant scoping).
 */
export async function rollbackDocumentToVersion(
  params: RollbackDocumentToVersionParams
): Promise<RollbackDocumentToVersionResult> {
  if (!params.organizationId)
    throw new DocumentRollbackError('invalid_input', 'organizationId is required');
  if (!params.artifactId)
    throw new DocumentRollbackError('invalid_input', 'artifactId is required');
  if (!params.userId) throw new DocumentRollbackError('invalid_input', 'userId is required');
  if (!params.versionId) throw new DocumentRollbackError('invalid_input', 'versionId is required');

  const target = getDocumentVersionSnapshot(params.versionId, params.organizationId);
  if (!target) {
    throw new DocumentRollbackError('snapshot_not_found', `snapshot ${params.versionId} not found`);
  }
  if (target.artifactId !== params.artifactId) {
    throw new DocumentRollbackError(
      'tenant_mismatch',
      `snapshot ${params.versionId} does not belong to artifact ${params.artifactId}`
    );
  }

  const liveSchema = await getDocumentArtifact(params.artifactId, params.organizationId);
  if (!liveSchema) {
    throw new DocumentRollbackError(
      'document_not_found',
      `document ${params.artifactId} not found`
    );
  }

  const lifecycleBefore = getDocumentStatusOrDefault(params.artifactId, params.organizationId);

  // Step 3 — capture pre-rollback state so the rollback is reversible.
  const revertSnapshot = createDocumentVersionSnapshotInternal({
    organizationId: params.organizationId,
    artifactId: params.artifactId,
    userId: params.userId,
    schema: liveSchema,
    statusAtCapture: lifecycleBefore.status,
    label: `pre-rollback to v${target.versionNumber}`,
    reason: params.reason,
    origin: 'rollback_revert',
  });

  // Step 4 — write the target schema into the overlay so subsequent
  // reads reflect the rolled-back content. Stamp updatedAt to now so
  // the UI's last-modified affordance updates correctly.
  const restoredSchema: DocumentSchema = {
    ...target.schema,
    artifactId: params.artifactId,
    updatedAt: nowIso(),
  };
  schemaOverlayStore.set(
    schemaOverlayKey(params.artifactId, params.organizationId),
    restoredSchema
  );

  // Step 5 — force lifecycle to draft via the system bypass. The
  // bypass emits its own document_status_changed audit entry tagged
  // with system: 'rollback'.
  const lifecycle = __forceTransitionDocumentStatusForRollback({
    organizationId: params.organizationId,
    artifactId: params.artifactId,
    userId: params.userId,
    to: 'draft',
    reason: `rollback to v${target.versionNumber}`,
  });

  // Step 6 — high-level rollback audit row. Companion to the system
  // status change row so reviewers see both the structural rollback
  // and the lifecycle reset in the timeline.
  pushAuditEntry({
    auditId: makeId('doc-audit'),
    artifactId: params.artifactId,
    organizationId: params.organizationId,
    action: 'document_rolled_back',
    actorId: params.userId,
    occurredAt: nowIso(),
    details: {
      restoredFromVersionId: target.versionId,
      restoredFromVersionNumber: target.versionNumber,
      revertSnapshotVersionId: revertSnapshot.versionId,
      revertSnapshotVersionNumber: revertSnapshot.versionNumber,
      statusBeforeRollback: lifecycleBefore.status,
      statusAfterRollback: lifecycle.status,
      reason: params.reason,
    },
  });

  return {
    schema: {
      ...restoredSchema,
      documentStatus: lifecycle.status,
      statusChangedAt: lifecycle.statusChangedAt,
      statusChangedBy: lifecycle.statusChangedBy,
      statusReason: lifecycle.statusReason,
    },
    revertSnapshot,
    restoredFrom: target,
    lifecycle,
  };
}

/** @internal — test helper to clear the schema overlay between specs. */
export function __resetSchemaOverlayForTests(): void {
  schemaOverlayStore.clear();
}

// =============================================================================
// Epic E6 — Comments + review mode public surface (slices 6.1 + 6.2).
// The studio service is the single import surface routes / external
// callers consume; the comments service stays an internal module so
// the studio is the audit-pump owner and the natural place to add
// cross-cutting concerns later (e.g. lifecycle gates that prevent
// resolving comments on archived documents).
// =============================================================================

export {
  DocumentCommentError,
  ensureDocumentCommentsHydrated,
  getDocumentComment,
  getDocumentCommentSectionCounts,
  listDocumentComments,
  listDocumentCommentThreads,
};
export type {
  CreateDocumentCommentParams,
  DeleteDocumentCommentParams,
  ListDocumentCommentsOptions,
  ListDocumentCommentThreadsOptions,
  ReopenDocumentCommentParams,
  ReplyToDocumentCommentParams,
  ResolveDocumentCommentParams,
};

export function createDocumentComment(params: CreateDocumentCommentParams) {
  return createDocumentCommentInternal(params);
}

export function replyToDocumentComment(params: ReplyToDocumentCommentParams) {
  return replyToDocumentCommentInternal(params);
}

export function resolveDocumentComment(params: ResolveDocumentCommentParams) {
  return resolveDocumentCommentInternal(params);
}

export function reopenDocumentComment(params: ReopenDocumentCommentParams) {
  return reopenDocumentCommentInternal(params);
}

export function deleteDocumentComment(params: DeleteDocumentCommentParams) {
  return deleteDocumentCommentInternal(params);
}

// =============================================================================
// Epic E4 — chat-first creation entry.
//
// `createDocumentFromChatSourcePack` is the orchestration call Teresa
// invokes when the user says "make me a memo from these sources". It
// composes the registry + connectors + materializeDocumentArtifact into
// a single transactional flow:
//
//   1. Draft a SourcePack scoped to the caller tenant.
//   2. Ingest every supplied connector input (text / url / file /
//      v8_artifact / integration) into pack items via the connector
//      adapters.
//   3. Mark the pack ready (governance handshake — empty packs are
//      rejected upstream).
//   4. Materialize the document artifact, attaching the pack's
//      `sourceRefs` so generation has them available.
//   5. Audit the attach so the pack registry can show "this pack
//      grounded artifact X".
//
// On any connector failure: the pack is rolled back via
// `archiveSourcePack` so a half-assembled bundle never lingers in the
// registry. Connector errors propagate as-is so the route layer can
// map them to actionable HTTP statuses.
// =============================================================================

import {
  ingestFileSource,
  ingestIntegrationSource,
  ingestRawTextSource,
  ingestUrlSource,
  ingestV8ArtifactSource,
  type SourcePackItemDraft,
} from './documentSourcePackConnectors.js';
import {
  addSourcePackItem,
  archiveSourcePack,
  attachSourcePackToDocument,
  draftSourcePack,
  markSourcePackReady,
} from './documentSourcePackService.js';
import type { SourcePackItem } from './documentStudioTypes.js';

export type CreateChatSourcePackConnectorInput =
  | {
      connector: 'text';
      title: string;
      body: string;
      language?: 'pl' | 'en';
      sourceTitle?: string;
      notes?: string;
    }
  | {
      connector: 'url';
      url: string;
      title?: string;
      language?: 'pl' | 'en';
      notes?: string;
      timeoutMs?: number;
    }
  | {
      connector: 'file';
      filename: string;
      mimeType: string;
      body: string;
      title?: string;
      language?: 'pl' | 'en';
      notes?: string;
    }
  | {
      connector: 'v8_artifact';
      artifactId: string;
      title?: string;
      language?: 'pl' | 'en';
      notes?: string;
    }
  | {
      connector: 'integration';
      integration: 'notion' | 'drive' | 'sharepoint' | 'confluence';
      externalId: string;
      title: string;
      preview?: string;
      language?: 'pl' | 'en';
      notes?: string;
    };

export interface CreateDocumentFromChatSourcePackParams {
  organizationId: string;
  userId: string;
  intake: DocumentIntake;
  /** Pack metadata. Name defaults to intake.title when not supplied. */
  packName?: string;
  packDescription?: string;
  packLanguage?: 'pl' | 'en';
  /** Connector inputs to ingest into the new pack. */
  sources: CreateChatSourcePackConnectorInput[];
  /** Optional Mode 3 template id, same semantics as materializeDocumentArtifact. */
  templateId?: string | null;
  /** Optional outline override; defaults to template-derived or planner-derived. */
  outline?: DocumentOutline;
  projectId?: string | null;
  useLlm?: boolean;
}

export interface CreateDocumentFromChatSourcePackResult {
  artifactId: string;
  schema: DocumentSchema;
  packId: string;
  itemCount: number;
}

async function ingestSingleSource(
  organizationId: string,
  source: CreateChatSourcePackConnectorInput
): Promise<SourcePackItemDraft> {
  switch (source.connector) {
    case 'text':
      return ingestRawTextSource({
        title: source.title,
        body: source.body,
        language: source.language,
        sourceTitle: source.sourceTitle,
        notes: source.notes,
      });
    case 'url':
      return ingestUrlSource({
        url: source.url,
        title: source.title,
        language: source.language,
        notes: source.notes,
        timeoutMs: source.timeoutMs,
      });
    case 'file':
      return ingestFileSource({
        filename: source.filename,
        mimeType: source.mimeType,
        body: source.body,
        title: source.title,
        language: source.language,
        notes: source.notes,
      });
    case 'v8_artifact':
      return ingestV8ArtifactSource({
        artifactId: source.artifactId,
        organizationId,
        title: source.title,
        language: source.language,
        notes: source.notes,
      });
    case 'integration':
      return ingestIntegrationSource({
        integration: source.integration,
        externalId: source.externalId,
        title: source.title,
        preview: source.preview,
        language: source.language,
        notes: source.notes,
      });
    default: {
      const exhaustive: never = source;
      throw new Error(
        `unsupported chat source connector: ${(exhaustive as { connector?: string })?.connector ?? 'unknown'}`
      );
    }
  }
}

export async function createDocumentFromChatSourcePack(
  params: CreateDocumentFromChatSourcePackParams
): Promise<CreateDocumentFromChatSourcePackResult> {
  if (!params.organizationId) throw new Error('organizationId is required');
  if (!params.userId) throw new Error('userId is required');
  if (!params.intake) throw new Error('intake is required');
  if (!Array.isArray(params.sources) || params.sources.length === 0) {
    throw new Error('chat creation requires at least one source connector input');
  }

  // Default pack metadata; `intake.title` is the natural fallback so the
  // pack and the resulting document share a recognizable name.
  const packLanguage = params.packLanguage ?? params.intake.language ?? 'pl';
  const packName =
    params.packName?.trim() ||
    (params.intake.title?.trim() ? `${params.intake.title.trim()} — sources` : 'Chat sources');

  const pack = draftSourcePack({
    organizationId: params.organizationId,
    userId: params.userId,
    name: packName,
    language: packLanguage,
    description: params.packDescription,
  });

  let ingestedItems: SourcePackItem[] = [];
  try {
    for (const source of params.sources) {
      const draft = await ingestSingleSource(params.organizationId, source);
      const updated = addSourcePackItem({
        organizationId: params.organizationId,
        userId: params.userId,
        packId: pack.packId,
        item: draft,
      });
      ingestedItems = updated.items;
    }
    markSourcePackReady({
      organizationId: params.organizationId,
      userId: params.userId,
      packId: pack.packId,
    });
  } catch (err) {
    // Roll back: archive the partially-built pack so the registry never
    // exposes a half-ingested bundle. The original error is rethrown so
    // the route layer can surface it.
    try {
      archiveSourcePack({
        organizationId: params.organizationId,
        userId: params.userId,
        packId: pack.packId,
        reason: 'chat_source_pack_ingest_failed',
      });
    } catch {
      // best-effort rollback; do not mask the original failure
    }
    throw err;
  }

  // Build the DocumentSourceRef[] the materialize pipeline already
  // accepts. attach also writes the audit "pack -> artifact" row.
  const sourceRefs: DocumentSourceRef[] = ingestedItems.map((item) => ({ ...item.sourceRef }));
  const result = await materializeDocumentArtifact({
    organizationId: params.organizationId,
    userId: params.userId,
    intake: params.intake,
    outline: params.outline,
    sourceRefs,
    projectId: params.projectId ?? null,
    useLlm: params.useLlm,
    templateId: params.templateId ?? null,
    // Slice E15.wiring.materialize — propagate the freshly drafted
    // pack id onto `DocumentSchema.sourcePackId` so the artifact
    // carries an explicit pointer to its grounding source pack.
    sourcePackId: pack.packId,
  });

  // Now that the artifact id is known, write the pack -> artifact link.
  attachSourcePackToDocument({
    organizationId: params.organizationId,
    userId: params.userId,
    packId: pack.packId,
    artifactId: result.artifactId,
  });

  return {
    artifactId: result.artifactId,
    schema: result.schema,
    packId: pack.packId,
    itemCount: ingestedItems.length,
  };
}

/**
 * Run QA against a document artifact end-to-end (Epic E7, Slice 7.2).
 *
 * Resolves the inputs the QA engine needs but the route layer should not
 * have to know about:
 *   - the artifact's schema (overlay-aware, lifecycle-status-aware),
 *   - the registered template, when the artifact was generated in Mode 3
 *     (looked up by id stored in artifact metadata),
 *   - the tenant's currently active Brand Voice profile (Epic E7).
 *
 * Hydrates the brand-voice registry on demand (idempotent + best-effort).
 * Returns `null` when the artifact does not exist / has no schema; the
 * route layer maps that to a 404. Stamps `report.organizationId` so
 * downstream callers (audit pump, render code) don't have to.
 */
export async function runQaForDocument(
  artifactId: string,
  organizationId: string
): Promise<DocumentQaReport | null> {
  if (!artifactId || !organizationId) return null;
  const schema = await getDocumentArtifact(artifactId, organizationId);
  if (!schema) return null;

  await ensureBrandVoiceRegistryHydrated(organizationId);
  const brandVoiceProfile = getActiveBrandVoiceProfile(organizationId);

  // Best-effort template lookup: when the artifact was materialized in
  // Mode 3 the template id is parked on the wave5 metadata; resolve it
  // here so Methodology / Completeness can switch into template-aware
  // mode without leaking the metadata key into the route.
  let template: DocumentTemplate | null = null;
  try {
    const artifact = await getWave5Artifact(artifactId, organizationId);
    const metadata = artifact ? parseMetadata(artifact.metadata) : null;
    const templateId = metadata?.[STUDIO_TEMPLATE_ID_METADATA_KEY];
    if (typeof templateId === 'string' && templateId.length > 0) {
      template = getRegisteredTemplate(templateId, organizationId);
    }
  } catch {
    // Wave5 lookup failures degrade to template-less QA — the engine
    // stays useful even when only Brand Voice is active.
    template = null;
  }

  const report = runDocumentQa(schema, { template, brandVoiceProfile });
  report.organizationId = organizationId;
  return report;
}

function parseMetadata(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  try {
    return JSON.parse(String(raw)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
