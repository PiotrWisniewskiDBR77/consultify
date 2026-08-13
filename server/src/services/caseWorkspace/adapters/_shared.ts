/**
 * Case Workspace — shared support for MODULE CAPABILITY ADAPTERS
 * (server/src/services/caseWorkspace/adapters/**).
 *
 * doc 05 §5 ("Adapter and module ownership contract") describes SIX transport
 * kinds (InternalCommand/MCP/HttpApi/Connector/Agent/LegacyTool);
 * capabilityAdapterService.ts already implements the generic INTERNAL and
 * HTTP_API dispatch, taxonomy, timeout and idempotency machinery. What was
 * still missing — the actual point of "Strumień C" — is REAL adapters that
 * dispatch into native modules (Decision/Initiative/KPI/...) rather than a
 * capability row with schema and no executable behind it.
 *
 * Every module adapter in this directory follows the SAME four-step shape,
 * factored here once instead of copied three times:
 *
 *   1. resolveCaseContext()  — the Case named in the payload is real, the
 *      actor may touch it, AND the envelope's own claimed organizationId
 *      agrees with the Case's actual tenant (§5 "safe permission checks" —
 *      see the doc comment on resolveCaseContext for why this is a SEPARATE
 *      check from requireCaseAccess, not a duplicate of it).
 *   2. dispatch into the native module's OWN service, passing the Case's
 *      REAL organizationId (never the envelope's unchecked one) — the module
 *      write is the capability's actual business effect.
 *   3. attachArtifactLink() — a best-effort, late-binding
 *      `case_workspace_artifact_links` row pointing AT the module object.
 *      "ARTIFACT LINK zamiast kopiowania" (mandate): the module object is
 *      never copied into a Case-owned table, only referenced. This step is
 *      explicitly ALLOWED TO FAIL WITHOUT FAILING THE WHOLE CAPABILITY — see
 *      that function's own doc comment for the partial-failure contract this
 *      implements, and why swallowing it silently would be worse than
 *      surfacing it.
 *   4. return { output, resultRef } — resultRef is the module object's OWN
 *      natural id (`<artifactType>:<id>`), which stays a valid, stable
 *      pointer even on a step-3 link failure — a caller is never left
 *      holding a capability result with no way to address what was created.
 *
 * NOTHING in this file or in the adapters that use it writes
 * `case_workspace_capabilities` or `case_workspace_capability_idempotency_keys`
 * directly (that remains capabilityRegistryService.ts's table, reached only
 * through its public API), and nothing here writes `case_workspace_artifact_links`
 * directly either (that remains artifactLinkService.ts's table, reached only
 * through linkArtifactToCase/its siblings) — same "adapters do not write
 * another module's tables" rule this whole program is built around, applied
 * to this program's own internal seams too.
 */

import {
  CapabilityHandlerError,
  type CapabilityExecutionEnvelope,
} from '../capabilityAdapterService.js';
import * as caseCoreService from '../caseCoreService.js';
import { CaseWorkspaceAuthError } from '../caseWorkspaceAuthContext.js';
import * as artifactLinkService from '../artifactLinkService.js';
import type { ArtifactLinkRelation } from '../artifactLinkService.js';

// ---------------------------------------------------------------------------
// Case resolution + cross-tenant guard
// ---------------------------------------------------------------------------

export interface ResolvedCaseContext {
  caseId: string;
  organizationId: string;
  projectId: string;
}

export function requireNonBlankInput(value: unknown, field: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new CapabilityHandlerError('CAPABILITY_INPUT_INVALID', `${field}_required`);
  }
  return normalized;
}

export function requireEnumInput<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new CapabilityHandlerError('CAPABILITY_INPUT_INVALID', `${field}_invalid`);
  }
  return value as T;
}

/**
 * Resolves the Case named in `caseId`, requires the acting user to have
 * standing on it (delegated to caseCoreService.getCase, which itself calls
 * caseWorkspaceAuthContext.requireCaseAccess — see that function's own doc:
 * a nonexistent caseId, a caseId in a foreign tenant, and a real caseId the
 * actor merely lacks membership on are all indistinguishable
 * `case_access_denied` outcomes, by design, SEC-009/CW-DOD-D6), and THEN adds
 * one more check `requireCaseAccess` does not: that `envelope.organizationId`
 * — the tenant the CALLER claims to be acting as — actually matches the
 * Case's real `organizationId`.
 *
 * That second check matters because `executeCapability` already authorizes
 * the envelope's `organizationId` against the REGISTRY (an org member may
 * read any platform-global capability row), but nothing upstream of this
 * adapter code cross-checks that org against the specific Case being
 * targeted. Without it, an actor whose own membership happens to satisfy
 * `requireCaseAccess` (e.g. they belong to the Case's real org) but who
 * mistakenly (or maliciously) stamped a DIFFERENT org id onto the envelope
 * would still succeed — the module write below takes `organizationId` from
 * this resolved Case context precisely so a wrong envelope org can never
 * leak into a created Decision/Initiative/KPI row.
 */
export async function resolveCaseContext(
  caseIdInput: unknown,
  envelope: CapabilityExecutionEnvelope
): Promise<ResolvedCaseContext> {
  const caseId = requireNonBlankInput(caseIdInput, 'case_id');
  const actorId = requireNonBlankInput(envelope.actor?.actorId, 'actor_id');
  const claimedOrgId = requireNonBlankInput(envelope.organizationId, 'organization_id');

  let caseView;
  try {
    caseView = await caseCoreService.getCase({ caseId }, actorId);
  } catch (error) {
    if (error instanceof CaseWorkspaceAuthError) {
      throw new CapabilityHandlerError('CAPABILITY_UNAUTHORIZED', error.code);
    }
    throw error;
  }
  if (!caseView) {
    // requireCaseAccess (inside getCase) fails closed before this can happen
    // in practice — kept as a distinct, honestly-labelled branch rather than
    // folded into the auth catch above, in case getCase's own contract ever
    // changes to return null instead of throwing.
    throw new CapabilityHandlerError('CAPABILITY_NOT_FOUND', 'case_not_found');
  }

  if (caseView.organizationId !== claimedOrgId) {
    // The actor may well be a legitimate member of the CASE's real org — this
    // is not re-litigating requireCaseAccess. It is refusing to let a
    // mismatched CALLER-supplied organizationId steer which tenant a module
    // write lands in.
    throw new CapabilityHandlerError(
      'CAPABILITY_UNAUTHORIZED',
      'envelope_organization_id_does_not_match_case_organization'
    );
  }

  return { caseId: caseView.caseId, organizationId: caseView.organizationId, projectId: caseView.projectId };
}

// ---------------------------------------------------------------------------
// Artifact link — best-effort, late-binding, retryable-by-nature
// ---------------------------------------------------------------------------

export interface ArtifactLinkOutcome {
  linked: boolean;
  linkId: string | null;
  /** Bounded, safe-to-return reason. Never a raw driver/db error message. */
  error: string | null;
}

/**
 * PARTIAL-FAILURE CONTRACT.
 *
 * The module write above this call is the capability's real, durable
 * business effect (a Decision/Initiative/KPI genuinely exists once that step
 * returns) and is intentionally NOT rolled back if this link step fails — it
 * lives in a different service, on a different transaction, from a different
 * module this program does not own the tables of, so there is no single
 * transaction that could cover both without violating "adapters do not write
 * another module's tables" from the other direction (owning a cross-module
 * transaction is not this program's to take).
 *
 * So a link failure here is surfaced, never swallowed: the caller gets
 * `{ linked: false, error }` back inside a SUCCEEDED capability result (the
 * module object is real and addressable via its own natural id, returned as
 * `resultRef` by every adapter in this directory) rather than a silent
 * `{ linked: true }` lie, and never a FAILED capability outcome that would
 * make the caller believe the module object itself was never created —
 * which would be a WORSE lie in the other direction (a retry with a fresh
 * idempotency key would then create a genuine duplicate Decision/Initiative/
 * KPI next to the one that already exists).
 *
 * RECOVERY PATH: the artifact-link mechanism already supports attaching an
 * EXISTING module object to a Case at any later time (`linkArtifactToCase`
 * with no requirement that the artifact be freshly created — this is exactly
 * the platform's own "late binding" primitive, CW-RT-025), so a failed
 * attach here is not a dead end: any caller holding the `resultRef` this
 * adapter returns can re-run the link (a fresh `dedupeKey`, or through the
 * existing artifact-link routes/service directly) without re-creating the
 * module object.
 *
 * dedupeKey is derived from the STABLE command identity
 * (`capabilityId@capabilityVersion:idempotencyKey`), so a caller retrying
 * the exact same logical command never produces two ACTIVE link rows for the
 * same artifact even if this step is invoked more than once for it.
 */
export async function attachArtifactLink(params: {
  envelope: CapabilityExecutionEnvelope;
  caseId: string;
  artifactType: string;
  artifactId: string;
  relation: ArtifactLinkRelation;
  linkArtifactToCase?: typeof artifactLinkService.linkArtifactToCase;
}): Promise<ArtifactLinkOutcome> {
  const link = params.linkArtifactToCase ?? artifactLinkService.linkArtifactToCase;
  const dedupeKey = `${params.envelope.capabilityId}@${params.envelope.capabilityVersion}:${params.envelope.idempotencyKey}`;
  try {
    const result = await link({
      caseId: params.caseId,
      artifactType: params.artifactType,
      artifactId: params.artifactId,
      relation: params.relation,
      linkedByActorId: params.envelope.actor.actorId,
      dedupeKey,
    });
    return { linked: true, linkId: result.linkId, error: null };
  } catch (error) {
    return {
      linked: false,
      linkId: null,
      // Bounded and generic on purpose — this crosses into the adapter's
      // OUTPUT, which is not put through the errorDetailRef digest step the
      // taxonomy applies to genuine failures, so it must not carry raw
      // driver/db text itself.
      error: error instanceof Error ? error.name || 'artifact_link_failed' : 'artifact_link_failed',
    };
  }
}

export function resultRefFor(artifactType: string, artifactId: string): string {
  return `${artifactType}:${artifactId}`;
}
