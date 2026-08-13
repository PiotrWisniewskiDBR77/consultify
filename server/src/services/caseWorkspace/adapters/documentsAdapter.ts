/**
 * Case Workspace — Documents / Presentation capability adapters (Strumień C,
 * packet D1c).
 *
 * ============================================================================
 * WHY ONE FILE FOR TWO CAPABILITIES
 * ============================================================================
 * The task brief asked this packet to investigate whether "Documents" and
 * "Presentation" are one subsystem or two, BEFORE writing anything. They are
 * TWO, on real, separate evidence:
 *   - Documents persist through `wave5ArtifactRuntimeService.createWave5Artifact`
 *     / `getWave5Artifact` into the generic `wave5_artifacts` table (every
 *     artifact type — report, insight, etc. — shares this one table; a
 *     Document Studio row has `artifact_type = 'report'`).
 *   - Presentations persist through their OWN dedicated `presentation_decks`
 *     / `presentation_cards` tables, via `presentationGeneratorService.ts`,
 *     completely independent of wave5.
 *   No shared storage, no shared write path, no shared identifier scheme.
 *   They only share a *product* name ("Materiały" / "Documents &
 *   Presentations" in the menu) and this file, because the two Golden Cases
 *   are small enough that one packet covers both without re-deriving the
 *   shared four-step adapter shape (../_shared.ts) twice.
 *
 * ============================================================================
 * DOCUMENTS — the real native API, and why THIS one (not the ones rejected)
 * ============================================================================
 * `documentStudio/documentStudioService.ts`:
 *   - CREATE: `materializeDocumentArtifact(params)` — deterministic when
 *     `useLlm` is false/omitted (the mode this adapter always uses, for
 *     synchronous, timeout-safe behaviour); builds a `DocumentSchema` from
 *     `params.intake` (title/description/documentType/...), renders it to
 *     markdown, and persists via `createWave5Artifact`.
 *   - READ: `getDocumentArtifact(artifactId, organizationId)` — returns the
 *     same `DocumentSchema`.
 *   - REAL, PRODUCTION CALLER, confirmed by reading the route, not assumed:
 *     `POST /api/document-studio/generate`
 *     (server/src/routes/document-studio.routes.ts:843-913) calls
 *     `materializeDocumentArtifact` directly and its own comment says this is
 *     the same pipeline the chat `generate_deliverable` tool depends on. This
 *     is not dead code.
 *   - CONTENT GENUINELY PERSISTS, not just an id: `getDocumentArtifact` reads
 *     back through a durable schema-overlay table
 *     (`documentEditorStateRegistryDao.persistSchemaOverlay`) OR, on a cold
 *     cache, straight from `wave5_artifacts.content_json_native` — the same
 *     row `materializeDocumentArtifact` wrote. Verified against a REAL
 *     Postgres in `documentsAdapter.pg.test.ts`'s "success" case, which
 *     asserts on rendered block TEXT, not merely on `artifactId` existing —
 *     see this file's "MAT-010" section below for exactly why that
 *     distinction matters here.
 *
 * WHAT WAS INVESTIGATED AND REJECTED for the Documents create path:
 *   - No template-driven "Mode 3" input is exposed by this adapter's payload
 *     (no `templateId`). Templates add a whole extra validation surface
 *     (`preflightRequiredSources`, `MissingRequiredSourceError`) this Golden
 *     Case's minimal "caseId + description -> a document" shape does not
 *     need; a future packet can add a `templateId` field without touching
 *     this file's create/read contract.
 *   - `useLlm: true` is deliberately NEVER set by this adapter. LLM prose
 *     generation is a best-effort, unbounded-latency, network-dependent path
 *     (`generateBlockProse`) — exactly the kind of external dependency this
 *     program's own INTERNAL binding's fixed `timeoutMs` is not built to
 *     babysit gracefully (a hung LLM call would just eat the whole budget and
 *     surface as CAPABILITY_TIMEOUT with nothing to show for it). Deterministic
 *     generation is fast, byte-reproducible for the same input, and is what
 *     every OTHER Document Studio caller gets by default too (`useLlm` is
 *     opt-in there as well).
 *
 * ============================================================================
 * PRESENTATION — the real native API, and the DEFECT this adapter had to
 * discover and defend against ITSELF (the wrapped module has NO defense)
 * ============================================================================
 * `presentationGeneratorService.ts`:
 *   - CREATE: `createNativeDeck(params)` — "U02 — create a native
 *     Presentation artifact from a caller-supplied deck model." Deliberately
 *     NOT the LLM-driven `generateOutline`/`generateDeck` pipeline (that path
 *     is async/multi-step/non-deterministic and its FIRST write, `POST
 *     /decks` (line ~1798) / `POST /generate/outline` (line ~1479), persists
 *     only a `status:'draft'` row with an OUTLINE, not slide content — slides
 *     are filled in by a LATER, separate, LLM-driven step. That shape is
 *     wrong for a synchronous create+read Golden Case and is exactly the
 *     shape that produced this program's own documented "decks marked ready
 *     with zero bytes of content" history.) `createNativeDeck` instead takes
 *     an already-built `UnifiedReportJSON` (this adapter constructs one
 *     minimal, REAL cover slide from the payload's own title/subtitle — never
 *     placeholder text) and persists it in ONE synchronous call — genuinely
 *     analogous to Finance's "one write, no LLM in the loop" shape.
 *   - REAL CALLER: today, `createNativeDeck`'s only production caller is
 *     `transformationFinalOutputService.ts`'s governed "final outputs"
 *     pipeline (a narrow, `facts`-digest-driven flow this adapter's minimal
 *     Golden Case does not reuse) — confirmed via
 *     `grep -rn "createNativeDeck(" server/src`. That caller proves the
 *     function is real, exercised code, not a phantom; it does NOT prove this
 *     adapter's own call shape (a small ad hoc `UnifiedReportJSON`) has been
 *     exercised before. `documentsAdapter.pg.test.ts` is therefore the FIRST
 *     real-Postgres proof that `createNativeDeck` works for a plain,
 *     non-transformation caller — a genuinely new fact this investigation
 *     produced, not merely confirmed.
 *   - READ: there is NO exported "getNativeDeck" anywhere in this codebase.
 *     Every route in `presentations.routes.ts` that reads a deck back
 *     (`GET /decks/:id` and ~10 siblings) does the SAME inline
 *     `SELECT * FROM presentation_decks WHERE id = ? AND organization_id = ?`
 *     followed by the EXPORTED, pure `normalizeDeckDocument(row)` from
 *     `presentationDeckDocumentService.ts`. This adapter's own readback does
 *     the identical thing — not an invented shortcut, the established
 *     pattern for this table.
 *
 * *** THE DEFECT THIS ADAPTER FOUND, NOT ONLY DEFENDED AGAINST ***
 * `createNativeDeck`'s `INSERT INTO presentation_decks` (line ~206 of
 * presentationGeneratorService.ts) goes through this file's local `dbRun`,
 * which for a call with no pinned transaction resolves to `pooledRun` from
 * `utils/DbPromise.js` — same default `fallback:true` already documented in
 * financeAdapter.ts and documentStudioService.ts's own "MAT-010" comment,
 * meaning a genuine SQL failure on THAT INSERT resolves `{success:false}`
 * instead of throwing. UNLIKE `createWave5Artifact` (which returns via a
 * fresh `getWave5Artifact` re-read) and UNLIKE `materializeDocumentArtifact`
 * (which explicitly null-checks that re-read and throws), `createNativeDeck`
 * does NOTHING WITH `dbRun`'s return value — it proceeds straight to
 * `artifactRegistryService.registerArtifactOrigin` (an entirely separate
 * table) regardless, and — because that registry write has no dependency on
 * the deck row actually existing — it can succeed even when the deck INSERT
 * silently did not, so `createNativeDeck` returns a normal-looking
 * `{deckId, deck, slideCount, registryArtifactId}` for a deck that was NEVER
 * WRITTEN. This is a WORSE case than Finance's (which at least has ONE
 * internal re-read guard) and a more literal instance of this program's
 * documented "decks marked ready with zero bytes of content" history than
 * anything this packet went looking for. `presentationGeneratorService.ts`
 * is outside this packet's allowlist to fix, so the defense lives entirely
 * here: this adapter ALWAYS re-reads `presentation_decks` by
 * `(id, organization_id)` after calling `createNativeDeck` and refuses to
 * report SUCCEEDED unless the row exists AND its cover card carries the real
 * subtitle text this call supplied (see `documentsAdapter.pg.test.ts`'s
 * negative-control case, which forces exactly this silent-INSERT-failure
 * path by driving the real `createNativeDeck` with a `status` value outside
 * `presentation_decks`'s own `CHECK (status IN (...))` constraint).
 *
 * ============================================================================
 * doc 05 §5's per-adapter checklist (see decisionAdapter.ts's header for the
 * fuller explanation of each row — not repeated verbatim here):
 *   input/output contract -> requireNonBlankInput/requireEnumInput below +
 *                             each binding's validateOutput.
 *   timeout                -> inherited from internalCommandAdapter.
 *   idempotency             -> inherited from executeCapability's
 *                             recordIdempotencyKeyCheck gate (runs BEFORE
 *                             this handler); see documentsAdapter.pg.test.ts's
 *                             "retry" cases for both capabilities.
 *   audit/outbox             -> inherited: executeCapability publishes
 *                             capability.invoked/invocation_failed for every
 *                             call.
 *   ARTIFACT LINK             -> attachArtifactLink() from ./_shared.ts —
 *                             `artifactType: 'document'` / `'presentation'`,
 *                             matching src/utils/artifactLinks.ts's
 *                             `TYP_OBIEKTU_NA_MODUL` map exactly (both are
 *                             already-supported classification keys there).
 *                             The native row is LINKED, never copied.
 *   safe permission check     -> resolveCaseContext() from ./_shared.ts.
 * ============================================================================
 */

import {
  registerCapabilityBinding,
  registerCapabilityWithAdapter,
  type CapabilityExecutionEnvelope,
  type InternalCommandBinding,
} from '../capabilityAdapterService.js';
import type { RegisterCapabilityInput } from '../capabilityRegistryService.js';
import * as artifactLinkService from '../artifactLinkService.js';
import * as caseCoreService from '../caseCoreService.js';
import { queryOne } from '../../../utils/queryHelpers.js';
import {
  getDocumentArtifact,
  materializeDocumentArtifact,
} from '../../documentStudio/documentStudioService.js';
import type {
  DocumentIntake,
  DocumentRunResult,
  DocumentSchema,
  DocumentTypeKey,
} from '../../documentStudio/documentStudioTypes.js';
import { createNativeDeck, type CreateNativeDeckParams } from '../../presentationGeneratorService.js';
import {
  normalizeDeckDocument,
  type DeckDocument,
} from '../../presentationDeckDocumentService.js';
import type { UnifiedReportJSON } from '../../report/pptx/types.js';
import {
  attachArtifactLink,
  requireEnumInput,
  requireNonBlankInput,
  resolveCaseContext,
  resultRefFor,
} from './_shared.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * `src/utils/artifactLinks.ts:274-275` / `:290-291` (`getBasePath`) is the FE's
 * own, single source of truth for these two paths — duplicated here as two
 * literal strings (not logic) purely so the adapter's OUTPUT is directly
 * useful to a caller without a second round trip through artifact-link
 * resolution. If those FE paths ever change, this comment is the pointer to
 * update them here too; this file does not import FE code.
 */
function documentDeepLink(artifactId: string): string {
  return `/wordy?artifactId=${encodeURIComponent(artifactId)}`;
}
function presentationDeepLink(deckId: string): string {
  return `/prezentacje?artifactId=${encodeURIComponent(deckId)}`;
}

/** Total non-structural character count across a document schema's blocks — the "not zero bytes" check. */
function documentContentLength(schema: DocumentSchema): number {
  return schema.sections.reduce((sum, section) => {
    const sectionLen = section.blocks.reduce((blockSum, block) => {
      const serialized = typeof block.content === 'string' ? block.content : JSON.stringify(block.content ?? '');
      return blockSum + serialized.replace(/[^\p{L}\p{N}]/gu, '').length;
    }, 0);
    return sum + sectionLen;
  }, 0);
}

/** Same check for a deck's first (cover) card — the "not a zero-byte deck" guard this file's header documents. */
function deckCoverContentLength(deck: DeckDocument): number {
  const cover = deck.cards[0];
  if (!cover) return 0;
  return cover.blocks.reduce((sum, block) => {
    const serialized = typeof block.content === 'string' ? block.content : JSON.stringify(block.content ?? '');
    return sum + serialized.replace(/[^\p{L}\p{N}]/gu, '').length;
  }, 0);
}

// ===========================================================================
// CAPABILITY 1 — Documents ("case-workspace.documents.document.create")
// ===========================================================================

export const DOCUMENT_CREATE_CAPABILITY_ID = 'case-workspace.documents.document.create';
export const DOCUMENT_CREATE_CAPABILITY_VERSION = '1.0.0';

const DOCUMENT_TYPES = [
  'executive_memo',
  'decision_memo',
  'project_status_report',
  'steering_committee_report',
  'benefits_tracking_report',
  'portfolio_overview',
  'ai_audit_report',
  'interview_summary_report',
  'digital_transformation_roadmap',
  'business_case',
  'sales_proposal',
  'client_discovery_report',
  'workshop_summary',
  'risk_register_report',
  'sop_document',
  'implementation_plan',
  'change_management_plan',
  'board_report',
  'research_report',
  'due_diligence_note',
  'internal_policy_document',
  'client_final_report',
  'generic_document',
] as const satisfies readonly DocumentTypeKey[];

const DOCUMENT_LANGUAGES = ['pl', 'en'] as const;

/** Minimum non-structural character count a persisted document must clear to count as real content, not a near-empty stub. */
const MIN_DOCUMENT_CONTENT_CHARS = 20;

export interface DocumentsAdapterDeps {
  materializeDocumentArtifact?: (
    params: Parameters<typeof materializeDocumentArtifact>[0]
  ) => Promise<DocumentRunResult>;
  getDocumentArtifact?: (artifactId: string, organizationId: string) => Promise<DocumentSchema | null>;
  linkArtifactToCase?: typeof artifactLinkService.linkArtifactToCase;
}

export function buildDocumentCreateBinding(deps: DocumentsAdapterDeps = {}): InternalCommandBinding {
  const materialize = deps.materializeDocumentArtifact ?? materializeDocumentArtifact;
  const read = deps.getDocumentArtifact ?? getDocumentArtifact;

  return {
    kind: 'INTERNAL',
    timeoutMs: 15_000,
    async handler(payload: Record<string, unknown>, envelope: CapabilityExecutionEnvelope) {
      const caseId = requireNonBlankInput(payload.caseId, 'case_id');
      const description = requireNonBlankInput(payload.description, 'description');
      const title = readOptionalString(payload.title);
      const documentType =
        payload.documentType === undefined || payload.documentType === null
          ? 'generic_document'
          : requireEnumInput(payload.documentType, DOCUMENT_TYPES, 'document_type');
      const language =
        payload.language === undefined || payload.language === null
          ? 'pl'
          : requireEnumInput(payload.language, DOCUMENT_LANGUAGES, 'language');

      // Case existence, actor standing, AND envelope-org/Case-org agreement
      // — see resolveCaseContext's own doc for why all three matter.
      const caseContext = await resolveCaseContext(caseId, envelope);

      const intake: DocumentIntake = {
        title,
        description,
        documentType,
        language,
      };

      // No try/catch mapping to CAPABILITY_INPUT_INVALID here, deliberately:
      // every synchronous input-validation guard `materializeDocumentArtifact`
      // has (bad templateId, missing required template sources) is
      // UNREACHABLE through this adapter's payload, because this adapter
      // never forwards a templateId. The ONE throw that IS reachable here —
      // "wave5_artifacts write did not succeed" (documentStudioService.ts's
      // own MAT-010 guard) — is a genuine internal failure, not a caller
      // mistake, and must surface as CAPABILITY_INTERNAL_ERROR. Letting it
      // propagate as a plain Error achieves exactly that (see
      // internalCommandAdapter's catch in capabilityAdapterService.ts).
      const materializeResult = await materialize({
        organizationId: caseContext.organizationId,
        userId: envelope.actor.actorId,
        intake,
        projectId: caseContext.projectId || undefined,
        useLlm: false,
      });

      // SECOND, INDEPENDENT readback — deliberately not trusting
      // materializeResult.schema on faith even though documentStudioService.ts
      // already re-reads internally (defense in depth, and this adapter's own
      // proof obligation per the task brief: "your readback must assert on
      // actual CONTENT, not just existence").
      const readback = await read(materializeResult.artifactId, caseContext.organizationId);
      if (!readback) {
        throw new Error('document_create_not_persisted');
      }
      if (documentContentLength(readback) < MIN_DOCUMENT_CONTENT_CHARS) {
        // The exact "zero-byte artifact reported as created" failure mode
        // this program's own history warns about — refuse to call it a
        // success.
        throw new Error('document_create_content_empty');
      }

      const artifactLink = await attachArtifactLink({
        envelope,
        caseId: caseContext.caseId,
        artifactType: 'document',
        artifactId: readback.artifactId,
        relation: 'OUTPUT',
        linkArtifactToCase: deps.linkArtifactToCase,
      });

      return {
        output: {
          artifactId: readback.artifactId,
          organizationId: caseContext.organizationId,
          projectId: caseContext.projectId || null,
          title: readback.title,
          documentType: readback.documentType,
          language: readback.language,
          status: readback.documentStatus ?? 'draft',
          deepLink: documentDeepLink(readback.artifactId),
          artifactLink,
        },
        resultRef: resultRefFor('document', readback.artifactId),
      };
    },
    validateOutput: (output) =>
      typeof output.artifactId === 'string' &&
      output.artifactId.length > 0 &&
      typeof output.title === 'string' &&
      output.title.length > 0,
  };
}

/** Bind (or re-bind) the ALREADY-registered capability — used at process boot. */
export function registerDocumentCreateAdapterBinding(deps: DocumentsAdapterDeps = {}): void {
  registerCapabilityBinding(
    DOCUMENT_CREATE_CAPABILITY_ID,
    DOCUMENT_CREATE_CAPABILITY_VERSION,
    buildDocumentCreateBinding(deps)
  );
}

/** The registry row this capability registers as, per doc 05 §5's CapabilityDefinition. */
export function documentCreateRegistrationInput(createdByActorId: string): RegisterCapabilityInput {
  return {
    capabilityId: DOCUMENT_CREATE_CAPABILITY_ID,
    capabilityVersion: DOCUMENT_CREATE_CAPABILITY_VERSION,
    ownerModule: 'documents',
    providerType: 'INTERNAL',
    operation: 'materializeDocumentArtifact',
    owningCommandRef: 'command:documents.document.create',
    inputSchemaRef: 'schema:case-workspace.documents.document.create.input@1',
    outputSchemaRef: 'schema:case-workspace.documents.document.create.output@1',
    operationClass: 'MUTATE',
    effectClass: 'SAFE_ADDITIVE',
    dataClassification: 'INTERNAL',
    idempotencyStrategy: 'CLIENT_KEY',
    // No hard-delete exists for a wave5_artifacts row through this adapter's
    // own surface (lifecycle is status-mutable via documentLifecycleService).
    reversibility: 'REVERSIBLE_VIA_STATUS_CHANGE',
    approvalRecommendation: 'auto_executable',
    timeoutDefaults: { defaultMs: 15_000 },
    lifecycle: 'ACTIVE',
    health: 'HEALTHY',
    createdByActorId,
  };
}

/** Registers BOTH the registry row and the binding in one call. */
export async function registerDocumentCreateCapability(params: {
  createdByActorId: string;
  callerOrganizationId: string;
  deps?: DocumentsAdapterDeps;
}) {
  return registerCapabilityWithAdapter(
    documentCreateRegistrationInput(params.createdByActorId),
    buildDocumentCreateBinding(params.deps),
    params.callerOrganizationId
  );
}

// ===========================================================================
// CAPABILITY 2 — Presentation ("case-workspace.presentation.deck.create")
// ===========================================================================

export const PRESENTATION_CREATE_CAPABILITY_ID = 'case-workspace.presentation.deck.create';
export const PRESENTATION_CREATE_CAPABILITY_VERSION = '1.0.0';

const PRESENTATION_LANGUAGES = ['en', 'pl'] as const;
const PRESENTATION_CONFIDENTIALITY = ['confidential', 'internal', 'public'] as const;
const PRESENTATION_THEMES = ['corporate', 'minimal', 'modern'] as const;

/** Minimum non-structural character count a persisted deck's cover card must clear — see this file's header on the zero-byte-deck defect. */
const MIN_DECK_CONTENT_CHARS = 8;

/** The columns this adapter's own readback needs from `presentation_decks` — no exported "getNativeDeck" exists (see this file's header). */
interface PresentationDeckRow {
  id: string;
  organization_id: string;
  title: string;
  status: string;
  slide_count: number;
  deck_json: string | null;
  unified_json: string | null;
  theme: string | null;
  language: string | null;
  confidentiality: string | null;
}

export interface PresentationAdapterDeps {
  createNativeDeck?: (params: CreateNativeDeckParams) => ReturnType<typeof createNativeDeck>;
  readDeckRow?: (deckId: string, organizationId: string) => Promise<PresentationDeckRow | null>;
  getCase?: typeof caseCoreService.getCase;
  linkArtifactToCase?: typeof artifactLinkService.linkArtifactToCase;
}

async function defaultReadDeckRow(deckId: string, organizationId: string): Promise<PresentationDeckRow | null> {
  // No exported "getNativeDeck" exists anywhere in this codebase (see this
  // file's header) — every route in presentations.routes.ts that reads a
  // deck back does this SAME inline SELECT. Reusing that established shape
  // rather than inventing a new one.
  return queryOne<PresentationDeckRow>(
    `SELECT id, organization_id, title, status, slide_count, deck_json, unified_json,
            theme, language, confidentiality
       FROM presentation_decks
      WHERE id = ? AND organization_id = ?`,
    [deckId, organizationId]
  );
}

export function buildPresentationCreateBinding(deps: PresentationAdapterDeps = {}): InternalCommandBinding {
  const create = deps.createNativeDeck ?? createNativeDeck;
  const readRow = deps.readDeckRow ?? defaultReadDeckRow;
  const getCase = deps.getCase ?? caseCoreService.getCase;

  return {
    kind: 'INTERNAL',
    timeoutMs: 15_000,
    async handler(payload: Record<string, unknown>, envelope: CapabilityExecutionEnvelope) {
      const caseId = requireNonBlankInput(payload.caseId, 'case_id');
      const title = requireNonBlankInput(payload.title, 'title');
      const subtitle = readOptionalString(payload.subtitle);
      const language =
        payload.language === undefined || payload.language === null
          ? 'pl'
          : requireEnumInput(payload.language, PRESENTATION_LANGUAGES, 'language');
      const confidentiality =
        payload.confidentiality === undefined || payload.confidentiality === null
          ? 'confidential'
          : requireEnumInput(payload.confidentiality, PRESENTATION_CONFIDENTIALITY, 'confidentiality');
      const theme =
        payload.theme === undefined || payload.theme === null
          ? 'corporate'
          : requireEnumInput(payload.theme, PRESENTATION_THEMES, 'theme');

      // Case existence, actor standing, AND envelope-org/Case-org agreement
      // — see resolveCaseContext's own doc for why all three matter.
      const caseContext = await resolveCaseContext(caseId, envelope);

      // A second, independent read of the Case (resolveCaseContext already
      // did one internally but does not expose caseName) — purely to ground
      // the cover slide's `organization`/`project` fields in the Case's own
      // real name instead of inventing placeholder text.
      const caseView = await getCase({ caseId: caseContext.caseId }, envelope.actor.actorId);
      const caseName = caseView?.caseName?.trim() || caseContext.caseId;

      const nowIso = new Date().toISOString();
      const unifiedJson: UnifiedReportJSON = {
        meta: {
          client: caseView?.projectName?.trim() || caseName,
          project: caseName,
          date: nowIso,
          author: envelope.actor.actorId,
          confidentiality,
          language,
          template: theme,
        },
        slides: [
          {
            intent: 'cover',
            key_message: title,
            content: {
              type: 'cover',
              title,
              subtitle,
              organization: caseView?.projectName?.trim() || caseName,
              date: nowIso,
              confidentiality,
            },
          },
        ],
      };

      // No try/catch mapping to CAPABILITY_INPUT_INVALID here: createNativeDeck's
      // own synchronous guards (missing organizationId, empty slides) are both
      // unreachable through this construction (organizationId always comes
      // from the verified caseContext; slides always has exactly one entry).
      // The one throw that IS reachable — `native_deck_artifact_registration_failed`
      // — is a genuine internal failure (a downstream registry write failed),
      // never a caller mistake; letting it propagate as a plain Error surfaces
      // it as CAPABILITY_INTERNAL_ERROR, correctly.
      const created = await create({
        organizationId: caseContext.organizationId,
        title,
        unifiedJson,
        sourceType: 'case_workspace',
        sourceId: caseContext.caseId,
        createdBy: envelope.actor.actorId,
        createdAt: nowIso,
        theme,
        language,
        confidentiality,
        status: 'ready',
        projectId: caseContext.projectId || null,
      });

      if (!created.registryArtifactId) {
        // createNativeDeck itself already throws when this is null — kept as
        // a second, explicit guard rather than relying solely on that
        // upstream behaviour not changing silently.
        throw new Error('presentation_deck_create_registry_receipt_missing');
      }

      // *** THE LOAD-BEARING GUARD ***. createNativeDeck's own INSERT into
      // `presentation_decks` has NO internal re-read defense (see this file's
      // header) — unlike wave5/Finance, a silently swallowed INSERT failure
      // here would otherwise return a completely normal-looking `created`
      // value for a deck that was never written. This is the ENTIRE defense.
      const row = await readRow(created.deckId, caseContext.organizationId);
      if (!row) {
        throw new Error('presentation_deck_create_not_persisted');
      }
      const deck = normalizeDeckDocument(row);
      if (!deck) {
        throw new Error('presentation_deck_create_unreadable');
      }
      if (deckCoverContentLength(deck) < MIN_DECK_CONTENT_CHARS) {
        // The exact "deck marked ready with zero bytes of content" failure
        // mode this program's own history warns about — refuse to call it a
        // success.
        throw new Error('presentation_deck_create_content_empty');
      }

      const artifactLink = await attachArtifactLink({
        envelope,
        caseId: caseContext.caseId,
        artifactType: 'presentation',
        artifactId: created.deckId,
        relation: 'OUTPUT',
        linkArtifactToCase: deps.linkArtifactToCase,
      });

      return {
        output: {
          deckId: created.deckId,
          organizationId: caseContext.organizationId,
          projectId: caseContext.projectId || null,
          title: deck.title,
          status: row.status,
          slideCount: created.slideCount,
          deepLink: presentationDeepLink(created.deckId),
          artifactLink,
        },
        resultRef: resultRefFor('presentation', created.deckId),
      };
    },
    validateOutput: (output) =>
      typeof output.deckId === 'string' &&
      output.deckId.length > 0 &&
      typeof output.status === 'string',
  };
}

/** Bind (or re-bind) the ALREADY-registered capability — used at process boot. */
export function registerPresentationCreateAdapterBinding(deps: PresentationAdapterDeps = {}): void {
  registerCapabilityBinding(
    PRESENTATION_CREATE_CAPABILITY_ID,
    PRESENTATION_CREATE_CAPABILITY_VERSION,
    buildPresentationCreateBinding(deps)
  );
}

/** The registry row this capability registers as, per doc 05 §5's CapabilityDefinition. */
export function presentationCreateRegistrationInput(createdByActorId: string): RegisterCapabilityInput {
  return {
    capabilityId: PRESENTATION_CREATE_CAPABILITY_ID,
    capabilityVersion: PRESENTATION_CREATE_CAPABILITY_VERSION,
    ownerModule: 'presentation',
    providerType: 'INTERNAL',
    operation: 'createNativeDeck',
    owningCommandRef: 'command:presentation.deck.create',
    inputSchemaRef: 'schema:case-workspace.presentation.deck.create.input@1',
    outputSchemaRef: 'schema:case-workspace.presentation.deck.create.output@1',
    operationClass: 'MUTATE',
    effectClass: 'SAFE_ADDITIVE',
    dataClassification: 'INTERNAL',
    idempotencyStrategy: 'CLIENT_KEY',
    // No delete exists through this adapter's surface; status is mutable
    // (draft/generating/ready/exported/failed per the DB CHECK constraint).
    reversibility: 'REVERSIBLE_VIA_STATUS_CHANGE',
    approvalRecommendation: 'auto_executable',
    timeoutDefaults: { defaultMs: 15_000 },
    lifecycle: 'ACTIVE',
    health: 'HEALTHY',
    createdByActorId,
  };
}

/** Registers BOTH the registry row and the binding in one call. */
export async function registerPresentationCreateCapability(params: {
  createdByActorId: string;
  callerOrganizationId: string;
  deps?: PresentationAdapterDeps;
}) {
  return registerCapabilityWithAdapter(
    presentationCreateRegistrationInput(params.createdByActorId),
    buildPresentationCreateBinding(params.deps),
    params.callerOrganizationId
  );
}

// ===========================================================================
// Combined boot helper — for adapters/index.ts (see this packet's final
// report for the exact import + registration lines to add there; index.ts is
// out of this packet's allowlist).
// ===========================================================================

/** Registers both Golden Cases this file owns, under one platform-admin actor/org. */
export async function registerDocumentsAndPresentationCapabilities(params: {
  createdByActorId: string;
  callerOrganizationId: string;
}): Promise<void> {
  await registerDocumentCreateCapability(params);
  await registerPresentationCreateCapability(params);
}

/** Re-exported for tests/callers that want a readback without importing documentStudioService directly. */
export { getDocumentArtifact };
