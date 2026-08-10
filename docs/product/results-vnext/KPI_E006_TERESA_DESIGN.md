# KPI-E006 Teresa & Governance — Approved Design

> Status: APPROVED FOR IMPLEMENTATION (Integration Owner review 2026-08-09).
> Draft: agent `a09caf0bbb159bd5f`, single-pass complete. Full code below,
> verbatim from the draft except where a decision changes it.

## Decisions

| # | Question | Decision |
|---|---|---|
| 1 | `editDraft` signature not fully read by drafting agent, `as any` cast used | **Implementer must read the full `EditDraftInput` interface and remove the cast before landing** — routine verification, not an open design question. |
| 2 | `target_resource.resource_id` inconsistency: edit-path needs `definition_version_id`, but `resource_type:'kpi'` visibility semantics are keyed on `kpi_id` | **Approved: always carry `kpi_id` in `target_resource`.** The handler resolves `current_definition_version_id` internally via `getKpi()` (itself visibility-scoped) before calling `editDraft`. One extra read, but keeps the payload contract consistent with `resource_type:'kpi'` and avoids a second, inconsistent identity concept in the payload. |
| 3 | `undoProposal` for `target_module='kpi'` — support or block? | **Block explicitly for V1**: `P08_UNDO_NOT_SUPPORTED` error if `undoProposal` is called for a KPI handoff. `createKpiDraft` has no natural "delete draft" domain operation; building one now would expand scope non-trivially (cascade considerations). An explicit "not supported" is safer than a fabricated undo that doesn't cleanly reverse the domain state. |
| 4 | Mode 2 (`check_in_manager_brief`) — full P08 proposal/approve envelope vs. immediate chat render | **Approved as designed: full envelope, audit over convenience.** This is the conservative default appropriate before a product-level UX call from Piotr; revisit only if real usage friction surfaces. Not a reversal of governance defaults for convenience. |
| 5 | `actorEffectiveRole: 'teresa_initiated'` — new value, not verified against any downstream consumer expecting a fixed enum | **Implementer must grep `actor_effective_role`/`actorEffectiveRole` usage repo-wide before landing** to confirm no consumer assumes a closed enum; if none does (expected, since `atomicWrite.ts` types it as a free string), proceed with `'teresa_initiated'` as a new, self-documenting value. |

## A) Registration — `kpi` only, `results` deliberately deferred

`'kpi'` is registered now; the generic `'results'` navigational target is
**deferred** — the Integration DAG (`EXECUTION_LEDGER.md` §4.2) requires
Registry shell before Teresa wiring, and `src/components/ResultsVNext/*`
does not exist yet (zero files, verified). Registering `'results'` today
would mean every `handoff_intent:'open'` deep-links to a screen that
doesn't exist — a deliberately-dead target, which the citation/truthfulness
posture (`P08_CITATION_POSTURE`) exists to prevent. `'kpi'` has a real,
verified vertical slice behind it (KPI-E001–E005) — the "first accepted
slice" condition §4.2 requires for Teresa wiring.

`HandoffTargetModule`'s type already contains `'kpi'` (reserved slot,
RN-G1) — **not modified**, only `P08_HANDOFF_TARGETS` and
`P08_HANDOFF_TARGET_MODULES` change.

### New payload types (append to `teresaCopilotCanon.ts`, after `InterviewHandoffPayload`, before `P08_HANDOFF_TARGETS`)

```ts
// ────────────────────────────────────────────────────────────────
// KPI-E006 — Results/KPI advisor handoff (three governed modes)
// ────────────────────────────────────────────────────────────────

export type ResultsKpiAdvisorMode =
  | 'draft_quality_review'   // KPI-F-027
  | 'check_in_manager_brief' // KPI-F-028
  | 'reflection_rca';        // KPI-F-030

export interface ResultsKpiEvidenceBreakdown {
  facts: string[];
  inference: string[];
  missing_evidence: string[];
  recommendation: string;
}

export interface KpiDraftQualityReviewPayload {
  proposed: {
    kpiCode: string;
    name: string;
    description: string | null;
    unit: string | null;
    targetGeometry: 'threshold_min' | 'threshold_max' | 'range' | 'exact' | 'binary' | 'custom';
    targetValue: number | null;
    targetMin: number | null;
    targetMax: number | null;
    warningLow: number | null;
    warningHigh: number | null;
    criticalLow: number | null;
    criticalHigh: number | null;
    binarySuccessValue: number | null;
    formulaText: string | null;
    ownerUserId: string | null;
  };
  quality_review: {
    purpose_question: string;
    actionability_question: string;
    owner_load_note: string | null;
    target_evidence_note: string | null;
    duplicate_risk: { candidate_kpi_ids: string[]; note: string | null };
  };
  evidence_breakdown: ResultsKpiEvidenceBreakdown;
}

export interface KpiCheckInManagerBriefPayload {
  scope: 'my_kpis' | 'team' | 'organization';
  cited_kpi_ids: string[];
  cited_deviation_case_ids: string[];
  narrative: string;
  evidence_breakdown: ResultsKpiEvidenceBreakdown;
}

export interface KpiReflectionRcaPayload {
  case_id: string;
  proposed_root_cause_summary: string;
  proposed_root_cause_category: string;
  recurrence_flag: boolean;
  evidence_breakdown: ResultsKpiEvidenceBreakdown;
}

export interface ResultsKpiHandoffContext {
  advisor_mode: ResultsKpiAdvisorMode;
  target_resource: {
    resource_type: 'kpi' | 'deviation_case';
    /** Decision #2: ALWAYS kpi_id (never definition_version_id) for the
     * 'kpi' resource_type — the handler resolves current_definition_version_id
     * internally via getKpi() when editing. null ONLY for draft_quality_review
     * on a brand-new KPI (create path). */
    resource_id: string | null;
  };
  expected_version: number | null; // null legal ONLY on the create path
  draft_quality_review?: KpiDraftQualityReviewPayload;
  check_in_manager_brief?: KpiCheckInManagerBriefPayload;
  reflection_rca?: KpiReflectionRcaPayload;
}
```

### `P08_HANDOFF_TARGETS` entry (append after `interview:`)

```ts
kpi: {
  module: 'KPI' as const,
  contract_ref: 'KPI-E006',
  description:
    'Governed KPI advisor: drafting + quality-review for a new KPI, ' +
    'check-in/manager-brief assistance (visibility-scoped), deviation ' +
    'reflection/RCA drafting. Teresa never creates/activates/approves/' +
    'verifies/closes — see P08_KPI_FORBIDDEN_VERBS.',
  required_common_payload: true,
  required_extra_fields: ['kpi_handoff_context', 'evidence_pointers'] as const,
},
```

### `P08_HANDOFF_TARGET_MODULES` — append only

```ts
export const P08_HANDOFF_TARGET_MODULES: HandoffTargetModule[] = [
  'radar', 'initiatives', 'calendar', 'notebook', 'interview',
  'excele', 'ideas', 'documents', 'presentations',
  'kpi', // KPI-E006, appended — existing 9 entries untouched
];
```

### Forbidden-verb list (documentation of an existing architectural fact)

```ts
export const P08_KPI_FORBIDDEN_VERBS = [
  'approveDefinitionVersion', 'rejectDefinitionVersion', 'activateKpi',
  'suspendKpi', 'archiveKpi', 'verifyMeasurement', 'disputeMeasurement',
  'approvePlan', 'submitEffectivenessVerification', 'closeDeviationCase',
  'reopenDeviationCase',
] as const;
```

## B) `handleResultsKpiHandoff`

Dispatcher case (in `performHandoff`):

```ts
case 'kpi':
  return handleResultsKpiHandoff(proposalId, organizationId, userId, handoffContext, targetPayload);
```

Imports (top of `teresaCopilotService.ts`) — **the only four KPI-domain
functions imported anywhere in this file** (this is the literal, grep-able
proof for §D):

```ts
import { createKpiDraft, editDraft as editKpiDraft } from '../resultsVnext/kpi/kpiDefinitionCommands.js';
import { submitRootCause } from '../resultsVnext/kpi/kpiDeviationCommands.js';
import { getKpi, listKpis } from '../resultsVnext/kpi/kpiRepository.js';
import { getDeviationCase } from '../resultsVnext/kpi/kpiDeviationRepository.js';
import { AtomicWriteConflictError } from '../resultsVnext/platform/atomicWrite.js';
import type { ResultsKpiHandoffContext } from './teresaCopilotCanon.js';
```

Mode dispatcher:

```ts
async function handleResultsKpiHandoff(
  proposalId: string, organizationId: string, userId: string,
  context: TeresaHandoffContext, payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const kpiContext = payload.kpi_handoff_context as ResultsKpiHandoffContext | undefined;
  if (!kpiContext?.advisor_mode) {
    throw new TeresaCopilotError('kpi_handoff_context.advisor_mode missing', 'P08_KPI_INVALID_PAYLOAD');
  }
  switch (kpiContext.advisor_mode) {
    case 'draft_quality_review':
      return handleKpiDraftQualityReview(proposalId, organizationId, userId, context, kpiContext);
    case 'check_in_manager_brief':
      return handleKpiCheckInManagerBrief(proposalId, organizationId, userId, context, kpiContext);
    case 'reflection_rca':
      return handleKpiReflectionRca(proposalId, organizationId, userId, context, kpiContext);
    default: {
      const _exhaustive: never = kpiContext.advisor_mode;
      throw new TeresaCopilotError(`Unknown KPI advisor mode: ${String(_exhaustive)}`, 'P08_KPI_UNKNOWN_MODE');
    }
  }
}
```

### Mode 1: `draft_quality_review` (KPI-F-027) — full code

`buildKpiDraftAdvisorContext` runs BEFORE `createProposal` (while Teresa
assembles the chat suggestion) — this is where retrieval is
visibility-scoped (KPI-F-031), reusing `listKpis()` (already the only real
`buildVisibilityScopedCte` caller in the KPI repo), never a raw query:

```ts
export async function buildKpiDraftAdvisorContext(params: {
  userId: string; organizationId: string; candidateName: string; candidateCode: string;
}): Promise<{ candidateKpiIds: string[]; note: string | null }> {
  const { userId, organizationId, candidateName, candidateCode } = params;
  const visible = await listKpis({ userId, organizationId, limit: 500 });
  const needle = candidateName.trim().toLowerCase();
  const codeNeedle = candidateCode.trim().toLowerCase();
  const matched = visible.filter(
    (k) => k.kpiCode.toLowerCase() === codeNeedle || (needle.length > 3 && k.kpiCode.toLowerCase().includes(needle))
  );
  return {
    candidateKpiIds: matched.map((k) => k.kpiId),
    note: matched.length ? `${matched.length} visible KPI(s) with a similar code/name already exist` : null,
  };
}
```

`handleKpiDraftQualityReview` (called from `performHandoff`, AFTER human
approve+execute):

```ts
async function handleKpiDraftQualityReview(
  proposalId: string, organizationId: string, userId: string,
  context: TeresaHandoffContext, kpiContext: ResultsKpiHandoffContext
): Promise<Record<string, unknown>> {
  const draft = kpiContext.draft_quality_review;
  if (!draft) throw new TeresaCopilotError('draft_quality_review payload missing', 'P08_KPI_INVALID_PAYLOAD');

  const { resource_id: kpiId } = kpiContext.target_resource;
  const { proposed } = draft;

  if (kpiId === null) {
    // CREATE path.
    if (kpiContext.expected_version !== null) {
      throw new TeresaCopilotError('expected_version must be null on create path', 'P08_KPI_INVALID_PAYLOAD');
    }
    // createKpiDraft() itself resolves the active visibility policy via
    // getActiveVisibilityPolicy() and fails closed if none exists.
    const outcome = await createKpiDraft({
      organizationId, kpiCode: proposed.kpiCode, name: proposed.name, description: proposed.description,
      unit: proposed.unit, targetGeometry: proposed.targetGeometry, targetValue: proposed.targetValue,
      targetMin: proposed.targetMin, targetMax: proposed.targetMax, warningLow: proposed.warningLow,
      warningHigh: proposed.warningHigh, criticalLow: proposed.criticalLow, criticalHigh: proposed.criticalHigh,
      binarySuccessValue: proposed.binarySuccessValue, formulaText: proposed.formulaText,
      ownerUserId: proposed.ownerUserId,
      // createdBy = userId (the REAL human who approved+executed this
      // proposal), NEVER a 'teresa' sentinel — keeps SelfApprovalDeniedError
      // meaningful later when this person tries to self-approve in the KPI Tool.
      createdBy: userId, actorEffectiveRole: 'teresa_initiated',
      idempotencyKey: proposalId, correlationId: context.runtime_binding?.conversation_id ?? undefined,
      reason: `Teresa draft_quality_review: ${draft.quality_review.purpose_question}`,
    });
    await recordTeresaKpiHandoffResult(proposalId, organizationId, outcome.result.kpi.kpiId);
    return {
      handoff: 'kpi', advisor_mode: 'draft_quality_review',
      kpi_id: outcome.result.kpi.kpiId, definition_version_id: outcome.result.definitionVersion.definitionVersionId,
      row_version: outcome.result.kpi.rowVersion, real_entity: true, status: outcome.result.kpi.status,
      outcome: outcome.outcome, quality_review: draft.quality_review, duplicate_risk: draft.quality_review.duplicate_risk,
    };
  }

  // EDIT path (decision #2): target_resource.resource_id is a kpi_id.
  // Resolve current_definition_version_id via getKpi() FIRST (visibility-scoped read).
  if (kpiContext.expected_version === null) {
    throw new TeresaCopilotError('expected_version required when resource_id is set', 'P08_KPI_INVALID_PAYLOAD');
  }
  const currentKpi = await getKpi({ userId, organizationId, kpiId });
  if (!currentKpi) {
    throw new TeresaCopilotError('KPI not found or not visible to approving user', 'P08_KPI_VISIBILITY_STALE');
  }
  try {
    const outcome = await editKpiDraft({
      definitionVersionId: currentKpi.currentDefinitionVersionId, organizationId,
      expectedVersion: kpiContext.expected_version,
      name: proposed.name, description: proposed.description, unit: proposed.unit,
      targetGeometry: proposed.targetGeometry, targetValue: proposed.targetValue, targetMin: proposed.targetMin,
      targetMax: proposed.targetMax, warningLow: proposed.warningLow, warningHigh: proposed.warningHigh,
      criticalLow: proposed.criticalLow, criticalHigh: proposed.criticalHigh,
      binarySuccessValue: proposed.binarySuccessValue, formulaText: proposed.formulaText,
      editedBy: userId, actorEffectiveRole: 'teresa_initiated',
      idempotencyKey: proposalId, correlationId: context.runtime_binding?.conversation_id ?? undefined,
      reason: `Teresa draft_quality_review (re-review): ${draft.quality_review.purpose_question}`,
    });
    await recordTeresaKpiHandoffResult(proposalId, organizationId, kpiId);
    return {
      handoff: 'kpi', advisor_mode: 'draft_quality_review', kpi_id: kpiId,
      row_version: outcome.resultingVersion, real_entity: true, outcome: outcome.outcome,
      quality_review: draft.quality_review,
    };
  } catch (err) {
    if (err instanceof AtomicWriteConflictError) throw err; // truth-preserving failure, re-throw as-is
    throw err;
  }
}
```

### Mode 2: `check_in_manager_brief` (KPI-F-028) — full code

Read-only toward the KPI domain (never calls a command); the envelope
exists to audit a sensitive aggregated read, matching T3.

```ts
async function handleKpiCheckInManagerBrief(
  proposalId: string, organizationId: string, userId: string,
  context: TeresaHandoffContext, kpiContext: ResultsKpiHandoffContext
): Promise<Record<string, unknown>> {
  const brief = kpiContext.check_in_manager_brief;
  if (!brief) throw new TeresaCopilotError('check_in_manager_brief payload missing', 'P08_KPI_INVALID_PAYLOAD');

  // Re-resolve visibility AT EXECUTION TIME, not trusting the payload built
  // minutes earlier in chat — this is what makes it an AUDITED read.
  const stillVisible = await listKpis({ userId, organizationId, limit: 500 });
  const stillVisibleIds = new Set(stillVisible.map((k) => k.kpiId));
  const leaked = brief.cited_kpi_ids.filter((id) => !stillVisibleIds.has(id));
  if (leaked.length > 0) {
    throw new TeresaCopilotError(`Cited KPI(s) no longer visible: ${leaked.join(', ')}`, 'P08_KPI_VISIBILITY_STALE');
  }
  await recordTeresaKpiHandoffResult(proposalId, organizationId, `brief:${proposalId}`);
  return {
    handoff: 'kpi', advisor_mode: 'check_in_manager_brief', real_entity: false,
    scope: brief.scope, cited_kpi_ids: brief.cited_kpi_ids,
    cited_deviation_case_ids: brief.cited_deviation_case_ids, narrative: brief.narrative,
  };
}
```

### Mode 3: `reflection_rca` (KPI-F-030) — full code, self-approval enforcement

```ts
async function handleKpiReflectionRca(
  proposalId: string, organizationId: string, userId: string,
  context: TeresaHandoffContext, kpiContext: ResultsKpiHandoffContext
): Promise<Record<string, unknown>> {
  const rca = kpiContext.reflection_rca;
  if (!rca) throw new TeresaCopilotError('reflection_rca payload missing', 'P08_KPI_INVALID_PAYLOAD');
  if (kpiContext.expected_version === null) {
    throw new TeresaCopilotError('expected_version required (case already exists)', 'P08_KPI_INVALID_PAYLOAD');
  }

  // *** SELF-APPROVAL ENFORCEMENT — no special case for Teresa. ***
  // submitRootCause() itself has no approver gate; the real gate is
  // approvePlan() downstream (kpiDeviationCommands.ts), which denies when
  // plan_submitted_by/created_by === approverId. That check only works if
  // those columns hold a REAL human id — never a 'teresa' sentinel. So
  // actorUserId below MUST be userId, exactly like createdBy above.
  const outcome = await submitRootCause({
    caseId: rca.case_id, organizationId, expectedVersion: kpiContext.expected_version,
    actorUserId: userId, actorEffectiveRole: 'teresa_initiated',
    idempotencyKey: proposalId, correlationId: context.runtime_binding?.conversation_id ?? undefined,
    rootCauseSummary: rca.proposed_root_cause_summary, rootCauseCategory: rca.proposed_root_cause_category,
    recurrenceFlag: rca.recurrence_flag, reason: 'Teresa reflection_rca draft, approved by user',
  });
  await recordTeresaKpiHandoffResult(proposalId, organizationId, outcome.result.caseId);
  return {
    handoff: 'kpi', advisor_mode: 'reflection_rca', case_id: outcome.result.caseId,
    case_status: outcome.result.status, row_version: outcome.resultingVersion,
    real_entity: true, outcome: outcome.outcome, evidence_breakdown: rca.evidence_breakdown,
  };
}
```

`recordTeresaKpiHandoffResult` is a small shared helper wrapping the
existing `teresa_handoff_results` insert (see §C for its migration).

## C) Audit — new migration required (this package's scope)

`teresa_proposals`/`teresa_audit_log` (self-provisioned via
`ensureTeresaTables()`, not real migrations, `DbPromise` fallback known to
swallow write errors per M15 memory) are **left untouched** — migrating all
9 existing targets is a larger, separate decision with real regression
risk, out of scope here.

**What IS in scope**: `teresa_handoff_results` (the one table the handlers
in §B actually write to) moves to a real migration:

```sql
-- server/migrations/<8-digit-date>_rvn_teresa_kpi_handoff_results.sql
CREATE TABLE IF NOT EXISTS teresa_handoff_results (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES teresa_proposals(id),
  organization_id TEXT NOT NULL,
  target_module TEXT NOT NULL,
  result_ref TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

(Verify exact existing column set/types against `ensureTeresaTables()`
before writing — this migration must match what's already there, `IF NOT
EXISTS` makes it a safe no-op if the table already exists with this shape.)

The domain-level audit KPI-E006 AC4 actually needs already exists for
free: every write in §B goes through `createKpiDraft`/`editDraft`/
`submitRootCause` — the SAME commands a human uses — which already insert
into `rvn_platform_events` with `actorEffectiveRole:'teresa_initiated'`,
`source:'resultsVnext.kpi'`. Query `rvn_platform_events WHERE aggregate_id
= <kpi_id or case_id>` for the domain-truth audit; `teresa_proposals`/
`teresa_audit_log` remain the *proposal lifecycle* audit (a different,
complementary thing), linked via `result_ref`.

## D) Proof Teresa has no code path to approve/verify/close

Static, grep-able proof (stronger than a behavioral test — cannot be
bypassed by a dynamic-import trick, since the existing `tryImport()`
pattern in this file takes a fixed specifier, never a runtime-constructed
function name):

```bash
grep -nE "from '\.\./resultsVnext/kpi/" server/src/services/v8/teresaCopilotService.ts
# Expected — exactly these 4 lines, nothing else:
#   import { createKpiDraft, editDraft as editKpiDraft } from '../resultsVnext/kpi/kpiDefinitionCommands.js';
#   import { submitRootCause } from '../resultsVnext/kpi/kpiDeviationCommands.js';
#   import { getKpi, listKpis } from '../resultsVnext/kpi/kpiRepository.js';
#   import { getDeviationCase } from '../resultsVnext/kpi/kpiDeviationRepository.js';

grep -nE "approveDefinitionVersion|rejectDefinitionVersion|activateKpi|suspendKpi|archiveKpi|verifyMeasurement|disputeMeasurement|approvePlan|submitEffectivenessVerification|closeDeviationCase|reopenDeviationCase" \
  server/src/services/v8/teresaCopilotService.ts server/src/services/v8/teresaCopilotCanon.ts
# Expected: ZERO matches.
```

Static test (`tests/resultsVnext/teresa-kpi-forbidden-verbs.test.ts`) reads
both source files as text and asserts `P08_KPI_FORBIDDEN_VERBS` never
appears, plus that KPI imports are limited to the 6-name whitelist
(`createKpiDraft, editDraft, submitRootCause, getKpi, listKpis,
getDeviationCase`).

Behavioral test (realDB, complements the static proof — does not replace
it): `executeProposal` for `draft_quality_review` never leaves
`rvn_kpi_definitions.status != 'draft'`; a `reflection_rca` handoff records
the approving human as `submitRootCause`'s actor, and `approvePlan` by that
SAME human is still denied by `DeviationSelfApprovalDeniedError` — proving
Teresa's presence in the chain does not weaken the existing human
self-approval gate.

## E) Files

**Edit**: `teresaCopilotCanon.ts` (new types + `P08_HANDOFF_TARGETS` entry +
`P08_HANDOFF_TARGET_MODULES` append + `P08_KPI_FORBIDDEN_VERBS`),
`teresaCopilotService.ts` (4 imports, `case 'kpi':`, 4 new functions +
`recordTeresaKpiHandoffResult` helper, `undoProposal`'s switch gets a
`case 'kpi': throw ... 'P08_UNDO_NOT_SUPPORTED'` per decision #3).

**New**: `server/migrations/<date>_rvn_teresa_kpi_handoff_results.sql`,
`tests/resultsVnext/teresa-kpi-forbidden-verbs.test.ts`,
`tests/resultsVnext/teresa-kpi-e2e-no-silent-approval.test.ts` (realDB),
`tests/v8/teresa-kpi-handoff.test.ts` (unit, 3 modes).

**Untouched**: the other 9 `handle*Handoff` functions, `teresa_proposals`/
`teresa_audit_log` schema, `HandoffTargetModule` union type (already has
`'kpi'`).
