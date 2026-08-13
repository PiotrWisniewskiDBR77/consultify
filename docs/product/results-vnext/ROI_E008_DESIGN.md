# ROI-E008 — Teresa/Legacy/Ops — FROZEN DESIGN

Status: FROZEN. Integration Owner: Claude (orchestrator session, 2026-08-10).
Eighth and LAST epic of the ROI domain, builds on ROI-E001-E007, all landed.
Backend only. Two independent halves, mirroring KPI-E006+KPI-E007 combined.

**Reconciliation against ROI-E007's final state (the draft's own flagged
D11 caveat) — resolved**: verified directly against the landed migration
(`server/migrations/20260820_rvn_roi_finance_seam.sql`) that ROI-E007's
seam tables are `rvn_roi_finance_links`/`rvn_roi_finance_reconciliations` —
new vNext tables ROI-E007 itself owns, correctly excluded from this epic's
legacy archive scope. D11 confirmed as designed, nothing to change.

---

## 0. Epic boundary (quoted verbatim)

`EPIC_LEDGER_LIVE.md`:

> "ROI-E008 Teresa/Legacy/Ops (6 AC: wersjonowany pinned kontekst Teresy,
> pełna provenance na każdym outpucie, zero ścieżki do mutacji/approval bez
> human accept, legacy GET-only fail-closed na mutacje, legacy `/roi`
> jawnie oznaczone i nigdy nie zasila vNext, append-only event log z
> idempotent replay)."

1. **AC-01** — versioned, pinned Teresa context (never live-recomputed).
2. **AC-02** — full provenance on every output.
3. **AC-03** — zero path to mutation/approval without explicit human accept.
4. **AC-04** — legacy surface is GET-only, fail-closed on any mutation attempt.
5. **AC-05** — legacy `/roi` explicitly labeled and never feeds vNext.
6. **AC-06** — append-only event log with idempotent replay.

AC-01/02/03 → Half A (Teresa). AC-04/05 → Half B (Legacy). AC-06 is
cross-cutting, satisfied for free by `executeAtomicCommand`'s existing
CAS+idempotency-key+append-only-event guarantee — no new infrastructure.

Confirmed handoff from ROI-E006 Decision D13 (verbatim): "Teresa generation
itself deferred to ROI-E008 — E006 ships only the receiving data shape
(`teresa_draft_lessons_payload`, disposition columns) and the disposition
gate (AC-06 of E006). ROI-E008 owns the actual generation call." This is
Half A's literal scope.

---

## 1. Decisions

All 11 decision points from the design draft are ratified as specified,
with its own 6 flagged open questions resolved as D12-D17.

| # | Question | Decision | Rationale |
|---|---|---|---|
| D1 | Register `'roi'` in `P08_HANDOFF_TARGETS` now, even though the frontend doesn't exist? | **Yes**, same reasoning as KPI-E006's own precedent — `HandoffTargetModule` already reserves `'roi'` (RN-G1), ROI-E001-E007 delivered a real, verified backend vertical slice. | Consistent with the bar KPI cleared before its own frontend existed. |
| D2 | How many Teresa advisor modes does ROI get? | **One: `pir_lessons_draft`.** No other named need exists in any source doc. | Matches this program's consistent refusal to invent speculative advisor modes (ROI-E006 D12's precedent). |
| D3 | New file or extend `roiPirCommands.ts`? | **Extend** `roiPirCommands.ts`. | One CAS-guarded state machine per aggregate belongs in one file, matching KPI-E006's own precedent of extending rather than forking. |
| D4 | Does the new write touch `lessons_learned`? | **No, never.** Writes only `teresa_draft_lessons_payload`/`teresa_draft_generated_at`. | The `lessons_learned` boundary belongs exclusively to ROI-E006's already-shipped `recordRoiPirTeresaDraftDisposition` — verified as the only writer of that column today. |
| D5 | Full P08 approval envelope, or a lighter "just save it" path for a non-authoritative column? | **Full envelope.** | `P08_ACTION_ENVELOPE_RULES.no_silent_writes` is unconditional, no carve-out for non-authoritative columns. Confirmed as the right call — see D12. |
| D6 | Block regeneration once a disposition already exists? | **Yes** — `DISPOSITION_ALREADY_RECORDED` guard. | Prevents a new draft from silently invalidating a human decision already made on a prior draft. Confirmed as the right call — see D13. |
| D7 | `undoProposal` for `target_module='roi'`? | **Block**, same shape as KPI's `P08_UNDO_NOT_SUPPORTED`, ROI-specific rationale: `recordRoiPirTeresaDraftDisposition('rejected')` already gives a clean discard path without ever promoting to `lessons_learned`. | Same governance-conservative default as KPI-E006 D3. |
| D8 | Extend `rvn_roi_pir_protect_frozen()` to freeze the two Teresa columns once finalized? | **Yes**, `CREATE OR REPLACE FUNCTION` only, no trigger rebind needed. Verified gap: the ROI-E006 migration's trigger body does not currently guard these two columns post-finalize. | Matches the "every frozen fact gets a DB-level guarantee" posture every `rvn_roi_*` table has followed since ROI-E001. |
| D9 | Legacy archive table scope — still 7 tables per ROI-E001's original inventory? | **Confirmed accurate by direct re-grep**, with one correction: all 7 tables have live, currently-active writers today (unlike KPI-E007, where 3 of 4 had none) — see §B0's table. | Re-derived from source per the task's own instruction not to trust the old inventory blindly. |
| D10 | Does the legacy archive duplicate `v8_kpi_definitions` (already served by KPI-E007)? | **No — explicitly excluded.** ROI's own `v8_roi_realization_entries` is the distinct table archived instead; the ROI legacy index cross-references KPI-E007's endpoint by URL. | Avoids a second read path to the same table with possibly-drifting query shapes. |
| D11 | Finance seam boundary — confirm ROI-E007's seam tables are excluded from the legacy archive? | **Confirmed, re-verified against ROI-E007's actual landed migration**: `rvn_roi_finance_links`/`rvn_roi_finance_reconciliations`, new vNext tables E007 owns, not legacy. | Directly checked, not inherited from a mid-flight guess. |
| D12 (resolves OQ2) | Confirm D5 (full envelope)? | **Confirmed.** Consistency with the one universal `no_silent_writes` rule beats a "it's just a draft column" shortcut argument. | — |
| D13 (resolves OQ3) | Confirm D6 (block regeneration)? | **Confirmed.** Defense-in-depth in the same spirit as ROI-E003 D6/ROI-E006 D6 (self-close/self-verify denials) — a real, narrow correctness gap worth closing. | — |
| D14 (resolves OQ4) | 4-bucket vs. 1-bucket `originDomain` labeling for the legacy archive? | **Keep the 4-bucket scheme** (grouped by verified owning surface: `initiatives_module_live`, `results_v8_live`, `finance_benefits_live`, plus a distinct label per table within each bucket). | More informative than a single bucket, costs nothing extra, and accurately reflects that these 7 tables genuinely belong to 3 distinct, separately-owned live systems — collapsing that distinction would lose real information a future reader needs. |
| D15 (resolves OQ5) | Confirm D11 against ROI-E007's actual final state? | **Confirmed**, see D11 above — directly verified, not inherited. | — |
| D16 (resolves OQ6) | `analysis_financials` write-handler line reference — needs re-confirmation at implementation time? | **Yes, implementer must re-grep and confirm the exact call site before relying on it** — this is a build-time verification step, not an Owner decision. | Matches this program's "verify against real runtime, not assumed" discipline (CLAUDE.md's own golden rule #1). |
| D17 | Does `flagEvidenceLinkFreshnessCheck` (ROI-E007) actually give `freshness_checked_at` its first real writer, as ROI-E007's design doc claimed? | **No — correction.** ROI-E007's own closure entry found `flagBenefitEvidenceLinkDisputed` (ROI-E002) already writes this column. Noted here as a documentation correction inherited from ROI-E007's closure entry, not a defect requiring any code change in this epic. | Carried forward for completeness; does not affect anything ROI-E008 builds. |

---

## 2. HALF A — Teresa integration

### A1. P08 wiring

**New types**, appended to `server/src/services/v8/teresaCopilotCanon.ts`
immediately after the `ResultsKpiHandoffContext` block and before
`P08_HANDOFF_TARGETS`:

```typescript
// ────────────────────────────────────────────────────────────────
// ROI-E008 — Results/ROI advisor handoff (one governed mode)
// ────────────────────────────────────────────────────────────────

export type ResultsRoiAdvisorMode =
  | 'pir_lessons_draft'; // ROI-E006 D13's deferred generation call — the ONLY named ROI advisor need

export interface RoiPirLessonsAdvisorEvidenceBreakdown {
  facts: string[];
  inference: string[];
  missing_evidence: string[];
  recommendation: string;
}

export interface RoiPirLessonsDraftPayload {
  draft_lessons_text: string;
  evidence_breakdown: RoiPirLessonsAdvisorEvidenceBreakdown;
  // Deliberately NOT draft_outcome/draft_recommendation: those stay
  // human-authored-only fields (updateRoiPostInvestmentReviewDraft,
  // ROI-E006). AC-06 of ROI-E006 names only "a Teresa-drafted LESSONS
  // text" — do not widen scope here.
}

export interface ResultsRoiHandoffContext {
  advisor_mode: ResultsRoiAdvisorMode;
  target_resource: {
    resource_type: 'roi_pir';
    resource_id: string; // pir_id — never null; the PIR must already exist
                          // (started via startRoiCasePostInvestmentReview,
                          // ROI-E006) before Teresa can draft lessons for it.
                          // No create path, unlike KPI's draft_quality_review.
  };
  case_id: string;
  expected_version: number; // PIR row_version — CAS, never null
  pir_lessons_draft?: RoiPirLessonsDraftPayload;
}
```

**`P08_HANDOFF_TARGETS` entry** (append after `kpi:`):

```typescript
roi: {
  module: 'ROI' as const,
  contract_ref: 'ROI-E008',
  description:
    'Governed ROI advisor: Post-Investment-Review lessons-learned drafting ' +
    'only, grounded in the already-frozen, versioned review_snapshot_payload ' +
    '(AC-01). Teresa never creates/models/submits/approves/rejects/forecasts/' +
    'records-actual/verifies/disputes/schedules/closes a Case or PIR — see ' +
    'P08_ROI_FORBIDDEN_VERBS.',
  required_common_payload: true,
  required_extra_fields: ['roi_handoff_context', 'evidence_pointers'] as const,
},
```

**`P08_HANDOFF_TARGET_MODULES`** — append `'roi'`, existing entries
untouched.

**`P08_ROI_FORBIDDEN_VERBS`** (documentation aid, not the primary
enforcement — the real enforcement is the import whitelist below). The
implementer MUST re-grep every export across ALL `roi*Commands.ts` files
(there are ~20 by ROI-E008's start, not just the ~8 the draft checked)
before landing this constant, per D16's own discipline:

```typescript
export const P08_ROI_FORBIDDEN_VERBS = [
  // roiCaseCommands.ts
  'createRoiCase', 'updateRoiCaseDetails', 'archiveRoiCase', 'startModeling',
  'markReadyForReview', 'reopenRejectedRoiCase',
  // roiCaseApprovalCommands.ts
  'submitRoiCaseForApproval', 'approveRoiCase', 'rejectRoiCase',
  'requestChangesOnRoiCase', 'reopenApprovedRoiCaseForRevision',
  // roiBaselineCommands.ts
  'captureOrUpdateBaseline', 'freezeRoiBaseline', 'unfreezeRoiBaseline',
  // roiBenefitsRealizationCommands.ts
  'startRoiCaseBenefitsRealization', 'cancelRoiCase',
  // roiPirCommands.ts (ROI-E006 + this epic's own recordRoiPirTeresaLessonsDraft is the ONE exception)
  'scheduleRoiCasePostInvestmentReview', 'markRoiCasePostInvestmentReviewDue',
  'startRoiCasePostInvestmentReview', 'updateRoiPostInvestmentReviewDraft',
  'recordRoiPirTeresaDraftDisposition', 'closeRoiCase',
  // roiActualEntryCommands.ts / roiActualSnapshotCommands.ts
  'recordActualEntry', 'correctActualEntry', 'verifyActualEntry', 'disputeActualEntry',
  'publishRoiActualSnapshot',
  // roiVarianceCommands.ts
  'recordVariance', 'updateVarianceStatus', 'addVarianceCause', 'removeVarianceCause',
  // roiFinanceLinkCommands.ts / roiFinanceReconciliationCommands.ts (ROI-E007)
  'createRoiFinanceLink', 'removeRoiFinanceLink', 'openRoiFinanceReconciliation',
  'updateRoiFinanceReconciliationStatus',
  // roiBenefitEvidenceLinkCommands.ts (ROI-E002 + E007's flagEvidenceLinkFreshnessCheck)
  'addBenefitEvidenceLink', 'removeBenefitEvidenceLink', 'flagBenefitEvidenceLinkDisputed',
  'flagEvidenceLinkFreshnessCheck',
  // Implementer MUST re-grep the remaining command files
  // (roiAssumptionCommands.ts, roiBenefitLineCommands.ts, roiCostLineCommands.ts,
  //  roiCalculationRunCommands.ts, roiCalculationPolicyCommands.ts,
  //  roiScenarioCommands.ts, roiForecastVersionCommands.ts, roiTrackingCommands.ts,
  //  roiEconomicModelFreeze.ts) via:
  //  grep -nE "^export (async )?function [a-zA-Z]+" server/src/services/resultsVnext/roi/*Commands.ts
  //    server/src/services/resultsVnext/roi/roiEconomicModelFreeze.ts
  //  and append every export found. This array is documentation; the import
  //  whitelist below is the actual, complete, grep-verifiable proof.
] as const;
```

**Teresa's actual whitelist** — the real enforcement mechanism, mirroring
KPI-E006's own proof exactly. Only 2 imports:

```typescript
import { recordRoiPirTeresaLessonsDraft } from '../resultsVnext/roi/roiPirCommands.js'; // NEW, ROI-E008
import { getRoiPostInvestmentReview } from '../resultsVnext/roi/roiPirRepository.js';   // ROI-E006, read-only
```

### A2. The generation call

**Advisor context builder** (`teresaCopilotService.ts`, mirrors
`buildKpiDraftAdvisorContext`) — runs before `createProposal`. Literal
**AC-01** mechanism: reads the already-frozen, versioned payload, never
queries live/mutable ROI state:

```typescript
export async function buildRoiPirLessonsAdvisorContext(params: {
  userId: string; organizationId: string; caseId: string; pirId: string;
}): Promise<{ reviewSnapshotPayload: RoiPirReviewSnapshotPayload; reviewSnapshotHash: string } | null> {
  const { userId, organizationId, caseId, pirId } = params;
  const pir = await getRoiPostInvestmentReview({ userId, organizationId, caseId, pirId });
  if (!pir || pir.status !== 'draft') return null;
  return { reviewSnapshotPayload: pir.reviewSnapshotPayload, reviewSnapshotHash: pir.reviewSnapshotHash };
}
```

Teresa cites `reviewSnapshotHash`/`sequenceNumber` in `evidence_pointers` —
this is **AC-02**: the resulting draft is traceably grounded in a specific,
hashed, versioned snapshot, never a live, un-pinned re-query.

**Dispatcher + handler** (added to `performHandoff`'s switch, after
`case 'kpi':`):

```typescript
case 'roi':
  return handleResultsRoiHandoff(proposalId, organizationId, userId, handoffContext, targetPayload);
```

```typescript
async function handleResultsRoiHandoff(
  proposalId: string, organizationId: string, userId: string,
  context: TeresaHandoffContext, payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const roiContext = payload.roi_handoff_context as ResultsRoiHandoffContext | undefined;
  if (!roiContext?.advisor_mode) {
    throw new TeresaCopilotError('roi_handoff_context.advisor_mode missing', 'P08_ROI_INVALID_PAYLOAD');
  }
  switch (roiContext.advisor_mode) {
    case 'pir_lessons_draft':
      return handleRoiPirLessonsDraft(proposalId, organizationId, userId, context, roiContext);
    default: {
      const _exhaustive: never = roiContext.advisor_mode;
      throw new TeresaCopilotError(`Unknown ROI advisor mode: ${String(_exhaustive)}`, 'P08_ROI_UNKNOWN_MODE');
    }
  }
}

async function handleRoiPirLessonsDraft(
  proposalId: string, organizationId: string, userId: string,
  context: TeresaHandoffContext, roiContext: ResultsRoiHandoffContext
): Promise<Record<string, unknown>> {
  const draft = roiContext.pir_lessons_draft;
  if (!draft) throw new TeresaCopilotError('pir_lessons_draft payload missing', 'P08_ROI_INVALID_PAYLOAD');
  const { resource_id: pirId } = roiContext.target_resource;

  const outcome = await recordRoiPirTeresaLessonsDraft({
    pirId, caseId: roiContext.case_id, organizationId,
    expectedVersion: roiContext.expected_version,
    draftPayload: draft,
    actorUserId: userId, actorEffectiveRole: 'teresa_initiated',
    idempotencyKey: proposalId, correlationId: context.runtime_binding?.conversation_id ?? undefined,
    reason: 'Teresa pir_lessons_draft, approved by user',
  });
  await recordTeresaRoiHandoffResult(proposalId, organizationId, outcome.result.pirId);
  return {
    handoff: 'roi', advisor_mode: 'pir_lessons_draft', pir_id: outcome.result.pirId,
    case_id: outcome.result.caseId, row_version: outcome.resultingVersion,
    real_entity: true, outcome: outcome.outcome, draft,
  };
}

async function recordTeresaRoiHandoffResult(proposalId: string, organizationId: string, resultRef: string): Promise<void> {
  await dbRun(
    `INSERT INTO teresa_handoff_results (id, proposal_id, organization_id, target_module, result_ref, created_at)
     VALUES (?, ?, ?, 'roi', ?, ?)`,
    [randomUUID(), proposalId, organizationId, resultRef, new Date().toISOString()],
    { fallback: true }
  );
}
```

Reuses `teresa_handoff_results` (already a real migration,
`target_module TEXT NOT NULL`, free-text column) — no new migration for the
audit table, just a new value (`'roi'`).

**The write command** — new export appended to
`server/src/services/resultsVnext/roi/roiPirCommands.ts`, reusing the
existing private `loadRoiPirForUpdate`/`pirRowVersion` helpers:

```typescript
export interface RecordRoiPirTeresaLessonsDraftInput {
  pirId: string; caseId: string; organizationId: string; expectedVersion: number;
  draftPayload: Record<string, unknown>;
  actorUserId: string; actorEffectiveRole: string; idempotencyKey: string;
  correlationId?: string; causationId?: string | null; reason?: string | null;
}

export async function recordRoiPirTeresaLessonsDraft(
  input: RecordRoiPirTeresaLessonsDraftInput
): Promise<AtomicCommandOutcome<RoiPostInvestmentReview>> {
  const { pirId, caseId, organizationId, expectedVersion, draftPayload, actorUserId,
    actorEffectiveRole, idempotencyKey, correlationId, causationId = null, reason = null } = input;

  let beforeState: Record<string, unknown> | null = null;

  return executeAtomicCommand<RoiPostInvestmentReviewRow, RoiPostInvestmentReview>({
    organizationId, aggregateId: pirId, expectedVersion,
    loadForUpdate: loadRoiPirForUpdate, getCurrentVersion: pirRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      if (currentRow.case_id !== caseId) throw new RoiPirNotFoundError(caseId);
      if (currentRow.status !== 'draft') {
        throw new RoiPirValidationError(
          `PIR ${pirId} is "${currentRow.status}" — Teresa may only draft lessons while the PIR is a draft`,
          'NOT_EDITABLE', { pirId, status: currentRow.status }
        );
      }
      // Decision D6/D13: block regeneration after a human already disposed of a prior draft.
      if (currentRow.teresa_draft_disposition !== null) {
        throw new RoiPirValidationError(
          `PIR ${pirId} already has a recorded Teresa draft disposition ("${currentRow.teresa_draft_disposition}") — regenerating would silently invalidate a human decision`,
          'DISPOSITION_ALREADY_RECORDED', { pirId }
        );
      }
      beforeState = { pir: toRoiPostInvestmentReview(currentRow) };
      const updateResult = await client.query<RoiPostInvestmentReviewRow>(
        `UPDATE rvn_roi_post_investment_reviews
            SET teresa_draft_lessons_payload = $1, teresa_draft_generated_at = now(),
                row_version = $2, updated_by = $3, updated_at = now()
          WHERE pir_id = $4
          RETURNING *`,
        [JSON.stringify(draftPayload), nextVersion, actorUserId, pirId]
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error(`[recordRoiPirTeresaLessonsDraft] update returned no row for ${pirId}`);
      return toRoiPostInvestmentReview(updatedRow);
    },
    buildEvent: ({ result, nextVersion }) => ({
      schemaVersion: 1, eventType: 'roi.pir_teresa_lessons_draft_recorded',
      aggregateType: 'roi_case', aggregateId: caseId, organizationId, actorUserId, actorEffectiveRole,
      commandId: randomUUID(), correlationId: correlationId ?? randomUUID(), causationId,
      occurredAt: new Date().toISOString(), policyVersion: '',
      beforeState, afterState: { pir: result }, stateHash: computeStateHash({ pir: result }),
      reason, evidenceRefs: [], source: ROI_EVENT_SOURCE, idempotencyKey,
      expectedVersion, resultingVersion: nextVersion, payload: { caseId, pirId },
    } satisfies AtomicEventInput),
  });
}
```

**AC-06** satisfied for free — `executeAtomicCommand` already provides
CAS + idempotency-key-deduplicated, append-only writes into
`rvn_platform_events`. No new event-log infrastructure; only a test proving
this command doesn't bypass it.

**Migration** (Decision D8), additive-only, `CREATE OR REPLACE FUNCTION`
only — no `DROP`/`CREATE TRIGGER` needed:

```sql
-- server/migrations/20260821_rvn_roi_pir_teresa_draft_freeze.sql
CREATE OR REPLACE FUNCTION rvn_roi_pir_protect_frozen()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.started_by IS DISTINCT FROM OLD.started_by
     OR NEW.started_at IS DISTINCT FROM OLD.started_at
     OR NEW.review_snapshot_payload IS DISTINCT FROM OLD.review_snapshot_payload
     OR NEW.review_snapshot_hash IS DISTINCT FROM OLD.review_snapshot_hash
     OR NEW.case_id IS DISTINCT FROM OLD.case_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
  THEN
    RAISE EXCEPTION 'rvn_roi_post_investment_reviews: pir % review snapshot facts are immutable', OLD.pir_id
      USING ERRCODE = '23001';
  END IF;

  IF OLD.status = 'finalized' THEN
    IF NEW.outcome IS DISTINCT FROM OLD.outcome
       OR NEW.lessons_learned IS DISTINCT FROM OLD.lessons_learned
       OR NEW.recommendation IS DISTINCT FROM OLD.recommendation
       OR NEW.open_variance_waiver_reason IS DISTINCT FROM OLD.open_variance_waiver_reason
       OR NEW.teresa_draft_disposition IS DISTINCT FROM OLD.teresa_draft_disposition
       OR NEW.teresa_draft_lessons_payload IS DISTINCT FROM OLD.teresa_draft_lessons_payload
       OR NEW.teresa_draft_generated_at IS DISTINCT FROM OLD.teresa_draft_generated_at
    THEN
      RAISE EXCEPTION 'rvn_roi_post_investment_reviews: pir % is finalized', OLD.pir_id USING ERRCODE = '23001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- No DROP/CREATE TRIGGER — trg_rvn_roi_pir_protect_frozen (ROI-E006 migration)
-- already binds this function name; CREATE OR REPLACE FUNCTION is sufficient.
```

**`undoProposal`** — add, above the generic module check, same shape as
the existing `kpi` block:

```typescript
if (row.target_module === 'roi') {
  throw new TeresaCopilotError(
    'Undo is not supported for ROI handoffs (recordRoiPirTeresaDraftDisposition with disposition:"rejected" is the correct way to discard an unwanted draft).',
    'P08_UNDO_NOT_SUPPORTED', 409
  );
}
```

### A3. Anti-mutation proof

**Static test** — `tests/resultsVnext/teresa-roi-forbidden-verbs.test.ts`,
structurally identical to the KPI equivalent:

1. `grep -nE "from '\.\./resultsVnext/roi/" server/src/services/v8/teresaCopilotService.ts` — expect exactly the 2 import lines from A1, nothing else.
2. `grep` for every verb in the (fully re-grepped, per D16) `P08_ROI_FORBIDDEN_VERBS` list against `teresaCopilotService.ts`/`teresaCopilotCanon.ts` — expect zero matches.
3. `readFileSync` on `roiPirCommands.ts`, regex the `recordRoiPirTeresaLessonsDraft` function body's `UPDATE ... SET` clause — assert it contains only `teresa_draft_lessons_payload`/`teresa_draft_generated_at`/`row_version`/`updated_by`/`updated_at`, never `outcome`/`lessons_learned`/`recommendation`/`open_variance_waiver_reason`.

**Behavioral test (realDB)**:
`tests/resultsVnext/roi/teresaPirLessonsDraft.realdb.test.ts`:
1. Start a PIR (reuse ROI-E006's own test setup).
2. Run the full P08 handoff → assert `lessons_learned` unchanged, only the two Teresa columns change.
3. Separately call `recordRoiPirTeresaDraftDisposition({ disposition: 'accepted', finalLessonsText: ... })` → assert `lessons_learned` **now** updates — proves the 2-gate structure is real (literal AC-03 proof).
4. Attempt `closeRoiCase` with a draft generated but no disposition recorded → assert `PIR_INCOMPLETE` still fires, proving ROI-E008 doesn't weaken ROI-E006's own gate.
5. D6/D13 proof: attempt a second `recordRoiPirTeresaLessonsDraft` after a disposition was recorded → assert `DISPOSITION_ALREADY_RECORDED`.

---

## 3. HALF B — Legacy/Ops

### B0. Legacy inventory (re-verified, confirmed accurate)

| Table | PK col | Verified live writer | Owning surface |
|---|---|---|---|
| `analysis_financials` | `id` | `economics.routes.ts` (POST/PUT) — **re-confirm exact line at implementation time, D16** | Initiatives module `/roi` |
| `digitization_analyses` | `id` | `economics.routes.ts:28` `INSERT` | Initiatives module `/roi` |
| `initiative_benefits` | `id` | `benefitsRegister.routes.ts`, `finance-statements.routes.ts`, `v8/results.routes.ts` (POST) | Legacy Benefits |
| `roi_assumptions` | `id` | `benefits.routes.ts:1449`, `v8/results.routes.ts:3098` `INSERT` | Results V8 `/api/v8/results/roi/*` |
| `roi_realized_values` | `id` | `benefits.routes.ts:1527` `INSERT` | Results V8, append-only |
| `benefits_register` | `id` (TEXT) | `benefitsRegister.routes.ts` (POST) | Benefits Register (M14→M15) |
| `v8_roi_realization_entries` | `entry_id` (not `id`) | `resultsROIService.ts:501` `INSERT` | V8 Results/ROI Continuity |

`v8_roi_realization_entries` exists in both `public.` and `v8.` schemas —
same ambiguity KPI-E007's D1 resolved. **Same resolution applies**: query
unqualified, matching `resultsROIService.ts`'s own unqualified query style
exactly.

**Explicitly excluded**: `v8_kpi_definitions` (KPI-domain, already archived
by KPI-E007, D10), Finance core tables (live, D06 seam only, not legacy),
`rvn_roi_finance_links`/`rvn_roi_finance_reconciliations` (ROI-E007's own
new vNext tables, confirmed by D11/D15, not legacy), scorecard tables
(out of scope per KPI-E007's own D2, unrelated to ROI).

### B1. GET-only legacy archive router

New file `server/src/routes/resultsVnext/roiLegacyArchive.routes.ts`,
reusing `denyMutations` **verbatim, unchanged** from
`server/src/middleware/readOnlyGuard.middleware.ts` — zero edits to that
file. Read the actual landed `kpiLegacyArchive.routes.ts` directly for the
real middleware-mounting shape (it deviated from its own design doc's
pseudocode — Express 5's `router.use(denyMutations)` instead of
`router.all('*', ...)`, and `validateParams`/`validateQuery` middleware
instead of inline `.parse()` — replicate what's actually landed, not the
KPI design doc's illustrative sketch).

```
GET /api/vnext/results/roi/legacy                                  -- index (7 rows, fixed order)
GET /api/vnext/results/roi/legacy/analysis-financials[/:legacyId]
GET /api/vnext/results/roi/legacy/digitization-analyses[/:legacyId]
GET /api/vnext/results/roi/legacy/initiative-benefits[/:legacyId]
GET /api/vnext/results/roi/legacy/roi-assumptions[/:legacyId]
GET /api/vnext/results/roi/legacy/roi-realized-values[/:legacyId]
GET /api/vnext/results/roi/legacy/benefits-register[/:legacyId]
GET /api/vnext/results/roi/legacy/v8-roi-realization-entries[/:legacyId]
```

**Labeling (AC-05, Decision D14 — 4-bucket scheme, confirmed)**:

```typescript
type OriginDomain =
  | 'initiatives_module_live'  // analysis_financials, digitization_analyses
  | 'results_v8_live'          // roi_assumptions, roi_realized_values, v8_roi_realization_entries
  | 'finance_benefits_live';   // initiative_benefits, benefits_register
```

| sourceTable | originDomain | label |
|---|---|---|
| `analysis_financials` | `initiatives_module_live` | "Initiatives module `/roi` — live, external to Results vNext" |
| `digitization_analyses` | `initiatives_module_live` | "Initiatives module `/roi` — live, external to Results vNext" |
| `roi_assumptions` | `results_v8_live` | "Results V8 `/api/v8/results/roi` — live, external to Results vNext" |
| `roi_realized_values` | `results_v8_live` | "Results V8 `/api/v8/results/roi` — live, external to Results vNext" |
| `v8_roi_realization_entries` | `results_v8_live` | "Results V8 ROI Continuity — live, external to Results vNext" |
| `initiative_benefits` | `finance_benefits_live` | "Legacy Benefits (initiative_benefits) — live, external to Results vNext" |
| `benefits_register` | `finance_benefits_live` | "Benefits Register (M14→M15) — live, external to Results vNext" |

Response envelope, 404 shape, index-endpoint shape: identical to KPI-E007's
`LegacyArchiveMeta`/`LegacyArchiveListResponse`/`LegacyArchiveItemResponse`
— reuse the type shapes, do not reinvent them.

**Repository** — `server/src/services/resultsVnext/roi/roiLegacyArchiveRepository.ts`,
same shape as `kpiLegacyArchiveRepository.ts`. Simpler than KPI's — all 7
tables have `organization_id` directly, no join-through-two-tables case.
One irregularity: `v8_roi_realization_entries`'s PK is `entry_id`, not
`id` — filter `WHERE entry_id = $2`. Zero imports from any `*Commands.ts`
file; table names hardcoded per function, never interpolated from a
runtime argument.

**Validators** — new `server/src/validators/resultsVnextRoiLegacy.validators.ts`,
same shape as the KPI equivalent, permissive non-UUID `legacyId` (several
of these tables' PKs are TEXT, not guaranteed UUID-shaped).

**Gateway mount**, same ordering discipline as KPI's (`/legacy` before the
generic prefix):

```typescript
import resultsVnextRoiLegacyArchiveRoutes from './routes/resultsVnext/roiLegacyArchive.routes.js';
// ...
app.use('/api/vnext/results/roi/legacy', resultsVnextRoiLegacyArchiveRoutes);
app.use('/api/vnext/results/roi', resultsVnextRoiPerspectivesRoutes); // existing
app.use('/api/vnext/results/roi', resultsVnextRoiRoutes);             // existing
```

### B2. Contract test — read-model isolation

New file `tests/resultsVnext/roi/legacyIsolation.realdb.test.ts`, same
skeleton as KPI-E007's own (`DB_CONFIGURED` skip-gate, raw `pg.Client`,
control+poison+assert+cleanup):

1. Seed one real, visible ROI Case+Baseline+Approval.
2. Poison: raw `pg.Client` INSERT into all 7 legacy tables, same
   `organization_id`, similar-looking names.
3. Negative assertion: no poisoned row surfaces via `roiRepository`/
   `roiOrgPerspectiveRepository` reads.
4. Positive assertion: the control Case must appear.
5. **Static half**: `readFileSync` on every file under
   `server/src/services/resultsVnext/roi/*Repository.ts`, regex with word
   boundaries for all 7 legacy table names — assert zero matches (does not
   match `rvn_roi_*`). Literal AC-05 proof.
6. Cleanup regardless of pass/fail.

### B3. Physical write-denial

New file `tests/resultsVnext/roi/roiLegacyArchive.routes.test.ts`, mount
the real router (supertest), send POST/PUT/PATCH/DELETE to all 15 route
paths → assert `405`/`LEGACY_ARCHIVE_READ_ONLY` (60 assertions), plus a
static `readFileSync` regex for zero `router.post/put/patch/delete`.
Literal AC-04 proof; reuses `denyMutations` completely unchanged.

### B4. Monitoring

No new dashboard. One new counter in `server/src/services/metricsService.ts`:

```typescript
export const resultsVnextRoiLegacyArchiveHitsTotal = new Counter({
  name: 'results_vnext_roi_legacy_archive_hits_total',
  help: 'Requests served by the ROI legacy archive read-only adapter, by source table',
  labelNames: ['source_table'],
});
```

---

## 4. File list (backend only)

**New:**
- `server/migrations/20260821_rvn_roi_pir_teresa_draft_freeze.sql`
- `server/src/routes/resultsVnext/roiLegacyArchive.routes.ts`
- `server/src/services/resultsVnext/roi/roiLegacyArchiveRepository.ts`
- `server/src/validators/resultsVnextRoiLegacy.validators.ts`
- `tests/resultsVnext/teresa-roi-forbidden-verbs.test.ts`
- `tests/resultsVnext/roi/teresaPirLessonsDraft.realdb.test.ts`
- `tests/resultsVnext/roi/legacyIsolation.realdb.test.ts`
- `tests/resultsVnext/roi/roiLegacyArchive.routes.test.ts`
- `tests/v8/teresa-roi-handoff.test.ts` (unit, 1 mode)

**Changed:**
- `server/src/services/v8/teresaCopilotCanon.ts` (new types, `P08_HANDOFF_TARGETS.roi`, `P08_HANDOFF_TARGET_MODULES` append, `P08_ROI_FORBIDDEN_VERBS`)
- `server/src/services/v8/teresaCopilotService.ts` (2 imports, `case 'roi':` in `performHandoff`, `case 'roi'` block in `undoProposal`, `buildRoiPirLessonsAdvisorContext`/`handleResultsRoiHandoff`/`handleRoiPirLessonsDraft`/`recordTeresaRoiHandoffResult`)
- `server/src/services/resultsVnext/roi/roiPirCommands.ts` (new export `recordRoiPirTeresaLessonsDraft` + input type)
- `server/src/Gateway.ts` (import + mount, `/api/vnext/results/roi/legacy`)
- `server/src/services/metricsService.ts` (one new counter)
- `docs/product/results-vnext/EXECUTION_LEDGER.md` (closure entry, and the domain-closing note: 8/8 ROI epics built)
- `docs/product/results-vnext/EPIC_LEDGER_LIVE.md` (ROI-F rows for E008 → IMPLEMENTED)

**Read-only reference:** `readOnlyGuard.middleware.ts`,
`kpiLegacyArchive.routes.ts`/`kpiLegacyArchiveRepository.ts` (pattern
source, including their real deviations from the KPI-E007 design doc),
`roiPirRepository.ts`/`roiPirTypes.ts`, `roiCaseCommands.ts`, ROI-E007's
finance-seam files (re-confirmed, not modified).

---

## 5. Definition of done

- [ ] AC-01 proven: advisor context read grounded in `reviewSnapshotHash`/pinned payload, never a live re-query
- [ ] AC-02 proven: every legacy-archive response carries full `meta`; every Teresa output carries `evidence_pointers` citing the pinned snapshot
- [ ] AC-03 proven: the 2-step draft→dispose test; `PIR_INCOMPLETE` still blocks close with only a draft, no disposition
- [ ] AC-04 proven: 60/60 write-denial assertions + static zero-mutation-handler check
- [ ] AC-05 proven: `legacyIsolation.realdb.test.ts` static+realDB halves both pass; every legacy table correctly labeled
- [ ] AC-06 proven: idempotency-key replay of `recordRoiPirTeresaLessonsDraft` does not double-write
- [ ] `teresa-roi-forbidden-verbs.test.ts` — full re-grepped `P08_ROI_FORBIDDEN_VERBS` (all command files, per D16), zero matches in Teresa's own files
- [ ] `tsc --noEmit` clean on the whole repo
- [ ] Full existing KPI + ROI-E001-E007 test suite still green — before/after evidence, matching every prior epic's discipline
- [ ] `EXECUTION_LEDGER.md` closure entry + `EPIC_LEDGER_LIVE.md` ROI-E008 rows → IMPLEMENTED + "8/8 ROI epics built" domain-closing note
