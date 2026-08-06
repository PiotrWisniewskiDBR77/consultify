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

import { randomUUID } from 'node:crypto';

import logger from '../../utils/Logger.js';
import { safePersistEvidenceContract } from '../evidence/evidenceContractBridge.js';
import {
  buildWave5ExportManifest,
  createWave5Artifact,
  getWave5Artifact,
  markWave5ArtifactExported,
} from '../wave5ArtifactRuntimeService.js';
import { getActiveOrgLogo } from './documentAssetRegistryService.js';
import { generateBlockProse } from './documentBlockProseGenerator.js';
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
import {
  ensureContentBlockRegistryHydrated,
  instantiateDocumentContentBlock,
} from './documentContentBlockService.js';
import {
  buildDocumentSchema,
  buildDocumentSchemaPremium,
  enforceDocumentSchemaGrounding,
} from './documentContentGenerator.js';
import { renderDocumentSchemaToDocxBuffer } from './documentDocxRenderer.js';
import { refineEditorTextWithLlm } from './documentEditorRefiner.js';
import {
  __resetSchemaOverlayDaoForTests as daoResetSchemaOverlayForTests,
  loadAuditForArtifact as daoLoadAuditForArtifact,
  loadProposalsForArtifact as daoLoadProposalsForArtifact,
  loadSchemaOverlay as daoLoadSchemaOverlay,
  persistAuditEntry as daoPersistAuditEntry,
  persistProposal as daoPersistProposal,
  persistSchemaOverlay as daoPersistSchemaOverlay,
} from './documentEditorStateRegistryDao.js';
import {
  createDocumentGenerationWarningCollector,
  type DocumentGenerationWarning,
  normalizeGenerationWarnings,
} from './documentGenerationWarnings.js';
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
  DocumentBlock,
  DocumentEditorProposal,
  DocumentEditorProposalInput,
  DocumentExportResult,
  DocumentIntake,
  DocumentOutline,
  DocumentProposalStatus,
  DocumentQaReport,
  DocumentRunResult,
  DocumentSchema,
  DocumentSection,
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
  maybeAutoCaptureDocumentVersionSnapshot,
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
// A4 — persisted generation-warnings channel. Lives under
// `metadata_json.generationWarnings` so it round-trips through the
// wave5 artifact metadata alongside the schema.
const STUDIO_GENERATION_WARNINGS_METADATA_KEY = 'generationWarnings';
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

// =============================================================================
// Editor-state persistence (Module 10 hardening).
//
// The three Maps above are the synchronous in-process cache. They are
// backed write-through by `documentEditorStateRegistryDao.ts` (migration
// `20260603_document_studio_editor_state.sql`) so proposals, the audit
// ledger, and the schema overlay survive a server restart.
//
// Reads hydrate the cache lazily once per (artifact, organization).
//
// PROPOSAL writes (C2 hardening, 2026-07-04): the durable write is now
// AWAITED on the request path that creates/approves/rejects/executes a
// proposal — `persistProposalWriteThrough` is `async` and every call
// site awaits it. This closes the kill-window where a proposal was
// cached in-process (so the response looked successful) but never
// reached Postgres, and a process restart before the fire-and-forget
// flush completed silently lost the proposal.
//
// The DAO itself never throws (`persistProposal` always resolves to a
// `PersistOutcome`) and a missing migration / table degrades to the
// in-process Map — that fallback is intentional and stays. What
// changed is that the degradation is no longer silent: it is stamped
// onto `proposal.persistence` (additive field, existing consumers
// unaffected) and `db_error` degradations (table exists but the write
// failed — a real risk of loss, unlike a pre-migration environment)
// are logged at `error` level so they are visible in prod monitoring.
//
// The audit ledger (`pushAuditEntry`) and the schema-overlay cache
// remain fire-and-forget: the audit trail is a secondary log, not the
// proposal itself, and the schema overlay is a separate surface
// (rollback / content-block insert) outside this slice's scope.
// =============================================================================

/** Tracks which (artifact, organization) pairs have been hydrated. */
const hydratedEditorState = new Set<string>();

function hydrationKey(artifactId: string, organizationId: string): string {
  return `${artifactId}::${organizationId}`;
}

/**
 * Lazily hydrate the in-process caches for a single (artifact,
 * organization) from the DAO. Idempotent and failure-tolerant: any DAO
 * error leaves the caches untouched and the pair marked hydrated so we
 * don't thrash the DB on every call. The synchronous public API
 * (`getStoredProposal`, the sync `listDocumentAuditEntries`) reads the
 * caches; the async entry points (`getDocumentArtifact`, the proposal
 * create/approve/reject paths, the async audit listing) call this first
 * so a cold process sees persisted state.
 */
async function ensureEditorStateHydrated(
  artifactId: string,
  organizationId: string
): Promise<void> {
  if (!artifactId || !organizationId) return;
  const key = hydrationKey(artifactId, organizationId);
  if (hydratedEditorState.has(key)) return;
  hydratedEditorState.add(key);
  try {
    const [proposals, audit, overlay] = await Promise.all([
      daoLoadProposalsForArtifact(artifactId, organizationId),
      daoLoadAuditForArtifact(artifactId, organizationId),
      daoLoadSchemaOverlay(artifactId, organizationId),
    ]);
    for (const proposal of proposals) {
      const pk = proposalKey(artifactId, proposal.proposalId);
      if (!proposalStore.has(pk)) proposalStore.set(pk, proposal);
    }
    if (audit.length > 0) {
      const ak = getAuditKey(artifactId, organizationId);
      if (!auditStore.has(ak)) auditStore.set(ak, audit);
    }
    if (overlay) {
      const ok = schemaOverlayKey(artifactId, organizationId);
      if (!schemaOverlayStore.has(ok)) schemaOverlayStore.set(ok, overlay);
    }
  } catch {
    // Hydration is best-effort; the in-process caches remain the source
    // of truth for this session if the DB is unreachable.
  }
}

/**
 * Write-through helper: cache the proposal synchronously, AWAIT the
 * durable write, and stamp the outcome onto `proposal.persistence`
 * (mutated in place — callers hold the same reference they pass in
 * and later return to the route layer, so the stamp round-trips to
 * the API response for free).
 *
 * Never throws: `daoPersistProposal` already resolves to a
 * `PersistOutcome` for every failure path. A `db_error` degradation
 * (table exists, write failed) is logged at `error` level — that is
 * the one case that represents real data-loss risk. A
 * `schema_missing` degradation (pre-migration environment) logs at
 * `warn` — expected/tolerated, the in-process cache remains
 * authoritative for the life of the process.
 */
async function persistProposalWriteThrough(
  proposal: DocumentEditorProposal
): Promise<DocumentEditorProposal> {
  proposalStore.set(proposalKey(proposal.artifactId, proposal.proposalId), proposal);
  const outcome = await daoPersistProposal(proposal);
  proposal.persistence = {
    persisted: outcome.ok,
    degraded: outcome.degraded,
    reason: outcome.reason,
  };
  if (!outcome.ok) {
    const logFn = outcome.degraded === 'db_error' ? logger.error : logger.warn;
    logFn('[DocumentStudio] proposal durable write did not confirm', {
      proposalId: proposal.proposalId,
      artifactId: proposal.artifactId,
      organizationId: proposal.organizationId,
      degraded: outcome.degraded,
      reason: outcome.reason,
    });
  }
  return proposal;
}

/** Write-through helper: cache the overlay synchronously, persist async. */
function persistSchemaOverlayWriteThrough(
  artifactId: string,
  organizationId: string,
  schema: DocumentSchema
): void {
  schemaOverlayStore.set(schemaOverlayKey(artifactId, organizationId), schema);
  void daoPersistSchemaOverlay(artifactId, organizationId, schema);
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
   * DOC-2 (E2E): anti-orphan guard. When `true` AND `useLlm` prose generation
   * degraded to placeholders (i.e. a `llm_prose_fallback` warning was recorded),
   * THROW *before* persisting the wave5 row instead of writing a placeholder-
   * laden document. Without this, the chat-doc path (`docGenerationRuntime`)
   * persisted the row here and only THEN hit its anti-placeholder gate — the
   * throw left an orphan `wave5_artifacts` row behind. Default `false` keeps the
   * legacy silent-degrade behaviour for every other caller (document-studio
   * route, canvas bridge), whose contracts do not expect a hard throw.
   */
  failIfPlaceholderProse?: boolean;
  /**
   * When set, hydrate the outline and FormattingSchema from an approved
   * registered template (Mode 3). The template must belong to the same
   * organization as the call site; cross-tenant template IDs are rejected.
   */
  templateId?: string | null;
  /** Exact version selected by Mode 3 UI; prevents generation after template drift. */
  templateVersion?: string | null;
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
  /**
   * C1 — optional progressive-generation lifecycle hooks. Threaded through
   * so the streaming route (`POST /generate/stream`) can emit SSE events
   * as the pipeline advances, WITHOUT forking the pipeline. When every hook
   * is omitted the function behaves byte-identically to the pre-C1 sync
   * path — the hooks are pure observers and never influence the result.
   *
   * Contract:
   *   - `onPlan` fires exactly once, right after the outline is resolved
   *     (before any prose LLM call), so the FE can paint the section
   *     skeleton immediately.
   *   - `onWarning` fires for every generation-time warning as it is
   *     recorded (LLM prose fallback, etc.).
   *   - `onSection` fires once per section, in `orderIndex` order, after
   *     the schema (including prose) is fully materialized. The section
   *     object handed to the hook is a reference into the SAME final schema
   *     returned in the result, guaranteeing the streamed sections and the
   *     final `schema` are identical.
   *   - A hook that throws MUST NOT break materialization — the caller is
   *     responsible for making its hooks non-throwing; the pipeline wraps
   *     each invocation defensively regardless.
   */
  hooks?: MaterializeDocumentHooks;
}

/**
 * C1 — progressive-generation observer hooks. All optional; see
 * `MaterializeDocumentParams.hooks`. Hooks are best-effort observers: the
 * pipeline invokes each inside a try/catch so a failing hook can never turn
 * generation into a hard failure.
 */
export interface MaterializeDocumentHooks {
  onPlan?: (outline: DocumentOutline) => void;
  onSection?: (section: DocumentSection, index: number, total: number) => void;
  onWarning?: (warning: DocumentGenerationWarning) => void;
}

/** C1 — invoke a lifecycle hook without ever letting it escape upward. */
function safeInvokeHook(fn: (() => void) | undefined, label: string): void {
  if (!fn) return;
  try {
    fn();
  } catch (err) {
    logger.warn('[DocumentStudio] streaming hook threw (ignored)', {
      hook: label,
      message: err instanceof Error ? err.message : String(err),
    });
  }
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

function templateSectionPurpose(section: DocumentTemplate['sectionBlueprint'][number]): string {
  const guidance = [
    section.purpose,
    section.keyMessage ? `Key message: ${section.keyMessage}` : null,
    section.contentHints?.length ? `Content guidance: ${section.contentHints.join('; ')}` : null,
    section.dataNeeded?.length ? `Data needed: ${section.dataNeeded.join('; ')}` : null,
    section.suggestedEvidence ? `Suggested evidence: ${section.suggestedEvidence}` : null,
    section.formattingStyle ? `Formatting: ${section.formattingStyle}` : null,
  ].filter((value): value is string => Boolean(value));
  return guidance.join('\n');
}

export function outlineFromTemplate(
  template: DocumentTemplate,
  intake: DocumentIntake
): DocumentOutline {
  return {
    documentType: template.documentType,
    title: intake.title?.trim() || `${template.documentType.replace(/_/g, ' ')}: ${template.name}`,
    sections: template.sectionBlueprint.map((blueprint) => ({
      title: blueprint.title,
      level: blueprint.level,
      purpose: templateSectionPurpose(blueprint),
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
    if (params.templateVersion && template.version !== params.templateVersion) {
      throw new Error('template_version_mismatch');
    }
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
  // A governed template is the structural source of truth. The UI may send a
  // stale/generic preview outline alongside Mode 3 generation; accepting it
  // here used to silently replace the approved names, order and guidance.
  if (template) {
    outline = outlineFromTemplate(template, params.intake);
  } else if (params.outline) {
    outline = params.outline;
  } else {
    outline = planDocumentOutline(params.intake);
    if (params.useLlm) {
      outline = await refineOutlineWithLlm(outline, params.intake, { enable: true });
    }
  }

  // C1 — emit the resolved outline immediately so the streaming FE can paint
  // the section skeleton before the (potentially slow) prose LLM call runs.
  safeInvokeHook(params.hooks?.onPlan ? () => params.hooks!.onPlan!(outline) : undefined, 'onPlan');

  const sourceRefs = incomingSourceRefs;

  // BUG-FIX (OXFORD/Word stale self-ref): generate the REAL wave5 artifact id
  // UP FRONT and thread it through both the schema (`schema.artifactId`) and the
  // wave5 row (via `externalArtifactId`), instead of building the schema with a
  // transient `documentstudio-pending-<ts>` placeholder that then never gets
  // corrected in the persisted `content_json_native` / `metadata_json`. Matches
  // createWave5Artifact's own default id scheme (`artifact-<uuid>`), so the
  // persisted schema's self-referential id equals the real row id on reload.
  const provisionalArtifactId = `artifact-${randomUUID()}`;
  // Premium tier (B3 structure + content-gen) when flag ON; fail-open + byte-identical
  // to the deterministic builder when OFF (default, all clients). preferPremium tied to
  // useLlm so a purely deterministic request stays deterministic even with the flag on.
  let provisionalSchema = await buildDocumentSchemaPremium(
    {
      artifactId: provisionalArtifactId,
      intake: params.intake,
      outline,
      sourceRefs,
    },
    { orgId: params.organizationId, userId: params.userId, preferPremium: params.useLlm }
  );
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

  // A4 — collect generation-time warnings so silent fallbacks (LLM prose
  // failure → deterministic stubs) become visible to the user instead of
  // being swallowed by a `console.warn`. The collector is threaded into
  // the enrichment layer; it never changes fallback behaviour.
  const baseWarningsCollector = createDocumentGenerationWarningCollector();
  // C1 — when an onWarning hook is present, wrap the collector so each
  // recorded warning is forwarded to the stream as it happens. The wrapper
  // preserves the exact recorded warning (post-normalization) by reading the
  // last entry off the underlying collector's list; identity of the final
  // `generationWarnings` array is unchanged.
  const warningsCollector = params.hooks?.onWarning
    ? {
        record(input: Parameters<typeof baseWarningsCollector.record>[0]): void {
          const before = baseWarningsCollector.size();
          baseWarningsCollector.record(input);
          const after = baseWarningsCollector.list();
          if (after.length > before) {
            const recorded = after[after.length - 1];
            safeInvokeHook(() => params.hooks!.onWarning!(recorded), 'onWarning');
          }
        },
        list: () => baseWarningsCollector.list(),
        size: () => baseWarningsCollector.size(),
      }
    : baseWarningsCollector;

  // D11 — block-level prose generation. Opt-in via `useLlm`; fills the
  // deterministic placeholder prose with grounded, consulting-grade
  // narrative (Teresa). Best-effort: any failure returns the
  // deterministic schema unchanged, so materialization never fails
  // because the LLM was unavailable.
  if (params.useLlm) {
    provisionalSchema = await generateBlockProse(provisionalSchema, params.intake, sourceRefs, {
      enable: true,
      warnings: warningsCollector,
    });
  }

  // FINAL grounding boundary. Must remain after every content/prose LLM layer:
  // earlier guards can otherwise be overwritten by D11 prose enrichment. This
  // also recomputes EvidenceContract from the exact schema being persisted.
  provisionalSchema = enforceDocumentSchemaGrounding(
    provisionalSchema,
    [params.intake.title, params.intake.description].filter(Boolean).join(' — ')
  );

  // Template labels and authoring guidance are governed metadata, not factual
  // claims derived from intake. The grounding boundary may redact unfamiliar
  // wording; restore the approved skeleton afterwards while leaving generated
  // body claims fully guarded.
  if (template) {
    const governedOutline = outlineFromTemplate(template, params.intake);
    provisionalSchema.sections.forEach((section, index) => {
      const governed = governedOutline.sections[index];
      if (!governed) return;
      section.title = governed.title;
      section.purpose = governed.purpose;
      const heading = section.blocks.find((block) => block.type === 'heading');
      if (heading) heading.content = { text: governed.title };
    });
  }

  const generationWarnings = warningsCollector.list();

  // DOC-2 (E2E): anti-orphan guard. When the caller opts in AND prose
  // enrichment degraded to placeholders (a `llm_prose_fallback` warning), refuse
  // to persist a placeholder-laden document. Throwing HERE — before
  // `createWave5Artifact` — is what makes materialization atomic for the chat-doc
  // path: previously the row was written unconditionally and the caller's
  // anti-placeholder gate threw only afterwards, orphaning the wave5 row.
  // Default-off, so every other caller keeps its silent-degrade contract.
  if (
    params.failIfPlaceholderProse &&
    params.useLlm &&
    generationWarnings.some((w) => w.code === 'llm_prose_fallback')
  ) {
    throw new Error(
      'Generacja treści nie powiodła się (LLM niedostępny) — dokument nie został wypełniony'
    );
  }

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
  // A4 — persist the warnings channel on the artifact metadata so the
  // GET path can rehydrate them (only when non-empty to keep pre-A4
  // metadata byte-stable for full-fidelity documents).
  if (generationWarnings.length > 0) {
    metadata[STUDIO_GENERATION_WARNINGS_METADATA_KEY] = generationWarnings;
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
    // Persist under the id the schema already carries, so the row id and the
    // schema's self-referential `artifactId` are identical on reload.
    externalArtifactId: provisionalArtifactId,
  });

  // MAT-010 fix (same bug class as G8) — `createWave5Artifact` returns
  // `getWave5Artifact(...)`, a fresh SELECT, so it is `null` whenever the
  // underlying `dbRun` INSERT silently failed (DbPromise's default
  // `fallback:true` resolves `{success:false}` instead of throwing). Falling
  // back to `provisionalArtifactId` here would let this route report success
  // with an artifactId pointing at a row that was never written — MAT-010's
  // own tracked Document owner table (`wave5_artifacts`), so this directly
  // undermines the lineage contract, not just document creation. Fail
  // honestly instead: the caller (`POST /api/document-studio/generate`)
  // already wraps this in a try/catch that turns a thrown error into a 500.
  if (!artifact) {
    throw new Error('Failed to persist document artifact (wave5_artifacts write did not succeed)');
  }
  const artifactId = String(artifact.artifactId ?? artifact.artifact_id ?? provisionalArtifactId);
  const finalSchema: DocumentSchema = { ...provisionalSchema, artifactId };

  // HP-17 bridge — persist the inline EvidenceContract (`buildDocumentEvidenceContract`,
  // HP-16) as an EvidenceEnvelope (`artifact_evidence`, artifactType='document') so
  // the evidence panel (fala 9, ArtifactRightPanel) has something to render.
  // Previously: `finalSchema.evidence` was computed and returned to the caller
  // but never persisted — panel showed empty state for documents despite the
  // engine having real data. Fire-and-forget + fail-safe: a write failure NEVER
  // blocks document materialization.
  if (finalSchema.evidence) {
    void safePersistEvidenceContract(finalSchema.evidence, {
      organizationId: params.organizationId,
      artifactType: 'document',
      artifactId,
      service: 'documentContentGenerator',
      createdBy: params.userId,
    }).catch(() => {});
  }

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

  // The schema returned by generate must be the same schema a subsequent GET
  // observes. Wave5 is inserted before lifecycle finalization, so persist the
  // finalized canonical snapshot in the durable, tenant-scoped schema overlay
  // and synchronously populate the read-through cache. This closes the race in
  // which the streaming response contained assumption flags but opening the
  // saved artifact URL rehydrated an earlier snapshot without them.
  const finalOverlayPersistence = await daoPersistSchemaOverlay(
    artifactId,
    params.organizationId,
    finalSchema
  );
  if (!finalOverlayPersistence.ok) {
    logger.warn('[DocumentStudio] final generated schema overlay did not persist', {
      artifactId,
      organizationId: params.organizationId,
    });
  }
  schemaOverlayStore.set(schemaOverlayKey(artifactId, params.organizationId), finalSchema);

  // C1 — emit each finalized section (in orderIndex order) so the streaming
  // FE can progressively fill the skeleton painted from the `plan` event. The
  // sections handed to the hook are references into `finalSchema.sections`,
  // so the streamed sections and the final `schema` in the `done` event are
  // guaranteed identical (progressive delivery, not a different result).
  if (params.hooks?.onSection) {
    const orderedSections = [...finalSchema.sections].sort((a, b) => a.orderIndex - b.orderIndex);
    const total = orderedSections.length;
    orderedSections.forEach((section, index) => {
      safeInvokeHook(() => params.hooks!.onSection!(section, index, total), 'onSection');
    });
  }

  return {
    artifactId,
    schema: finalSchema,
    ...(generationWarnings.length > 0 ? { generationWarnings } : {}),
  };
}

export async function getDocumentArtifact(
  artifactId: string,
  organizationId: string
): Promise<DocumentSchema | null> {
  // Module 10 hardening — ensure the durable overlay (post-rollback /
  // post-content-block-insert) is loaded into the cache before the read.
  await ensureEditorStateHydrated(artifactId, organizationId);
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
    // D1 E2E fix — `getWave5Artifact`/`mapArtifact` (wave5ArtifactRuntimeService.ts)
    // maps the persisted `content_json_native` column onto a camelCase
    // `contentJson` property; there is no `content_json` (snake_case) property on
    // the mapped artifact, so this fallback previously ALWAYS missed and every
    // fresh GET (page reload / resume-by-URL / export / comments / QA — anything
    // reading through getDocumentArtifact) 404'd even though the artifact and its
    // schema were persisted correctly. Caught by the D1 Playwright E2E suite
    // (tests/e2e/documents/mode1-intake-to-document.spec.ts "reload resumes").
    const contentJson = parseMetadata(artifact.contentJson);
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

/**
 * A4 — read the persisted generation-warnings channel for an artifact.
 * Returns `[]` for artifacts that generated at full fidelity (no warnings
 * persisted) and for legacy artifacts that predate this channel. Never
 * throws; a missing / malformed metadata row degrades to an empty list so
 * the GET path never fails because of the warnings read.
 */
export async function getDocumentGenerationWarnings(
  artifactId: string,
  organizationId: string
): Promise<DocumentGenerationWarning[]> {
  try {
    const artifact = await getWave5Artifact(artifactId, organizationId);
    if (!artifact) return [];
    const metadata = parseMetadata(artifact.metadata_json ?? artifact.metadata);
    const raw = metadata?.[STUDIO_GENERATION_WARNINGS_METADATA_KEY];
    return normalizeGenerationWarnings(raw);
  } catch {
    return [];
  }
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

    // Slice E5.6.qa.hard — pass `organizationId` so the source-drift
    // category can compare pinned versions against the per-tenant
    // version registry.
    const report = runDocumentQa(schema, {
      brandVoiceProfile: activeBrandVoiceProfile,
      organizationId,
    });
    report.organizationId = organizationId;

    // A3 — bramka FABRYKACJI (twarda, nie soft-override): konkretne niepoparte
    // liczby BEZ znacznika „(założenie)" w dokumencie bez źródeł czynią eksport
    // „partnerski" (typ approval-gated) blokowanym — wymaga JAWNEGO override
    // (parametr qaOverride), nie cichego przełamania. Fail-soft: błąd samego
    // detektora NIGDY nie blokuje dokumentu (błąd QA ≠ blokada). Deterministyczne.
    let fabricationCount = 0;
    let fabricationSample: string[] = [];
    try {
      const { detectDocumentFabrication } = await import('./documentFabricationCheck.js');
      const fab = detectDocumentFabrication(schema);
      fabricationCount = fab.count;
      fabricationSample = fab.hits.slice(0, 5).map((h) => h.value);
    } catch (fabErr) {
      logger.warn(
        `[DocumentStudio] fabrication check skipped (fail-soft): ${
          fabErr instanceof Error ? fabErr.message : String(fabErr)
        }`
      );
    }
    const fabricationBlocking = fabricationCount > 0;
    const effectiveBlocking = report.anyBlocking || fabricationBlocking;
    if (fabricationBlocking) {
      (report as unknown as Record<string, unknown>).fabrication = {
        count: fabricationCount,
        sample: fabricationSample,
      };
    }

    // Compact, audit-friendly snapshot of the report. Used both in the
    // export manifest and in the audit `details` so the audit panel can
    // replay the QA state at export time without re-running QA.
    const reportSnapshot = {
      anyBlocking: report.anyBlocking,
      fabricationCount,
      fabricationSample,
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

    if (effectiveBlocking && !options.qaOverride) {
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
          fabricationCount,
          qaReport: reportSnapshot,
        },
      });
      throw new QaBlockingError(report);
    }
    if (effectiveBlocking && options.qaOverride) {
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
          fabricationCount,
          qaReport: reportSnapshot,
        },
      });
      (manifest as Record<string, unknown>).qaOverride = true;
    }
    (manifest as Record<string, unknown>).qaReportSummary = {
      anyBlocking: report.anyBlocking,
      fabricationCount,
      fabricationSample,
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
  // Slice E15.5.coverPageLogo — when the schema asks the cover page
  // to include the org logo, hydrate the asset bytes from the asset
  // registry. Best-effort: if the registry has no active logo for
  // this tenant, fall through and the cover renders without a logo
  // (legacy behaviour). Failures here MUST NOT block the export.
  let coverLogoAsset: { mimeType: 'image/png' | 'image/jpeg'; dataBase64: string } | undefined;
  try {
    const wantsLogo =
      schema.formattingSchema.coverPageDetailed?.includeLogo === true &&
      schema.formattingSchema.coverPageDetailed?.enabled !== false &&
      schema.formattingSchema.coverPage === true;
    if (wantsLogo) {
      const logoAsset = getActiveOrgLogo(organizationId);
      if (logoAsset) {
        coverLogoAsset = {
          mimeType: logoAsset.mimeType,
          dataBase64: logoAsset.dataBase64,
        };
      }
    }
  } catch (err) {
    // Surface but never block: the export should not fail because the
    // asset registry is misbehaving. Manifest captures the issue for
    // post-hoc audit.
    (manifest as Record<string, unknown>).coverLogoHydrationError =
      err instanceof Error ? err.message : String(err);
  }

  // A4 — collect export-time warnings (chart rasterization fell back to a
  // text placeholder; requested cover logo unavailable). Threaded into the
  // binary renderers; never changes render behaviour.
  const exportWarnings = createDocumentGenerationWarningCollector();

  let binary: Buffer;
  if (format === 'docx') {
    binary = await renderDocumentSchemaToDocxBuffer(schema, {
      coverLogoAsset,
      warnings: exportWarnings,
    });
  } else {
    binary = await renderDocumentSchemaToPdfBuffer(schema, {
      coverLogoAsset,
      warnings: exportWarnings,
    });
  }
  const generationWarnings = exportWarnings.list();

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
      // A4 — mirror export warnings into the manifest so any manifest
      // consumer (audit panel, download record) sees the degradations.
      ...(generationWarnings.length > 0 ? { generationWarnings } : {}),
    },
    ...(generationWarnings.length > 0 ? { generationWarnings } : {}),
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
  // Write-through to the durable ledger (best-effort; never throws).
  void daoPersistAuditEntry(entry);
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
  await persistProposalWriteThrough(proposal);
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
  await persistProposalWriteThrough(proposal);
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
  await persistProposalWriteThrough(proposal);
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
  await persistProposalWriteThrough(proposal);
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
  await persistProposalWriteThrough(proposal);
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
  await persistProposalWriteThrough(proposal);
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
  await ensureEditorStateHydrated(params.artifactId, params.organizationId);
  const proposal = getStoredProposal(params.artifactId, params.organizationId, params.proposalId);
  if (proposal.status !== 'proposed') {
    throw new Error('proposal_not_pending');
  }
  const schema = await getDocumentArtifact(params.artifactId, params.organizationId);
  if (!schema) {
    throw new Error('artifact_not_found');
  }
  const nextSchema = applyProposalToSchema(schema, proposal);

  // P1 fix — approving a proposal mutates the in-memory schema returned to
  // the caller, but without this write-through the mutation never reached
  // the durable overlay: a page reload (or any other read through
  // `getDocumentArtifact`) would resolve the pre-approval schema (overlay
  // miss falls back to the stale wave5 row, or an older overlay entry from
  // a prior rollback/content-block insert) and the approved edit vanished.
  // Same write-through used by `insertDocumentContentBlock` /
  // `rollbackDocumentToVersion` — keeps the three mutators on one durable
  // path instead of introducing a second persistence mechanism.
  persistSchemaOverlayWriteThrough(params.artifactId, params.organizationId, nextSchema);

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
  await persistProposalWriteThrough(nextProposal);
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
export async function rejectEditProposal(params: {
  artifactId: string;
  organizationId: string;
  userId: string;
  proposalId: string;
}): Promise<DocumentEditorProposal> {
  await ensureEditorStateHydrated(params.artifactId, params.organizationId);
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
  await persistProposalWriteThrough(nextProposal);
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

export class DocumentContentBlockInsertError extends Error {
  readonly code:
    | 'invalid_input'
    | 'document_not_found'
    | 'section_not_found'
    | 'content_block_not_found'
    | 'content_block_archived';

  constructor(
    code:
      | 'invalid_input'
      | 'document_not_found'
      | 'section_not_found'
      | 'content_block_not_found'
      | 'content_block_archived',
    message: string
  ) {
    super(message);
    this.name = 'DocumentContentBlockInsertError';
    this.code = code;
  }
}

export interface InsertDocumentContentBlockParams {
  organizationId: string;
  artifactId: string;
  userId: string;
  contentBlockId: string;
  sectionId: string;
  position?: 'start' | 'end' | 'after_block';
  afterBlockId?: string;
  blockId?: string;
}

export interface InsertDocumentContentBlockResult {
  schema: DocumentSchema;
  insertedBlock: DocumentBlock;
  snapshot: DocumentVersionSnapshot;
}

export async function insertDocumentContentBlock(
  params: InsertDocumentContentBlockParams
): Promise<InsertDocumentContentBlockResult> {
  const sectionId = params.sectionId?.trim();
  const contentBlockId = params.contentBlockId?.trim();
  if (!params.organizationId || !params.artifactId || !params.userId) {
    throw new DocumentContentBlockInsertError('invalid_input', 'auth context is required');
  }
  if (!sectionId) {
    throw new DocumentContentBlockInsertError('invalid_input', 'sectionId is required');
  }
  if (!contentBlockId) {
    throw new DocumentContentBlockInsertError('invalid_input', 'contentBlockId is required');
  }

  const schema = await getDocumentArtifact(params.artifactId, params.organizationId);
  if (!schema) {
    throw new DocumentContentBlockInsertError(
      'document_not_found',
      `document ${params.artifactId} not found`
    );
  }

  await ensureContentBlockRegistryHydrated(params.organizationId);
  let instantiated: ReturnType<typeof instantiateDocumentContentBlock>;
  try {
    instantiated = instantiateDocumentContentBlock({
      organizationId: params.organizationId,
      contentBlockId,
      blockId: params.blockId,
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'content_block_archived') {
      throw new DocumentContentBlockInsertError(
        'content_block_archived',
        'content block is archived'
      );
    }
    if (code === 'content_block_not_found') {
      throw new DocumentContentBlockInsertError(
        'content_block_not_found',
        'content block not found'
      );
    }
    throw err;
  }

  const nextSchema = cloneSchema(schema);
  const section = nextSchema.sections.find((candidate) => candidate.sectionId === sectionId);
  if (!section) {
    throw new DocumentContentBlockInsertError(
      'section_not_found',
      `section ${sectionId} not found`
    );
  }

  const position = params.position ?? 'end';
  if (position === 'start') {
    section.blocks.unshift(instantiated.block);
  } else if (position === 'after_block') {
    const afterBlockId = params.afterBlockId?.trim();
    if (!afterBlockId) {
      throw new DocumentContentBlockInsertError(
        'invalid_input',
        'afterBlockId is required for after_block inserts'
      );
    }
    const index = section.blocks.findIndex((block) => block.blockId === afterBlockId);
    if (index === -1) {
      throw new DocumentContentBlockInsertError(
        'invalid_input',
        `afterBlockId ${afterBlockId} was not found in section ${sectionId}`
      );
    }
    section.blocks.splice(index + 1, 0, instantiated.block);
  } else {
    section.blocks.push(instantiated.block);
  }

  nextSchema.updatedAt = nowIso();
  persistSchemaOverlayWriteThrough(params.artifactId, params.organizationId, nextSchema);

  const lifecycle = getDocumentStatusOrDefault(params.artifactId, params.organizationId);
  const snapshot = createDocumentVersionSnapshotInternal({
    organizationId: params.organizationId,
    artifactId: params.artifactId,
    userId: params.userId,
    schema: nextSchema,
    statusAtCapture: lifecycle.status,
    label: 'content block insert',
    reason: instantiated.template.name,
    origin: 'manual',
  });

  pushAuditEntry({
    auditId: makeId('doc-audit'),
    artifactId: params.artifactId,
    organizationId: params.organizationId,
    action: 'content_block_inserted',
    actorId: params.userId,
    occurredAt: nowIso(),
    details: {
      contentBlockId,
      contentBlockName: instantiated.template.name,
      insertedBlockId: instantiated.block.blockId,
      sectionId,
      position,
      afterBlockId: params.afterBlockId,
      snapshotVersionId: snapshot.versionId,
      snapshotVersionNumber: snapshot.versionNumber,
    },
  });

  const readBack = await getDocumentArtifact(params.artifactId, params.organizationId);
  return {
    schema: readBack ?? nextSchema,
    insertedBlock: instantiated.block,
    snapshot,
  };
}

/**
 * P0 data-loss fix — manual (non-AI) content autosave.
 *
 * `DocumentTipTapEditor` lets a user type directly into the document.
 * Before this slice that edit only ever updated the React component's
 * local `schema` state (`DocumentStudioView.tsx`: `onSchemaUpdated={setSchema}`)
 * — nothing reached the server, so a reload silently reverted to
 * whatever was last durably persisted (an AI proposal, or nothing).
 *
 * This reuses the SAME durable layer the AI-proposal / rollback /
 * content-block-insert paths already write through:
 * `document_studio_schema_overlay` via `persistSchemaOverlayWriteThrough`
 * (`documentEditorStateRegistryDao.ts`). `getDocumentArtifact` already
 * reads that overlay first, so a manual save is visible on the very
 * next GET — no separate read path needed.
 *
 * Optimistic lock (mirrors `PUT /api/v8/notebook/pages/:noteId/content`):
 * the caller must pass `expectedVersion` — the `updatedAt` it last read.
 * If the current server-side `updatedAt` (overlay-or-wave5) has moved on
 * (e.g. an AI proposal was approved, or another tab autosaved first),
 * the write is rejected with `DocumentManualSaveConflictError` (409 at
 * the route layer) instead of silently overwriting the newer state.
 *
 * This function does NOT participate in the proposal/approve pipeline —
 * it only ever overwrites `sections` (the editable body) on the current
 * schema, so it can never race with `approveEditProposal` clobbering a
 * proposal's own bookkeeping fields.
 */
export class DocumentManualSaveConflictError extends Error {
  readonly code = 'manual_save_conflict' as const;
  readonly serverVersion: string;
  constructor(serverVersion: string) {
    super('Document content changed since it was last loaded.');
    this.name = 'DocumentManualSaveConflictError';
    this.serverVersion = serverVersion;
  }
}

export class DocumentManualSaveNotFoundError extends Error {
  readonly code = 'document_not_found' as const;
  constructor(artifactId: string) {
    super(`document ${artifactId} not found`);
    this.name = 'DocumentManualSaveNotFoundError';
  }
}

export class DocumentManualStructureMismatchError extends Error {
  readonly code = 'template_structure_mismatch' as const;
  readonly expectedSectionCount: number;
  readonly receivedSectionCount: number;
  constructor(expectedSectionCount: number, receivedSectionCount: number) {
    super('A template-based document must preserve its approved section structure.');
    this.name = 'DocumentManualStructureMismatchError';
    this.expectedSectionCount = expectedSectionCount;
    this.receivedSectionCount = receivedSectionCount;
  }
}

export interface UpdateDocumentManualContentParams {
  artifactId: string;
  organizationId: string;
  userId: string;
  /** The editor's freshly-converted sections (ProseMirror → schema). */
  sections: DocumentSchema['sections'];
  /** The `updatedAt` the client last read — optimistic-lock guard. */
  expectedVersion: string;
  /**
   * P-10 (2026-07-28) — optional title rename, reusing this same durable
   * overlay write instead of a brand-new endpoint. The TopBar title editor
   * (`ExecutiveModuleShell`'s `onTitleChange`) sends the current sections
   * unchanged alongside the new title so this stays a single write, not a
   * separate title-only code path that could race the content autosave.
   * Omitted/blank → title is left untouched.
   */
  title?: string;
}

export interface UpdateDocumentManualContentResult {
  schema: DocumentSchema;
}

export async function updateDocumentManualContent(
  params: UpdateDocumentManualContentParams
): Promise<UpdateDocumentManualContentResult> {
  if (!params.artifactId || !params.organizationId || !params.userId || !params.expectedVersion) {
    throw new Error('invalid_input');
  }
  if (!Array.isArray(params.sections)) {
    throw new Error('invalid_input');
  }

  const current = await getDocumentArtifact(params.artifactId, params.organizationId);
  if (!current) {
    throw new DocumentManualSaveNotFoundError(params.artifactId);
  }

  if (String(current.updatedAt) !== String(params.expectedVersion)) {
    throw new DocumentManualSaveConflictError(current.updatedAt);
  }

  const nextSchema = cloneSchema(current);
  if (current.templateRef) {
    if (params.sections.length !== current.sections.length) {
      throw new DocumentManualStructureMismatchError(
        current.sections.length,
        params.sections.length
      );
    }
    // Full-editor replacement may change content, never the governed template
    // skeleton. Map edited blocks back onto the existing section identities so
    // a serializer cannot flatten or rename the approved structure.
    nextSchema.sections = current.sections.map((section, index) => ({
      ...section,
      blocks: params.sections[index].blocks,
      sourceRefs: params.sections[index].sourceRefs,
    }));
  } else {
    nextSchema.sections = params.sections;
  }
  const trimmedTitle = typeof params.title === 'string' ? params.title.trim() : '';
  if (trimmedTitle) {
    nextSchema.title = trimmedTitle;
  }
  nextSchema.updatedAt = nowIso();

  // The autosave response is a durability boundary: do not acknowledge the
  // edit (or place it in the process cache) until PostgreSQL confirms it.
  // `expectedVersion` is also checked inside the UPSERT so two requests that
  // read the same version cannot both win.
  const persistence = await daoPersistSchemaOverlay(
    params.artifactId,
    params.organizationId,
    nextSchema,
    params.expectedVersion
  );
  if (persistence.conflict) {
    const winner = await daoLoadSchemaOverlay(params.artifactId, params.organizationId);
    throw new DocumentManualSaveConflictError(winner?.updatedAt ?? current.updatedAt);
  }
  if (!persistence.ok) {
    throw new Error('manual_save_persistence_failed');
  }
  schemaOverlayStore.set(schemaOverlayKey(params.artifactId, params.organizationId), nextSchema);

  pushAuditEntry({
    auditId: makeId('doc-audit'),
    artifactId: params.artifactId,
    organizationId: params.organizationId,
    action: 'manual_content_saved',
    actorId: params.userId,
    occurredAt: nextSchema.updatedAt,
    details: {
      sectionCount: nextSchema.sections.length,
      blockCount: nextSchema.sections.reduce((sum, s) => sum + s.blocks.length, 0),
      ...(trimmedTitle && trimmedTitle !== current.title ? { titleRenamedTo: trimmedTitle } : {}),
    },
  });

  // Epic E1 — automatic history. Best-effort, server-side auto-capture
  // of a version snapshot on this autosave: a time threshold (>=10 min
  // since the last snapshot) OR a significant content-length delta
  // (>15% vs the last snapshot) triggers an `'autosave'`-origin
  // snapshot, retained up to 30 per artifact (oldest auto-pruned;
  // manual/status/rollback snapshots are never touched). The document
  // save above has already fully committed by this point — a failure
  // here (hydration, snapshot creation, or pruning) must NEVER surface
  // as a save error, so the whole step is wrapped and swallowed. Awaited
  // (not fire-and-forget) so the snapshot is durably visible to the
  // history view immediately after this request resolves.
  try {
    await ensureDocumentVersionSnapshotsHydrated(params.organizationId);
    const lifecycle = getDocumentStatusOrDefault(params.artifactId, params.organizationId);
    maybeAutoCaptureDocumentVersionSnapshot({
      organizationId: params.organizationId,
      artifactId: params.artifactId,
      userId: params.userId,
      schema: nextSchema,
      statusAtCapture: lifecycle.status,
    });
  } catch {
    // fail-soft: auto-capture must never affect the autosave response.
  }

  const readBack = await getDocumentArtifact(params.artifactId, params.organizationId);
  return { schema: readBack ?? nextSchema };
}

export function listDocumentAuditEntries(
  artifactId: string,
  organizationId: string
): DocumentAuditEntry[] {
  return [...(auditStore.get(getAuditKey(artifactId, organizationId)) ?? [])];
}

/**
 * Async variant that hydrates the durable audit ledger from the DAO
 * before returning. Routes should prefer this so a cold process surfaces
 * persisted audit history. Falls back to whatever is in the in-process
 * cache on any DAO failure.
 */
export async function listDocumentAuditEntriesAsync(
  artifactId: string,
  organizationId: string
): Promise<DocumentAuditEntry[]> {
  await ensureEditorStateHydrated(artifactId, organizationId);
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
  persistSchemaOverlayWriteThrough(params.artifactId, params.organizationId, restoredSchema);

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
  hydratedEditorState.clear();
  // Also wipe the DAO-level persistence so cold-start hydration on the next
  // test does not reload overlays written by earlier test cases. Fire-and-
  // forget: the Promise resolves before the first `await` in the test body,
  // which is early enough for the hydration guard to see an empty table.
  void daoResetSchemaOverlayForTests().catch(() => undefined);
}

/**
 * @internal — test helper to clear ALL in-process editor-state caches
 * (proposals, audit ledger, schema overlay) and the hydration guard.
 * Use this in persistence tests that exercise the cold-start hydration
 * path so the in-process cache does not mask the DAO read.
 */
export function __resetEditorStateCachesForTests(): void {
  proposalStore.clear();
  auditStore.clear();
  schemaOverlayStore.clear();
  hydratedEditorState.clear();
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

  // Slice E5.6.qa.hard — pass `organizationId` so the source-drift
  // category can compare pinned `sourceVersion` against the per-tenant
  // version registry for HARD drift detection.
  const report = runDocumentQa(schema, {
    template,
    brandVoiceProfile,
    organizationId,
  });
  report.organizationId = organizationId;

  // A3 — deterministyczny sygnał fabrykacji (documentFabricationCheck), już
  // liczony na ścieżce eksportu partnerskiego; tutaj dołączamy go ADDYTYWNIE
  // do RAPORTU QA (nie zmienia `anyBlocking` ani żadnej logiki generacji) tak,
  // by panel QA (uruchamiany na życzenie, dla KAŻDEGO typu dokumentu, nie
  // tylko approval-gated) mógł pokazać badge jakości. Fail-soft: błąd
  // detektora nigdy nie psuje raportu QA.
  try {
    const { detectDocumentFabrication } = await import('./documentFabricationCheck.js');
    const fab = detectDocumentFabrication(schema);
    report.fabrication = {
      count: fab.count,
      sample: fab.hits.slice(0, 5).map((h) => h.value),
    };
  } catch (fabErr) {
    logger.warn(
      `[DocumentStudio] fabrication check skipped (fail-soft, qa-report): ${
        fabErr instanceof Error ? fabErr.message : String(fabErr)
      }`
    );
  }

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
