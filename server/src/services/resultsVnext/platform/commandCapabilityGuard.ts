/**
 * RN-G5 — command-layer capability guard for Results Next write commands.
 *
 * Problem (verified in code, not a hypothesis — see the RN-G5 task brief):
 * no write command anywhere under `server/src/services/resultsVnext/**`
 * checked the calling actor's authorization before mutating. `actorEffectiveRole`
 * was threaded through every command signature but only ever landed in the
 * audit event (`rvn_platform_events.actor_effective_role`) — never compared
 * against anything. The only pre-existing protection is maker-checker
 * ("you may not approve/close your own case") — `SelfApprovalDeniedError`
 * (kpiDefinitionCommands.ts) / `DeviationSelfApprovalDeniedError`
 * (kpiDeviationCommands.ts) / `RoiSelfApprovalDeniedError`
 * (roiCaseApprovalCommands.ts). That is a business rule about WHO may not
 * decide a specific case, not an authorization check about WHO may call the
 * command family at all — a stranger with zero relationship to a KPI could
 * approve its corrective plan, verify/dispute/correct any measurement, and
 * so on. This module is the fix: a single, reusable ALLOW/DENY decision
 * every such command consults BEFORE it writes anything.
 *
 * Design (owner's decision, RN-G5 task brief — implemented literally, not
 * reinvented): ALLOW iff at least one holds —
 *   1. `hasEffectiveCapability(access, capability)` is true. This already
 *      covers SUPERADMIN/OWNER/ADMIN (they hold `'*'`, see
 *      `effectiveAccessService.ts` `resolveEffectiveAccess`) and any regular
 *      member who has been explicitly granted the capability.
 *   2. The actor is one of the record's own designated responsible people
 *      (e.g. a KPI deviation case's `owner_user_id`/`manager_user_id` —
 *      those columns already exist, see `kpiDeviationCommands.ts:285-288`).
 * DENY otherwise.
 *
 * This module does NOT replace maker-checker (`SelfApprovalDeniedError` and
 * siblings) — that stays a SEPARATE, ADDITIONAL check. Every call site in
 * this package runs THIS guard first, then the domain's own self-approval
 * check second (see each command's own comment for why: this guard answers
 * "can this actor touch this command family at all" — a coarse
 * authorization question that should be answered, and answered with a
 * generic denial, before anything about the specific record's business
 * state — including who submitted/created it — is allowed to shape the
 * error an unauthorized caller receives. Checking self-approval FIRST would
 * mean a total stranger who submitted nothing could still trigger a
 * `SELF_APPROVAL_DENIED` response by process of elimination, and would run
 * self-approval's own row reads/comparisons for an actor who was never
 * authorized to be evaluated in the first place).
 *
 * Decision D06 (denial must be generic): the thrown error's message never
 * reveals whether the record exists, what capability would have sufficed,
 * or who the responsible people are — only that the actor lacks permission.
 * The `code`/`capability` fields are for server-side logging and the
 * client's own generic "not authorized" UI, not for reconstructing the
 * access model from the wire.
 */
import type { AccessContext } from '../../effectiveAccessService.js';
import { hasEffectiveCapability } from '../../effectiveAccessService.js';

// ==========================================
// TYPES
// ==========================================

/**
 * The slice of `AccessContext` this guard actually needs —
 * `hasEffectiveCapability` only reads `capabilities`/`platformRole`. Callers
 * (routes) resolve the full `AccessContext` via `resolveEffectiveAccess` and
 * pass this subset through to command inputs, so the command layer never
 * needs its own DB round-trip to `effectiveAccessService.ts` inside an
 * open transaction.
 */
export type CommandAccessContext = Pick<AccessContext, 'capabilities' | 'platformRole'>;

export type CommandAccessDecision = 'ALLOW' | 'DENY';

export interface EvaluateCommandAccessParams {
  /** Resolved once per request by the route, before the command runs. */
  access: CommandAccessContext;
  /** The user performing the write — compared against `responsibleUserIds`. */
  actorUserId: string;
  /** Capability string gating this command, e.g. `results.kpi.deviation.approve_plan`. */
  capability: string;
  /**
   * The record's own designated responsible people (owner/manager/etc.),
   * read from the row already loaded inside `applyMutation` — `undefined`/
   * `null` entries are ignored (a domain that has no manager concept, or a
   * record whose manager field is unset, simply contributes nothing here).
   * Omit entirely for commands with no "record" yet (e.g. a brand-new
   * aggregate's CREATE) — those are capability-only.
   */
  responsibleUserIds?: Array<string | null | undefined>;
}

/**
 * Generic, non-leaking denial (Decision D06 — see file header). Every
 * command family in this package throws exactly this class (never a
 * domain-specific subclass) so route error-mappers have one rule: this type
 * maps to 403, always, with the same fixed public message.
 */
export class CommandCapabilityDeniedError extends Error {
  code = 'COMMAND_CAPABILITY_DENIED';
  /**
   * Deliberately NOT included: whether the record exists, its current
   * owner/manager, or which capability would have sufficed — any of those
   * would let an unauthorized caller learn something about a resource they
   * were just told they cannot touch (Decision D06).
   */
  details: Record<string, unknown>;
  constructor(capability: string) {
    super('You are not authorized to perform this action.');
    this.name = 'CommandCapabilityDeniedError';
    this.details = { capability };
  }
}

// ==========================================
// DECISION
// ==========================================

/**
 * Pure ALLOW/DENY decision — no side effects, does not throw. Kept separate
 * from `assertCommandCapability` so callers that want to branch on the
 * decision (rather than catch an exception) — e.g. a future read-model that
 * wants to compute "would this actor be allowed to approve?" for a UI
 * affordance — can do so without triggering the throwing path.
 */
export function evaluateCommandAccess(params: EvaluateCommandAccessParams): CommandAccessDecision {
  const { access, actorUserId, capability, responsibleUserIds } = params;

  // Runtime callers can still arrive from untyped JS, old workers or stale
  // test/queue payloads. Missing access must be a controlled fail-closed DENY,
  // never a TypeError that becomes a 500 and bypasses the route's canonical
  // authorization error mapping.
  if (!access) return 'DENY';
  if (hasEffectiveCapability(access, capability)) return 'ALLOW';

  if (
    responsibleUserIds?.some(
      (candidateId) => typeof candidateId === 'string' && candidateId.length > 0 && candidateId === actorUserId
    )
  ) {
    return 'ALLOW';
  }

  return 'DENY';
}

/**
 * Throwing convenience wrapper — the shape every command call site actually
 * uses (mirrors `SelfApprovalDeniedError`'s own call sites: a guard clause
 * at the very top of `applyMutation`, before any read/write past the row
 * lock already taken by `loadForUpdate`).
 */
export function assertCommandCapability(params: EvaluateCommandAccessParams): void {
  if (evaluateCommandAccess(params) === 'DENY') {
    throw new CommandCapabilityDeniedError(params.capability);
  }
}
