/**
 * Case Workspace — Assessment capability adapter (Strumień C / packet D1a).
 *
 * ============================================================================
 * INVESTIGATION — what "the real Assessment API" actually is (do this once,
 * do not re-walk it — see decisionAdapter.ts/financeAdapter.ts's own headers
 * for the same convention on their modules)
 * ============================================================================
 *
 * Unlike Decision (`decisionService.createDecision/getDecision`) and Finance
 * (`financialModelingService.createModel/getModel`), Assessment has NO
 * dedicated service module exporting a plain create+read function pair.
 * There are, in fact, TWO parallel HTTP entry points that each inline their
 * own SQL directly into the route/controller handler instead of delegating to
 * one:
 *
 *   1. `server/src/routes/v8/assessment.routes.ts` — `POST /` (create,
 *      lines 428-566) and `GET /:assessmentId` (read, lines 366-426). This
 *      router's own header calls itself "V8 bounded Assessment bridge...
 *      currently suffer[ing] from legacy split-brain wiring" (routes/v8/
 *      assessment.routes.ts:1-5) — i.e. it is the intended CURRENT/canonical
 *      surface, not a leftover.
 *   2. `server/src/controllers/AssessmentController.ts` —
 *      `static createAssessment` (line 664) / `static getAssessment`
 *      (~line 771), the older, still-mounted legacy controller the v8 router
 *      was written to bridge away from.
 *
 * Both write/read the SAME `assessments` table (schema owned by
 * `ensureAssessmentSchema`, AssessmentController.ts:301 — an idempotent
 * `CREATE TABLE IF NOT EXISTS` + `ADD COLUMN IF NOT EXISTS` guard that is
 * itself the schema's only "migration", called by every handler in both
 * files before touching the table). This adapter treats the v8 router as the
 * real, current API (per that router's own stated purpose) and gives it a
 * genuine INTERNAL capability binding — but since v8's `POST /` and
 * `GET /:assessmentId` are Express route handlers, not exported functions,
 * there is nothing importable to "wrap" the way decisionAdapter/financeAdapter
 * wrap a service call. What this adapter imports instead are the two REAL,
 * exported, non-route-local pieces the v8 route itself depends on for the
 * same job — `ensureAssessmentSchema`/`normalizeStatus`
 * (AssessmentController.ts:301,77) and `queryHelpers` (utils/queryHelpers.ts)
 * — and performs the IDENTICAL insert/select the route performs (same table,
 * same columns, same schema-init call), so the row this adapter creates is a
 * real `assessments` row, indistinguishable from one created through the HTTP
 * route, addressable by every other Assessment surface (UI, workbench,
 * review flow, `/report`, `/candidate` handoff, ...). This is the same "link
 * the native object, never copy it" mandate the other adapters implement —
 * there is no Case-owned duplicate table involved, only a real row in the
 * one `assessments` table every Assessment surface reads.
 *
 * NOT wrapped, and deliberately out of this capability's scope (a future
 * packet's job, not invented here): `assessment_definitions` binding
 * (definitionId/definitionVersion — routes/v8/assessment.routes.ts:462-504),
 * the P28 workbench state machine (`AssessmentWorkbenchService`), quality
 * review/accept-output (`drdQualityReview.ts`), and the
 * accepted-output -> Candidate handoff (`drdCandidateHandoff.ts`). Those are
 * real, but each is its own multi-step workflow layered ON TOP of a plain
 * assessment row, not a "create" shape — same reasoning financeAdapter.ts's
 * header used to reject the Finance candidate-handoff service for this slot.
 *
 * ============================================================================
 * A SECOND, ASSESSMENT-SPECIFIC PERMISSION GATE — replicated, not invented
 * ============================================================================
 * `resolveCaseContext()` (./_shared.ts) already proves the actor has standing
 * on the Case and that the envelope's claimed org matches the Case's real
 * org. That is NOT the same check the real `POST /` route makes before
 * writing: routes/v8/assessment.routes.ts:126-192 documents a SEPARATE,
 * fail-closed, Assessment-specific RBAC gate (`canCreateOrEditAssessment`,
 * checked at line 436) — an org member with a read-only role (VIEWER/GUEST/
 * CLIENT/READONLY/OBSERVER/STAKEHOLDER) has full standing on the Case yet is
 * STILL refused create/edit on an Assessment. `canCreateOrEditAssessment`
 * itself is a route-local, unexported function, so it cannot be imported;
 * `ASSESSMENT_READ_ONLY_ORG_ROLES`/`ASSESSMENT_CREATE_CAPABLE_ORG_ROLES`
 * below are a byte-for-byte copy of routes/v8/assessment.routes.ts:152-177,
 * looked up via `organizationService.getMemberRole` (organizationService.ts:
 * 537, the same exported, real function `chatPermissionService.ts` and
 * others already use for this exact "what is this actor's org role" job).
 * Skipping this gate would let any Case-standing actor create Assessments
 * regardless of their org role — a real authorization gap this adapter must
 * not introduce just because it dispatches from inside Case Workspace
 * instead of from an HTTP request.
 *
 * ============================================================================
 * THE "DbPromise SWALLOWS ERRORS" TRAP — checked against THIS write path,
 * defended against anyway
 * ============================================================================
 * financialModelingService.createModel (wrapped by financeAdapter.ts) writes
 * through `utils/DbPromise.js`'s `run()`, whose documented default
 * `fallback = true` turns a genuine SQL error into a resolved
 * `{ success: false }` instead of a rejection — so a caller who only checks
 * "did createModel throw" never learns the write failed.
 * `queryHelpers.queryRun` (utils/queryHelpers.ts) — what the real Assessment
 * routes and this adapter both use — is a DIFFERENT wrapper: read its
 * `run` callback (queryHelpers.ts, the callback passed to
 * `getDatabase().run`) — `if (err) reject(err)`, unconditionally, no
 * `fallback` option. Traced one level deeper, `PostgresDatabase.run`
 * (database/PostgresDatabase.ts:1223-1267) also does not swallow: its own
 * `.catch` branch calls `callback(err)` (never resolves a
 * `{ success: false }` object down the callback path queryHelpers uses), so
 * `queryHelpers.queryRun` genuinely rejects on a real Postgres error. This
 * write path does NOT currently carry the DbPromise defect.
 *
 * That said, this adapter still applies the SAME defense financeAdapter.ts
 * does — re-reading the row via the module's own read path immediately after
 * the write, and treating a miss as `CAPABILITY_INTERNAL_ERROR` rather than a
 * trusted, pre-generated id — for two reasons: (1) belt-and-braces against a
 * FUTURE refactor of this write path onto DbPromise (which several sibling
 * services in this codebase have hit — see this file's own git history
 * elsewhere for "DbPromise połyka błędy" class defects), and (2) it is the
 * only way to build the capability's real output (the insert helper below
 * only returns the bare id, exactly like `createModel`). See
 * `assessmentAdapter.pg.test.ts`'s dedicated negative-control test, which
 * proves this guard actually fires: it injects a `createAssessment`
 * dependency that returns a plausible id WITHOUT writing anything (the same
 * observable shape DbPromise's fallback-swallow produces), and asserts this
 * adapter surfaces `CAPABILITY_INTERNAL_ERROR` instead of a false
 * `SUCCEEDED`. A genuine SQL-level negative control (the "malformed
 * start_date" trick financeAdapter.pg.test.ts uses) is not available here —
 * `ensureAssessmentSchema`'s ad hoc DDL (AssessmentController.ts:313-334)
 * declares every `assessments` column as bare `TEXT`/`INTEGER`/`REAL` with no
 * `FOREIGN KEY`/`CHECK` constraints on the columns this adapter writes, so
 * there is no real Postgres-level rejection this adapter's own input
 * validation does not already prevent — a schema-hygiene gap, not something
 * to fake a failure around.
 *
 * doc 05 §5 checklist, same distribution financeAdapter.ts/decisionAdapter.ts
 * use:
 *   input contract     -> ASSESSMENT_TYPES / requireNonBlankInput/
 *                         requireEnumInput below (CAPABILITY_INPUT_INVALID).
 *   output contract    -> validateOutput on the returned binding.
 *   timeout            -> inherited from internalCommandAdapter (binding.
 *                         timeoutMs below; no I/O beyond in-process DB calls).
 *   idempotency        -> inherited from executeCapability's own
 *                         recordIdempotencyKeyCheck gate (runs before this
 *                         handler is ever invoked) — see
 *                         assessmentAdapter.pg.test.ts's "retry" case.
 *   audit/outbox       -> inherited: executeCapability publishes
 *                         capability.invoked/invocation_failed for every call;
 *                         this file adds nothing on top (same as every other
 *                         adapter in this directory).
 *   error mapping      -> CapabilityHandlerError throws map bad input, the
 *                         Assessment RBAC gate, and case-tenancy mismatches to
 *                         precise taxonomy codes; anything else collapses to
 *                         CAPABILITY_INTERNAL_ERROR (capabilityAdapterService.
 *                         ts's own documented catch-all).
 *   ARTIFACT LINK       -> attachArtifactLink() from ./_shared.ts; the
 *                         `assessments` row is the ONLY place its content
 *                         lives — never copied into a Case-owned table.
 *   safe permission check -> resolveCaseContext() (Case standing + tenancy)
 *                         PLUS the Assessment-specific RBAC gate documented
 *                         above (module-level, not just Case-level).
 */

import { v4 as uuidv4 } from 'uuid';

import {
  CapabilityHandlerError,
  registerCapabilityBinding,
  registerCapabilityWithAdapter,
  type CapabilityExecutionEnvelope,
  type InternalCommandBinding,
} from '../capabilityAdapterService.js';
import type { RegisterCapabilityInput } from '../capabilityRegistryService.js';
import * as artifactLinkService from '../artifactLinkService.js';
import { ensureAssessmentSchema, normalizeStatus } from '../../../controllers/AssessmentController.js';
import { getMemberRole } from '../../../services/organizationService.js';
import * as queryHelpers from '../../../utils/queryHelpers.js';
import {
  attachArtifactLink,
  requireEnumInput,
  requireNonBlankInput,
  resolveCaseContext,
  resultRefFor,
} from './_shared.js';

export const ASSESSMENT_CREATE_CAPABILITY_ID = 'case-workspace.assessment.create';
export const ASSESSMENT_CREATE_CAPABILITY_VERSION = '1.0.0';

const ASSESSMENT_TYPES = ['DRD', 'SIRI', 'ADMA', 'CMMI', 'LEAN'] as const;

// Byte-for-byte copy of routes/v8/assessment.routes.ts:152-177 — see this
// file's header ("A SECOND, ASSESSMENT-SPECIFIC PERMISSION GATE") for why
// this cannot be imported and must be kept in lockstep with that file
// instead.
const ASSESSMENT_READ_ONLY_ORG_ROLES = new Set([
  'VIEWER',
  'GUEST',
  'CLIENT',
  'READONLY',
  'READ_ONLY',
  'OBSERVER',
  'STAKEHOLDER',
]);

const ASSESSMENT_CREATE_CAPABLE_ORG_ROLES = new Set([
  'OWNER',
  'ADMIN',
  'ADMINISTRATOR',
  'SUPERADMIN',
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'USER',
  'MEMBER',
  'TEAM_MEMBER',
  'PROJECT_MANAGER',
  'MANAGER',
  'CONSULTANT',
  'SME',
  'REVIEWER',
]);

/** Mirrors routes/v8/assessment.routes.ts:185-192's canCreateOrEditAssessment exactly. */
function canCreateOrEditAssessment(role: string | null | undefined): boolean {
  const normalized = String(role || '')
    .trim()
    .toUpperCase();
  if (!normalized) return false;
  if (ASSESSMENT_READ_ONLY_ORG_ROLES.has(normalized)) return false;
  return ASSESSMENT_CREATE_CAPABLE_ORG_ROLES.has(normalized);
}

/** What this adapter reads a created assessment back as — mirrors the SELECT * shape routes/v8/assessment.routes.ts:379-382 reads, narrowed to the columns this capability's output/tests care about. */
export interface AssessmentReadback {
  id: string;
  organization_id: string;
  project_id: string | null;
  assessment_type: string;
  name: string;
  status: string;
  completion_percent: number | null;
  confidence_avg: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface InsertAssessmentInput {
  organizationId: string;
  projectId?: string;
  assessmentType: (typeof ASSESSMENT_TYPES)[number];
  name: string;
  createdBy: string;
}

/**
 * The real write — mirrors routes/v8/assessment.routes.ts:511-541's INSERT
 * INTO assessments + INSERT INTO assessment_sessions exactly (same columns,
 * same DRAFT/0/0/'{}'/'{}' initial values, same session-per-actor row the
 * route creates "for dynamic submenu" per AssessmentController.ts:445). Not
 * wrapped in a try/catch that reclassifies failures as caller-input errors
 * (unlike financeAdapter.ts's `create()` call) — every input has already
 * been validated above this point, so a genuine throw here is this
 * capability's own bug, correctly left to fall through to the default
 * CAPABILITY_INTERNAL_ERROR classification.
 */
async function insertAssessment(input: InsertAssessmentInput): Promise<string> {
  await ensureAssessmentSchema();
  const id = uuidv4();
  const now = new Date().toISOString();

  await queryHelpers.queryRun(
    `INSERT INTO assessments (
      id, organization_id, project_id, assessment_type, name, status,
      completion_percent, confidence_avg, answers_json, context_snapshot,
      assessment_definition_id, assessment_definition_version,
      created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.organizationId,
      input.projectId ?? null,
      input.assessmentType,
      input.name,
      'DRAFT',
      0,
      0,
      '{}',
      '{}',
      null,
      null,
      input.createdBy,
      input.createdBy,
      now,
      now,
    ]
  );

  await queryHelpers.queryRun(
    `INSERT INTO assessment_sessions (id, assessment_id, user_id, opened_at) VALUES (?, ?, ?, ?)`,
    [uuidv4(), id, input.createdBy, now]
  );

  return id;
}

/** The real read — mirrors routes/v8/assessment.routes.ts:379-382's org-scoped SELECT exactly. */
export async function getAssessmentReadback(
  assessmentId: string,
  organizationId: string
): Promise<AssessmentReadback | null> {
  await ensureAssessmentSchema();
  const row = await queryHelpers.queryOne<AssessmentReadback>(
    `SELECT id, organization_id, project_id, assessment_type, name, status,
            completion_percent, confidence_avg, created_by, created_at, updated_at
       FROM assessments WHERE id = ? AND organization_id = ?`,
    [assessmentId, organizationId]
  );
  return row ?? null;
}

export interface AssessmentAdapterDeps {
  createAssessment?: (input: InsertAssessmentInput) => Promise<string>;
  getAssessment?: (assessmentId: string, organizationId: string) => Promise<AssessmentReadback | null>;
  getMemberRole?: (organizationId: string, userId: string) => Promise<string | null>;
  linkArtifactToCase?: typeof artifactLinkService.linkArtifactToCase;
}

export function buildAssessmentCreateBinding(deps: AssessmentAdapterDeps = {}): InternalCommandBinding {
  const create = deps.createAssessment ?? insertAssessment;
  const read = deps.getAssessment ?? getAssessmentReadback;
  const readRole = deps.getMemberRole ?? getMemberRole;

  return {
    kind: 'INTERNAL',
    // Higher than decisionAdapter.ts/financeAdapter.ts's 10_000ms budget —
    // measured against a real Postgres, NOT a guess. `ensureAssessmentSchema`
    // (AssessmentController.ts:301, called on every insert/read here, exactly
    // as every real Assessment route also calls it on every request) is NOT
    // memoized: it re-issues ~20 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
    // statements on EVERY call, not just the first. Under this program's
    // shared, concurrently-written test database, those statements were
    // observed taking 1-3s EACH (`[Postgres] SLOW QUERY (...ms) [RUN]: ALTER
    // TABLE assessments ADD COLUMN IF NOT EXISTS ...`), enough to blow a
    // 10_000ms budget on a single capability call and turn a real, successful
    // write into a false CAPABILITY_TIMEOUT. This is a genuine, pre-existing
    // Assessment-module cost this adapter did not create (every real HTTP
    // route pays the identical tax on every request) — flagged as a finding
    // in this packet's final report, not silently worked around by skipping
    // the real schema-init call the production routes themselves rely on.
    timeoutMs: 30_000,
    async handler(payload: Record<string, unknown>, envelope: CapabilityExecutionEnvelope) {
      const caseId = requireNonBlankInput(payload.caseId, 'case_id');
      const assessmentType = requireEnumInput(payload.assessmentType, ASSESSMENT_TYPES, 'assessment_type');
      const name = requireNonBlankInput(payload.name, 'name');

      // Case existence, actor standing, AND envelope-org/Case-org agreement
      // — see resolveCaseContext's own doc for why all three matter.
      const caseContext = await resolveCaseContext(caseId, envelope);

      // Assessment-specific RBAC — see this file's header ("A SECOND,
      // ASSESSMENT-SPECIFIC PERMISSION GATE"). Case standing alone is not
      // enough; a read-only org role must be refused here exactly as the
      // real POST /assessments route refuses it.
      const actorRole = await readRole(caseContext.organizationId, envelope.actor.actorId);
      if (!canCreateOrEditAssessment(actorRole)) {
        throw new CapabilityHandlerError('CAPABILITY_UNAUTHORIZED', 'assessment_role_not_create_capable');
      }

      const assessmentId = await create({
        organizationId: caseContext.organizationId,
        projectId: caseContext.projectId || undefined,
        assessmentType,
        name,
        createdBy: envelope.actor.actorId,
      });

      // Re-read via the module's OWN read path — both to build this
      // capability's real output (the insert helper returns only the bare
      // id) and, load-bearing, the guard documented in this file's header: a
      // "successful" write that persisted nothing must never be reported as
      // SUCCEEDED.
      const assessment = await read(assessmentId, caseContext.organizationId);
      if (!assessment) {
        throw new Error('assessment_create_not_persisted');
      }

      const artifactLink = await attachArtifactLink({
        envelope,
        caseId: caseContext.caseId,
        artifactType: 'assessment',
        artifactId: assessment.id,
        relation: 'OUTPUT',
        linkArtifactToCase: deps.linkArtifactToCase,
      });

      return {
        output: {
          assessmentId: assessment.id,
          organizationId: assessment.organization_id,
          projectId: assessment.project_id ?? null,
          assessmentType: assessment.assessment_type,
          name: assessment.name,
          status: normalizeStatus(assessment.status),
          backendStatus: assessment.status,
          artifactLink,
        },
        resultRef: resultRefFor('assessment', assessment.id),
      };
    },
    validateOutput: (output) =>
      typeof output.assessmentId === 'string' &&
      output.assessmentId.length > 0 &&
      typeof output.status === 'string',
  };
}

/** Bind (or re-bind) the ALREADY-registered capability — used at process boot. */
export function registerAssessmentCreateAdapterBinding(deps: AssessmentAdapterDeps = {}): void {
  registerCapabilityBinding(
    ASSESSMENT_CREATE_CAPABILITY_ID,
    ASSESSMENT_CREATE_CAPABILITY_VERSION,
    buildAssessmentCreateBinding(deps)
  );
}

/** The registry row this capability registers as, per doc 05 §5's CapabilityDefinition. */
export function assessmentCreateRegistrationInput(createdByActorId: string): RegisterCapabilityInput {
  return {
    capabilityId: ASSESSMENT_CREATE_CAPABILITY_ID,
    capabilityVersion: ASSESSMENT_CREATE_CAPABILITY_VERSION,
    ownerModule: 'assessment',
    providerType: 'INTERNAL',
    operation: 'createAssessment',
    owningCommandRef: 'command:assessment.create',
    inputSchemaRef: 'schema:case-workspace.assessment.create.input@1',
    outputSchemaRef: 'schema:case-workspace.assessment.create.output@1',
    operationClass: 'MUTATE',
    effectClass: 'SAFE_ADDITIVE',
    dataClassification: 'INTERNAL',
    idempotencyStrategy: 'CLIENT_KEY',
    // No hard-delete exists for assessments (only status transitions —
    // DRAFT -> IN_REVIEW/AWAITING_APPROVAL -> APPROVED, with an explicit
    // reviewer "return" transition back to DRAFT per drdQualityReview.ts /
    // routes/v8/assessment.routes.ts:694-712's own comment), so
    // "reversible" here means status-mutable, never hard-deletable — same
    // reasoning financeAdapter.ts uses for financial_models.
    reversibility: 'REVERSIBLE_VIA_STATUS_CHANGE',
    approvalRecommendation: 'auto_executable',
    // Kept in lockstep with buildAssessmentCreateBinding's own timeoutMs —
    // see that binding's comment for why this is 30_000, not the 10_000
    // decisionAdapter.ts/financeAdapter.ts use.
    timeoutDefaults: { defaultMs: 30_000 },
    lifecycle: 'ACTIVE',
    health: 'HEALTHY',
    createdByActorId,
  };
}

/** Registers BOTH the registry row and the binding in one call — see capabilityAdapterService.registerCapabilityWithAdapter's own doc for why coupling them matters. */
export async function registerAssessmentCreateCapability(params: {
  createdByActorId: string;
  callerOrganizationId: string;
  deps?: AssessmentAdapterDeps;
}) {
  return registerCapabilityWithAdapter(
    assessmentCreateRegistrationInput(params.createdByActorId),
    buildAssessmentCreateBinding(params.deps),
    params.callerOrganizationId
  );
}
