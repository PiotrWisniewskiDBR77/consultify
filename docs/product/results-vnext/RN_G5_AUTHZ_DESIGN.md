# RN-G5 — Results Next command-layer authorization

Status: **implemented for all 38 write-command files across KPI (6/6), ROI (19/19),
OKR (13/13)** — every command file under `server/src/services/resultsVnext/{kpi,roi,okr}/`
that has its own `*Commands.ts` naming and is route-callable is now gated, except
the deliberately-documented capability-only-skipped/team-wide exceptions in §6.

Base SHA: `35a1dee6c03b66907219b5b645e4e3ecb267f80a`. Branch `rn-g5-authz`,
worktree `/Users/piotrwisniewski/rn-g2-lanes/g5-authz`. This revision (HEAD
`27e3ecd70b`) is written by the session that closed out the final 3 KPI files
(corrective actions, initiative impacts, scorecards) plus one audit-found gap
fix (`reopenApprovedRoiCaseForRevision`) — see §8 for exactly what changed in
this session vs. what was already on the branch.

## 1. Problem (verified in code, 2026-08-12, unchanged from the original writeup)

No write command anywhere under `server/src/services/resultsVnext/**` checked the
calling actor's authorization before mutating. `actorEffectiveRole` was threaded
through every command signature and landed only in the audit event
(`rvn_platform_events.actor_effective_role`) — recorded, never compared against
anything.

The only pre-existing protection was maker-checker ("you may not approve/close your
own case"): `SelfApprovalDeniedError` (`kpiDefinitionCommands.ts`),
`DeviationSelfApprovalDeniedError` (`kpiDeviationCommands.ts`),
`RoiSelfApprovalDeniedError` (`roiCaseApprovalCommands.ts`). That is a business rule
about who may not decide a SPECIFIC case, not an authorization check about who may
call the command family at all. A total stranger with zero relationship to a KPI
could approve its corrective plan, verify/dispute/correct any measurement, approve
any ROI case, publish someone else's scorecard review snapshot, etc. — tenant
isolation (`verifyToken` + `requireOrgAccess()`) held, so this was a
within-organization privilege-escalation gap, not a cross-tenant one.

## 2. Decision (owner's, implemented literally — unchanged)

A write command's access rule:

**ALLOW** iff at least one holds:
1. `hasEffectiveCapability(access, <capability>)` is true. Covers
   SUPERADMIN/OWNER/ADMIN (they hold `'*'`) and any regular member explicitly
   granted the capability.
2. The actor is one of the record's own designated responsible people — read off
   the row already loaded inside `applyMutation`.

**DENY** otherwise, via a single non-leaking error class
(`CommandCapabilityDeniedError`, code `COMMAND_CAPABILITY_DENIED`, generic message,
`details = { capability }` only, server-log-only — never revealed to the caller
beyond the 403).

Maker-checker stays a SEPARATE, ADDITIONAL check, run AFTER this guard.

## 3. The guard — `server/src/services/resultsVnext/platform/commandCapabilityGuard.ts`

Unchanged this session (out of allowlist to modify):

```ts
export type CommandAccessContext = Pick<AccessContext, 'capabilities' | 'platformRole'>;
export type CommandAccessDecision = 'ALLOW' | 'DENY';

export function evaluateCommandAccess(params: {
  access: CommandAccessContext;
  actorUserId: string;
  capability: string;
  responsibleUserIds?: Array<string | null | undefined>;
}): CommandAccessDecision;

export class CommandCapabilityDeniedError extends Error { code = 'COMMAND_CAPABILITY_DENIED'; details: { capability: string }; }

export function assertCommandCapability(params: EvaluateCommandAccessParams): void; // throws on DENY
```

`hasEffectiveCapability`/`resolveEffectiveAccess` are REUSED from
`effectiveAccessService.ts` (never modified — out of allowlist).

**Ordering: RBAC gate FIRST, maker-checker self-approval SECOND**, inside every
`applyMutation`, before any read/write past the row lock `loadForUpdate` already
took (or, for a CREATE with no lock, before the INSERT). Rationale: the RBAC gate
answers "can this actor touch this command family at all" — a coarse authorization
question that must be answered, and answered with a GENERIC denial, before anything
about the specific record's business state (including who submitted/created it) is
allowed to shape the error an unauthorized caller receives. Checking self-approval
first would let a total stranger who submitted nothing trigger a
`SELF_APPROVAL_DENIED`-shaped response by process of elimination, and would run
self-approval's own row comparisons for an actor never authorized to be evaluated
in the first place.

Verified empirically, twice, on real Postgres, that removing the guard call turns a
passing "stranger gets 403" test red with the specific message "promise resolved
{...} instead of rejecting" (§5), and that with the guard restored,
`approveOkrSetManagerReview`/`approvePlan`-shaped commands called by the record's
own responsible person who ALSO submitted the thing being approved still throw the
domain's own self-approval error, not the generic capability one — proving
maker-checker fires ON TOP of a passing RBAC gate, not instead of it
(`rnG5CommandCapabilityGuardOkrRoi.security.realdb.test.ts`'s own
"maker-checker STAYS on top of the RBAC gate" test, unchanged this session).

## 4. Command → capability → responsible-source → guard-site table (all 38 files)

Convention read for every row below: **"responsible source"** is where the guard's
`responsibleUserIds` array is populated from — either fields already on the
`currentRow` loaded by `loadForUpdate`, or an extra `SELECT` this session/a prior
one added specifically to resolve the record's real owner (documented per-row where
it isn't obvious). "—" in that column means capability-only (no responsible-people
fallback — usually because no record exists yet).

### 4.1 KPI (`server/src/services/resultsVnext/kpi/`) — 6/6 files gated

#### `kpiDefinitionCommands.ts` (prior session, unchanged this session)

| Command | Capability | Responsible source | Guard site |
|---|---|---|---|
| `createKpiDraft` | — | — | **NOT GATED, documented exception, §6.1** |
| `editDraft` | `results.kpi.definition.edit_draft` | KPI's `owner_user_id` (fresh `SELECT`, `loadKpiOwnerUserId`) + version's own `created_by` | L~528 |
| `submitDefinition` | `results.kpi.definition.submit` | KPI's `owner_user_id` + version's `created_by` | L~669 |
| `approveDefinitionVersion` | `results.kpi.definition.approve` | KPI's `owner_user_id` only | L~802 (before self-approval) |
| `rejectDefinitionVersion` | `results.kpi.definition.reject` | KPI's `owner_user_id` only | L~929 |
| `activateKpi` | `results.kpi.definition.activate` | `rvn_kpi_definitions.owner_user_id` (direct, same row) | L~1060 (shared `runKpiLifecycleTransition`) |
| `suspendKpi` | `results.kpi.definition.suspend` | same | same |
| `archiveKpi` | `results.kpi.definition.archive` | same | same |

#### `kpiDeviationCommands.ts` (prior session, unchanged this session) — all 10 route-callable commands

| Command | Capability | Responsible source | Guard site |
|---|---|---|---|
| `acknowledgeDeviationCase` | `results.kpi.deviation.acknowledge` | `owner_user_id`, `manager_user_id` | L~558 |
| `submitRootCause` | `results.kpi.deviation.submit_root_cause` | `owner_user_id`, `manager_user_id` | L~650 |
| `submitPlan` | `results.kpi.deviation.submit_plan` | `owner_user_id`, `manager_user_id` | L~760 |
| `approvePlan` | `results.kpi.deviation.approve_plan` | `owner_user_id`, `manager_user_id` | L~863 (before self-approval) |
| `recordRecoveryObservation` | `results.kpi.deviation.record_recovery_observation` | `owner_user_id`, `manager_user_id` | L~959 |
| `submitEffectivenessVerification` | `results.kpi.deviation.submit_effectiveness_verification` | `owner_user_id`, `manager_user_id` | L~1070 |
| `closeDeviationCase` | `results.kpi.deviation.close` | `owner_user_id`, `manager_user_id` | L~434 |
| `escalateDeviationCase` | `results.kpi.deviation.escalate` | `owner_user_id`, `manager_user_id` | shared `runEscalationOverlay`, L~1185 |
| `deescalateDeviationCase` | `results.kpi.deviation.deescalate` | same | same |
| `reopenDeviationCase` | `results.kpi.deviation.reopen` | prior case's `owner_user_id`, `manager_user_id` | L~1327 |

`openOrEscalateDeviationCase` is NOT gated — not a route-callable top-level command;
runs inside `recordMeasurement`'s/`correctMeasurement`'s own transaction, under
that command's own actor/guard (§6.3).

#### `kpiMeasurementCommands.ts` (prior session, unchanged this session) — verify/dispute/correct only (task scope)

| Command | Capability | Responsible source | Guard site |
|---|---|---|---|
| `verifyMeasurement` | `results.kpi.measurement.verify` | KPI's `owner_user_id` (fresh lookup, `loadKpiOwnerUserId`, NO actor fallback) | shared `insertSupersedingMeasurement`, L~329 |
| `disputeMeasurement` | `results.kpi.measurement.dispute` | same | same |
| `correctMeasurement` | `results.kpi.measurement.correct` | same | same |
| `recordMeasurement` | — | — | **explicitly out of scope, §6.2** |

#### `kpiCorrectiveActionCommands.ts` — **THIS SESSION, new**

| Command | Capability | Responsible source | Guard site |
|---|---|---|---|
| `addCorrectiveAction` | `results.kpi.deviation.corrective_action.add` | PARENT deviation case's `owner_user_id`, `manager_user_id` (case row loaded with `FOR UPDATE`, select widened to include both columns) | L138 |
| `updateCorrectiveAction` | `results.kpi.deviation.corrective_action.update` | the action's OWN `owner_user_id` (`CorrectiveActionRow` already carries one — deliberately NOT also the parent case's owner/manager, since the action's designated owner is who is actually doing/updating the work) | L272 |

#### `kpiInitiativeImpactCommands.ts` — **THIS SESSION, new**

This table has no `owner_user_id`/`manager_user_id` of its own (design §C: it
inherits visibility, not ownership, from `kpi_id`) — every command resolves the
OWNING KPI's `owner_user_id` via a local `loadKpiOwnerUserId(client, kpiId)` helper
(a fresh copy, same "no actor fallback" contract as the identically-named helpers
in `kpiDefinitionCommands.ts`/`kpiMeasurementCommands.ts` — each file keeps its own
copy by this program's established convention, not a shared import).

| Command | Capability | Responsible source | Guard site |
|---|---|---|---|
| `proposeInitiativeKpiImpact` | `results.kpi.initiative_impact.propose` | owning KPI's `owner_user_id` (`kpiId` is a known input — the KPI already exists, so this is "lock/read the parent, check its responsible people", same shape as `addScorecardItem`, NOT a `createKpiDraft`-style capability-only exception) | L204 |
| `commitInitiativeKpiImpact` | `results.kpi.initiative_impact.commit` | owning KPI's `owner_user_id` (via `currentRow.kpi_id`) | L371 |
| `recordReviewedAttribution` | `results.kpi.initiative_impact.review` | owning KPI's `owner_user_id` | L542 (before self-approval — `InitiativeKpiImpactSelfApprovalDeniedError` when `reviewedBy === committed_by`) |
| `supersedeInitiativeKpiImpact` | `results.kpi.initiative_impact.supersede` | owning KPI's `owner_user_id` | L681 |

**Route wiring (this session):** `kpiPerspectives.routes.ts` did NOT previously call
`resolveEffectiveAccess` at all for these 4 endpoints — added a `resolveAccess()`
helper (identical shape to `kpiDeviation.routes.ts`'s) and wired it into all 4
POST handlers, including the nested `replacementInput.access` field
`supersedeInitiativeKpiImpact` needs (its `replacementInput` type is
`Omit<ProposeInitiativeKpiImpactInput, 'organizationId' | 'kpiId' | 'initiativeId'>`,
which still includes `access` since it wasn't in the omitted-keys list).

#### `kpiScorecardCommands.ts` — **THIS SESSION, new — the most consequential of the 3**

Before this session: **zero gating of any kind** — no `access` parameter existed
anywhere in this file, and the route (`kpiScorecard.routes.ts`) never called
`resolveEffectiveAccess`. Any authenticated org member could create/mutate any
scorecard and, critically, **publish anyone's draft review snapshot** — turning a
private-in-progress review into the org's visible "official" scorecard state.

| Command | Capability | Responsible source | Guard site |
|---|---|---|---|
| `createScorecard` | `results.kpi.scorecard.create` | — (capability-only; no scorecard exists yet, but UNLIKE `createKpiDraft` this one IS gated — no e2e/Teresa-flow breakage found, and the two editable real-Postgres fixtures that call it were updated with wildcard access, see §7) | L218 |
| `addScorecardItem` | `results.kpi.scorecard.item.add` | scorecard's own `owner_user_id` (`currentRow`, already `FOR UPDATE`-locked) | L387 |
| `removeScorecardItem` | `results.kpi.scorecard.item.remove` | scorecard's own `owner_user_id` | L515 |
| `reorderScorecardItems` | `results.kpi.scorecard.item.reorder` | scorecard's own `owner_user_id` | L623 |
| `activateScorecard` | `results.kpi.scorecard.activate` | scorecard's own `owner_user_id` | shared `runScorecardLifecycleTransition`, L735 |
| `suspendScorecard` | `results.kpi.scorecard.suspend` | same | same |
| `archiveScorecard` | `results.kpi.scorecard.archive` | same | same |
| `createReviewSnapshot` | `results.kpi.scorecard.review.create` | PARENT scorecard's `owner_user_id` (the `SELECT lifecycle_status FROM rvn_kpi_scorecards` existence/archived check was widened to also select `owner_user_id`) | L907 |
| `publishReviewSnapshot` | `results.kpi.scorecard.review.publish` | PARENT scorecard's `owner_user_id`, resolved via a NEW extra `SELECT owner_user_id FROM rvn_kpi_scorecards WHERE scorecard_id = $1` keyed on `currentRow.scorecard_id` (the snapshot row's OWN, already-locked true parent — deliberately NOT the caller-supplied `scorecardId` input, which may not even match; that mismatch is exactly what the very next check, `SCORECARD_MISMATCH`, catches — authorization must not depend on an as-yet-unverified caller claim) | L1070, before the `SCORECARD_MISMATCH`/`NOT_A_DRAFT` checks |

**Route wiring (this session):** `kpiScorecard.routes.ts` gained a `resolveAccess()`
helper (imports `resolveEffectiveAccess`) and a `CommandCapabilityDeniedError` -> 403
branch in `handleScorecardRouteError`, wired into all 9 write endpoints
(create/addItem/removeItem/reorder/activate/suspend/archive/createReviewSnapshot/
publishReviewSnapshot).

### 4.2 ROI (`server/src/services/resultsVnext/roi/`) — 19/19 files gated (prior session, one bug found and fixed this session)

Extracted directly from source via a line-numbered scan of every
`assertCommandCapability(` call site across all 19 files (not hand-copied from an
older doc draft — the previous version of this document was written after only 11
of the eventual ~44 commits and never covers ROI's actual final 19-file/~60-command
surface).

| File | Command(s) with own guard call | Capability(ies) | Responsible source |
|---|---|---|---|
| `roiActualEntryCommands.ts` | `insertSupersedingActualEntry` (shared, backs `correctActualEntry`/`disputeActualEntry`), `verifyActualEntry` | `.correct`/`.dispute`/`.verify` | case owner (`caseOwnerUserId`) |
| `roiActualSnapshotCommands.ts` | `publishRoiActualSnapshot` | `.publish` | `currentRow.owner_user_id` |
| `roiAssumptionCommands.ts` | shared `assertCaseEditableForUpdate` (backs `addAssumption`/`updateAssumption`/`removeAssumption`) | `.add`/`.update`/`.remove` (passed in via `auth.capability`) | `caseRow.owner_user_id` |
| `roiBaselineCommands.ts` | `captureOrUpdateBaseline` | `.capture_or_update` | `caseOwnerUserId`, `currentRow.owner_user_id` |
| `roiBenefitEvidenceLinkCommands.ts` | shared `assertCaseEditableForUpdate` (add/remove), `flagBenefitEvidenceLinkDisputed`, `flagEvidenceLinkFreshnessCheck` | `.add`/`.remove`/`.flag_disputed`/`.flag_freshness` | case owner (fresh lookup for the two `flag*` commands) |
| `roiBenefitLineCommands.ts` | shared `assertCaseEditableForUpdate` (add/update/remove) | `.add`/`.update`/`.remove` | `caseRow.owner_user_id` |
| `roiBenefitsRealizationCommands.ts` | `startRoiCaseBenefitsRealization`, `cancelRoiCase` | `.start`, `results.roi.case.cancel` | `currentRow.owner_user_id` |
| `roiCalculationPolicyCommands.ts` | `captureOrUpdateCalculationPolicy` | `.capture_or_update` | `caseStatusRow.owner_user_id`, `currentRow.owner_user_id` |
| `roiCalculationRunCommands.ts` | `createRoiCalculationRun` | `.create` | `caseRow.owner_user_id` |
| `roiCaseApprovalCommands.ts` | `submitRoiCaseForApproval`, `approveRoiCase`, `rejectRoiCase`, `requestChangesOnRoiCase`, `reopenApprovedRoiCaseForRevision` | `.submit_for_approval`/`.approve`/`.reject`/`.request_changes`/`.reopen_for_revision` | `currentRow.owner_user_id` (all 5) |
| `roiCaseCommands.ts` | `createRoiCase` (— , documented exception §6.1), `updateRoiCaseDetails`, `archiveRoiCase`, `runRoiCaseLifecycleTransition` (backs `startModeling`/`markReadyForReview`/`reopenFromRejected`) | `.update_details`/`.archive`/transition-specific | `currentRow.owner_user_id` |
| `roiCostLineCommands.ts` | shared `assertCaseEditableForUpdate` (add/update/remove) | `.add`/`.update`/`.remove` | `caseRow.owner_user_id` |
| `roiFinanceLinkCommands.ts` | shared `assertCaseEditableForUpdate` (create/remove) | `.create`/`.remove` | `caseRow.owner_user_id` |
| `roiFinanceReconciliationCommands.ts` | `openRoiFinanceReconciliation`, `updateRoiFinanceReconciliationStatus` | `.open`, `.update_status` | `caseOwnerUserId` |
| `roiForecastVersionCommands.ts` | `createRoiForecastVersion` | `.create` | `currentRow.owner_user_id` |
| `roiPirCommands.ts` | `scheduleRoiCasePostInvestmentReview`, `markRoiCasePostInvestmentReviewDue`, `startRoiCasePostInvestmentReview`, `updateRoiPostInvestmentReviewDraft`, `recordRoiPirTeresaDraftDisposition`, `recordRoiPirTeresaLessonsDraft`, `closeRoiCase` | `.schedule`/`.mark_due`/`.start`/`.update_draft`/`.record_teresa_disposition`/`.record_teresa_lessons_draft`/`results.roi.case.close` | case owner throughout |
| `roiScenarioCommands.ts` | shared `assertCaseEditableForUpdate` (add/update/remove/setOverride/removeOverride) | `.add`/`.update`/`.remove`/`.set_override`/`.remove_override` | `caseRow.owner_user_id` |
| `roiTrackingCommands.ts` | `startRoiCaseTracking` | `.start` | `currentRow.owner_user_id` |
| `roiVarianceCommands.ts` | `recordVariance`, `updateVarianceStatus`, `addVarianceCause`, `removeVarianceCause` | `.record`/`.update_status`/`.add_cause`/`.remove_cause` | case owner + (for cause commands) `varianceRow.owner_user_id` |

**Bug found and fixed this session** (§8.3): `roiCaseApprovalCommands.ts`'s
`reopenApprovedRoiCaseForRevision` accepted `access: CommandAccessContext` in its
own input type, and its route already resolved and passed a real one — but the
function body never called `assertCommandCapability`. The previous draft of this
document's table claimed "5 of 5 commands in this file gated"; that claim was
false for this one command until this session's fix (L924, guard before the status
check, `responsibleUserIds: [currentRow.owner_user_id]`, capability
`results.roi.case.reopen_for_revision` — the constant already existed, unused).

### 4.3 OKR (`server/src/services/resultsVnext/okr/`) — 13/13 files gated (prior session, unchanged this session)

| File | Command(s) | Capability(ies) | Responsible source |
|---|---|---|---|
| `okrAlignmentCommands.ts` | `proposeAlignment`, `acceptAlignment`, `rejectAlignment`, `removeAlignment` | `.propose`/`.accept`/`.reject`/`.remove` | source/target Objective's `ownerUserId` |
| `okrCarryForwardCommands.ts` | `carryForwardOkrSet` | `OKR_CARRY_FORWARD_CAPABILITY` | `sourceRow.owner_user_id`, `sourceRow.reviewer_user_id` |
| `okrCheckInCommands.ts` | `recordCheckIn`, `correctCheckIn` | `.record`, `.correct` | `krRow.owner_user_id` |
| `okrCycleCommands.ts` | `createCycle` (capability-only — plain RBAC resource, no owner concept), `runOkrCycleLifecycleTransition` (backs activate/openReview/close/cancel) | `.create`, transition-specific | — / n/a (Cycle has no owner column) |
| `okrDecisionCommands.ts` | `requestDecisionFromSupportRequest`, `acknowledgeDecisionResolution` | `.request_from_support_request`, `.acknowledge_resolution` | support request's `created_by`/`assigned_to_user_id`; decision's `requested_by` |
| `okrKeyResultCommands.ts` | `createKeyResult`, `updateKeyResult`, `cancelKeyResult` | `.create`/`.update`/`.cancel` | parent Objective's `owner_user_id` (create) / KR's own `owner_user_id` (update/cancel) |
| `okrObjectiveCommands.ts` | `createObjective`, `updateObjective`, `cancelObjective` | `.create`/`.update`/`.cancel` | parent Set's `owner_user_id`+`reviewer_user_id` (create) / Objective's own `owner_user_id` (update/cancel) |
| `okrProgramCommands.ts` | `createProgram`, `editProgramDraft`, `publishProgram` | `.create`/`.edit_draft`/`.publish` | (capability-only per extraction — Program is an org-level governance resource) |
| `okrReflectionCommands.ts` | `finalScoreOkrSet`, `recordObjectiveReflection`, `recordOkrReflectionTeresaDraft`, `recordOkrReflectionTeresaDraftDisposition` | `.final_score`/`.record`/`.record_teresa_draft`/`.record_teresa_draft_disposition` | Set/Objective owner+reviewer |
| `okrReviewCommands.ts` | `submitOkrSetSelfReview`, `submitOkrSetForManagerReview`, `approveOkrSetManagerReview`, `requestChangesOnOkrSetManagerReview`, `recordOkrSetReviewComment` | `.submit_self`/`.submit_for_manager`/`.approve_manager`/`.request_changes_manager`/`.record_comment` | Set's `owner_user_id`/`reviewer_user_id` |
| `okrSetCommands.ts` | `updateOkrSetDraft`, `narrowOkrSetVisibility`, `submitOkrSetForApproval`, `approveOkrSet`, `requestChangesOnOkrSet`, `runOkrSetLifecycleTransition` (backs activate/cancel/openReview), `closeOkrSet` | `.update_draft`/`.narrow_visibility`/`.submit_for_approval`/`.approve`/`.request_changes`/transition-specific/`.close` | `currentRow.owner_user_id`/`reviewer_user_id`, varies by command |
| `okrSetMaterialChangeCommands.ts` | `recordOkrSetMaterialChange` | `OKR_SET_MATERIAL_CHANGE_CAPABILITY` | `currentRow.owner_user_id`, `currentRow.reviewer_user_id` |
| `okrSupportCommands.ts` | `postComment`, `postRecognition` (— , documented team-wide exception, §6.4), `acknowledgeSupportRequest`, `resolveSupportRequest`, `dismissSupportRequest` | —/—, `.acknowledge`/`.resolve`/`.dismiss` | `currentRow.assigned_to_user_id`, `currentRow.created_by` |

Real-Postgres security proof for 4 of these OKR commands (not just unit mocks):
`rnG5CommandCapabilityGuardOkrRoi.security.realdb.test.ts` covers
`updateOkrSetDraft`/`createObjective`/`approveOkrSetManagerReview` (stranger-403 +
owner-allow + admin-allow + the maker-checker interaction case) — 8 of the 12 tests
in that file; the other 4 cover ROI's `captureOrUpdateBaseline`.

## 5. Negative control — proving the guard is load-bearing, not decorative (this session)

Per instruction: "a green test you have never seen red is not a test." Ran this
literally against real Postgres for both a NEWLY-added-this-branch OKR command and
a NEWLY-added-this-branch ROI command (the ones this session did NOT itself write —
proving the PRIOR session's gates, not just this session's).

**What was broken:** commented out the `assertCommandCapability({...})` block (only
that block — nothing else) in:
- `okrSetCommands.ts`'s `updateOkrSetDraft` (L~543)
- `roiBaselineCommands.ts`'s `captureOrUpdateBaseline` (L~164)

**Test run:** `RUN_DB_TESTS=1 NODE_ENV=test MOCK_DB=false DATABASE_URL=... DB_TYPE=postgres
POSTGRES_SKIP_INIT_IN_TEST=1 npx vitest run
tests/resultsVnext/platform/rnG5CommandCapabilityGuardOkrRoi.security.realdb.test.ts
--no-file-parallelism`

**Before removal:** 12/12 green.

**After removal:** `2 failed | 10 passed (12)`. Exactly the two "a stranger gets
403"/"a stranger to the case is denied" tests went red — every owner-allow/
admin-allow/self-approval-interaction test in the same file stayed green (removing
a guard can only ALLOW more, never deny something it previously allowed, so this is
the expected shape of the failure). Exact message:

```
AssertionError: promise resolved "{ outcome: 'applied', …(3) }" instead of rejecting
- Error { "message": "rejected promise" }
+ { "eventId": "...", "outcome": "applied", "result": { ... } }
```

i.e. the stranger's call, which should have thrown `CommandCapabilityDeniedError`
before ever reaching the UPDATE, instead SUCCEEDED and mutated the row (the Set's
draft fields / the baseline row) — concrete proof the removed line was the only
thing standing between an unrelated org member and that mutation.

**Revert:** restored both files verbatim (the exact original text, not
retyped-from-memory). `git diff --stat` on both files: **empty** (byte-identical to
HEAD). Re-ran the same test command: **12/12 green** again.

This is evidence for the PRIOR session's OKR/ROI gates specifically (this session's
own 3 new KPI files were not independently red/green cycled this way — see §7 for
why, and see §9 for what that gap means).

## 6. What remains deliberately UNGATED (with grep evidence, not just prose)

### 6.1 `createKpiDraft` / `createRoiCase` — capability-only creates, explicitly skipped

Both documented in-code (not just here) with an identical rationale: no record
exists yet (capability-only, no owner fallback possible), the capability is not in
`APPLICATION_ROLE_BASELINE_CAPABILITIES` (out of allowlist to add), and gating was
verified to break real, currently-passing test fixtures with a large blast radius —
`tests/resultsVnext/teresa-kpi-e2e-no-silent-approval.test.ts` for the KPI case,
and (per `roiCaseCommands.ts`'s own comment) ~30 existing test files that call
`createRoiCase` as a foundational fixture step for the ROI case. Grep evidence:

```
$ grep -n "RN-G5 DECISION" server/src/services/resultsVnext/kpi/kpiDefinitionCommands.ts server/src/services/resultsVnext/roi/roiCaseCommands.ts
kpiDefinitionCommands.ts:316:      // RN-G5 DECISION (documented, not an oversight): createKpiDraft is
roiCaseCommands.ts:290:  // RN-G5 DECISION (documented, not an oversight): createRoiCase is
```

**This session's own equivalent decision went the OTHER way**: `createScorecard`
(`kpiScorecardCommands.ts`) IS gated, unlike its two siblings — verified no
comparable e2e/Teresa flow breaks (only 2 real-Postgres fixture files call it,
both editable, both updated with wildcard access, §7), so there was no reason to
carve out the same exception a third time.

### 6.2 `recordMeasurement` — out of scope per task brief, unchanged

```
$ grep -n "explicitly out of scope\|high-frequency" server/src/services/resultsVnext/kpi/kpiMeasurementCommands.ts | head -2
```
A high-frequency import/connector path; unlike verify/dispute/correct it only
creates a NEW fact, never touches an existing one someone else owns.

### 6.3 `openOrEscalateDeviationCase` — internal-only, never route-callable

```
$ grep -rn "openOrEscalateDeviationCase(" server/src/routes/resultsVnext/*.ts
(zero matches)
$ grep -rn "openOrEscalateDeviationCase(" server/src/services/resultsVnext/kpi/*.ts
kpiDeviationCommands.ts:225:export async function openOrEscalateDeviationCase(
kpiMeasurementCommands.ts:227:      await openOrEscalateDeviationCase(client, {
kpiMeasurementCommands.ts:497:      await openOrEscalateDeviationCase(client, {
```
Its only two callers are `recordMeasurement`/`correctMeasurement`, both inside
their OWN already-running `applyMutation` on the same pinned `PoolClient` (it
cannot itself call `executeAtomicCommand`/`executeAtomicCreate` — nesting a second
`BEGIN` on an open transaction is not possible; see the file's own header for why).
`recordMeasurement` is itself out-of-scope per §6.2; `correctMeasurement` IS gated
(`results.kpi.measurement.correct`, verified in §4.1) — so this function's actual
callers are either out-of-scope-by-design or already gated one level up.

### 6.4 `postComment` / `postRecognition` (`okrSupportCommands.ts`) — team-wide by design

```
$ grep -n "team-wide-by-design" server/src/services/resultsVnext/okr/okrSupportCommands.ts
okrSupportCommands.ts:203:      // RN-G5 DECISION (documented, not an oversight): see this file's own
okrSupportCommands.ts:296:      // RN-G5 DECISION: same as postComment — team-wide-by-design.
```
Both explicitly accept `access` (kept for signature consistency) but `void access;`
it — commenting/recognizing on a Support Request is intentionally NOT
owner/reviewer-restricted (anyone on the team can comment or recognize), per
`OKR_SUPPORT_CAPABILITIES`'s own comment.

### 6.5 `okrProgramCommands.ts`'s 3 commands — capability-only, no per-row owner concept

`createProgram`/`editProgramDraft`/`publishProgram` gate on capability alone (no
`responsibleUserIds` in the extraction, §4.3) — a Program is an org-level
governance resource with no owner/reviewer column in its own row
(`okrProgramTypes.ts`'s `OkrProgram` type has no such field). Not a skip; this is
the correct, minimal shape for a resource that genuinely has no "responsible
person" concept, same as `okrCycleCommands.ts`'s `createCycle`.

## 7. Real-Postgres measurement (this session, full re-run — the old §5's numbers are superseded)

**Setup (exact, copyable — matches the original recipe, new scratch DB/port):**
```bash
export PATH=/opt/homebrew/opt/postgresql@17/bin:$PATH
export LC_ALL=C LANG=C   # macOS "postmaster became multithreaded" workaround
mkdir -p /tmp/rn-g5-pgsock
initdb --locale=C -D /tmp/rn-g5-pgdata -U postgres
pg_ctl -D /tmp/rn-g5-pgdata -l /tmp/rn-g5-pgdata/logfile \
  -o "-p 55812 -h 127.0.0.1 -k /tmp/rn-g5-pgsock" start
createdb -h 127.0.0.1 -p 55812 -U postgres rn_g5_authz_kpi
DATABASE_URL="postgresql://postgres@127.0.0.1:55812/rn_g5_authz_kpi" \
  NODE_ENV=test DB_TYPE=postgres npx tsx server/scripts/migrate.postgres.ts
# NOT --safe. Ended with "✅ Postgres migrations complete" — every migration
# file ran, none skipped/failed.
```
Verified against `information_schema` (not `schema_migrations`): **1404 public
tables, 42 `rvn_*` tables** — byte-identical counts to the previous session's own
measurement on an independently-created database, a strong cross-check that the
migration set is deterministic.

**Negative control (§5)** ran first, on this same database, before the full-suite
run (12/12 green -> 2 red -> revert -> 12/12 green again).

**Full-suite run:**
```bash
RUN_DB_TESTS=1 NODE_ENV=test MOCK_DB=false \
  DATABASE_URL="postgresql://postgres@127.0.0.1:55812/rn_g5_authz_kpi" DB_TYPE=postgres \
  POSTGRES_SKIP_INIT_IN_TEST=1 \
  npx vitest run tests/resultsVnext --no-file-parallelism
```

**Result: `751 passed / 48 failed / 17 skipped` (816 total tests, 117 files, 26
files failing).**

**Three-state breakdown, with every failure attributed:**

- **48 failed / 26 failing files — ALL ONE root cause, ALL pre-existing, NONE
  caused by any RN-G5 gate (mine or the prior session's).** Every single failing
  file fails at fixture-setup time (`beforeAll`, before any command under test
  ever runs) with the identical Postgres error:
  `error: new row for relation "initiatives" violates check constraint
  "initiatives_status_check"` — the documented B4 blocker
  (`server/migrations/20260810_fix_initiatives_status_default.sql`, a file this
  session was explicitly forbidden to touch — it belongs to a parallel session).
  Postgres evaluates CHECK constraints before FK constraints, so the fixture's
  `INSERT INTO initiatives (...) VALUES (..., 'step3', ...)` (the column's own
  DEFAULT) fails its own CHECK before the row can even exist for any RVN command
  to reference. 3 of the 26 are the KPI parallel-session forbidden-list realdb
  files (`initiativeKpiImpactBaselineFreeze`, `kpiIdentityAcrossSurfaces`,
  `kpiInitiativeImpactPerspectivesRoutesRealdb` — verified each one's own thrown
  error text: `"A database is configured but is not reachable (or missing the
  KPI-E005 schema/initiatives fixture)"`, wrapping the SAME `23514` constraint
  violation); the other 23 are ROI realdb files whose fixtures also insert an
  `initiatives` row. **Full named list** (`grep "^ FAIL " | sort -u`):
  `initiativeKpiImpactBaselineFreeze`, `kpiIdentityAcrossSurfaces`,
  `kpiInitiativeImpactPerspectivesRoutesRealdb`, `roiActualEntryAppendOnly`,
  `roiActualSnapshot`, `roiApprovalSnapshotFreeze`,
  `roiApprovalSnapshotVisibilityJoin`, `roiBaselineFreeze`, `roiCalculationRun`,
  `roiCaseApproval`, `roiCaseLifecycle`, `roiCaseReapproval`,
  `roiCaseSubmitGuard`, `roiCompareView`, `roiEconomicModelFreeze`,
  `roiEconomicModelVisibilityJoin`, `roiEvidenceLinkFreshness`,
  `roiEvidenceLinksByKpi`, `roiFinanceLink`, `roiFinanceReconciliation`,
  `roiForecastActualVisibilityJoin`, `roiForecastVersion`,
  `roiTrackingTransition`, `roiVariance`, `roiVisibilityJoin`,
  `teresaPirLessonsDraft` (all `.realdb.test.ts` under `tests/resultsVnext/{kpi,roi}/`).

- **NEW failures caused by THIS session's gate: zero, observed directly, not
  inferred.** Grepped the full run output for `TypeError`/`Cannot read propert`/
  `COMMAND_CAPABILITY_DENIED`/`CommandCapabilityDeniedError` — the only hit is a
  benign passing unit-test TITLE (`commandCapabilityGuard.test.ts`'s own "throws
  CommandCapabilityDeniedError when the decision is DENY"), not an actual runtime
  crash or unexpected denial anywhere in `tests/resultsVnext`. **This does NOT
  mean the 3 new KPI files' gates are proven by this run** — see §9's honest
  limitation: `kpiInitiativeImpactPerspectivesRoutesRealdb.test.ts` (one of the 3
  files that exercises `proposeInitiativeKpiImpact`/`commitInitiativeKpiImpact`/
  `recordReviewedAttribution`/`supersedeInitiativeKpiImpact` directly against real
  Postgres) never reaches those calls at all in this run — it dies at its own
  `beforeAll` fixture insert first, for the SAME B4-blocker reason as everything
  else. The 3 new KPI command files' real-Postgres exercise in THIS run is
  therefore limited to whatever `tests/resultsVnext/kpi/scorecardPublishNonLeak
  .realdb.test.ts` / `kpiScorecardRepositoryRoutesRealdb.test.ts` cover (both
  passed) — corrective actions and initiative impacts have NO passing
  real-Postgres exercise of their NEW guard calls in this measured run, only the
  mocked unit tests (`initiativeKpiImpactCommands.test.ts`, 7/7) and the
  route-mock tests (both fully mocked commands, so the guard code itself never
  runs there either).

- **Delta vs. the stale §5 snapshot the previous doc draft recorded** (711
  passed/48 failed/17 skipped before ANY RN-G5 code, at 0 commits; 739/48/17 at
  11 commits): now 751/48/17 at the full ~44-commit branch. `+12` passed,
  `48`/`17` unchanged. The `+12` is exactly
  `rnG5CommandCapabilityGuardOkrRoi.security.realdb.test.ts`'s own test count
  (12) — the OKR/ROI security-coverage file added since that snapshot. Failing
  FILE count moved 25 -> 26 — one more `*.realdb.test.ts` file exists under
  `tests/resultsVnext/roi/` now than the 22 the old snapshot counted (not
  independently identified which specific file is the delta; every one of the
  current 23 ROI failing files fails for the identical B4-blocker reason, so
  this is one more file sharing the pre-existing cause, not a new failure
  mode).

**Cleanup:** `pg_ctl -D /tmp/rn-g5-pgdata stop -m fast`; `/tmp/rn-g5-pgdata` and
`/tmp/rn-g5-pgsock` removed. No demo-facing rows touched — every fixture used a
session-unique tag suffix and this was a scratch-only local Postgres instance, not
the shared demo/staging database.

## 8. What THIS session changed, precisely

1. Gated `kpiCorrectiveActionCommands.ts` (2 commands), `kpiInitiativeImpactCommands.ts`
   (4 commands), `kpiScorecardCommands.ts` (9 commands) — §4.1.
2. Wired real `resolveEffectiveAccess()` access resolution into 3 route files that
   previously either lacked it entirely (`kpiScorecard.routes.ts`,
   `kpiPerspectives.routes.ts`) or hadn't yet been extended to the 2 new endpoints
   in an already-partially-gated one (`kpiDeviation.routes.ts`'s corrective-action
   endpoints) — including `CommandCapabilityDeniedError` -> 403 mapping in each
   file's error handler.
3. Updated 6 test files to keep them green under the new required `access` field:
   2 mocked unit tests (`scorecardCommands.test.ts`,
   `initiativeKpiImpactCommands.test.ts` — wildcard access, since their own
   scenarios are about CAS/state-machine guards, not authorization), 2 mocked
   route tests (`kpiScorecard.routes.test.ts`, `kpiPerspectives.routes.test.ts` —
   mocked `resolveEffectiveAccess`, since the commands themselves are also fully
   mocked in those files), 2 real-Postgres fixtures
   (`scorecardPublishNonLeak.realdb.test.ts`,
   `kpiScorecardRepositoryRoutesRealdb.test.ts` — wildcard access; both suites'
   own acting fixture user is already the real record owner in every scenario, so
   this changes nothing about which branch of the guard would have allowed the
   call).
4. Found and fixed a real gap OUTSIDE the assigned 3-file scope:
   `roiCaseApprovalCommands.ts`'s `reopenApprovedRoiCaseForRevision` accepted
   `access` and had a route that resolved and passed a real one, but never
   actually checked it — §4.2/§8.3. Fixed with the file's own established
   pattern; verified both realdb callers already pass wildcard access so the fix
   doesn't change their outcome.
5. Ran the negative control (§5) and the full real-Postgres measurement (§7).
6. Rewrote this document essentially from scratch — the version this session
   inherited was written after 11 of the eventual ~44 commits and covered only
   "KPI (deviation+definition+measurement) + ROI's 5 case-decision commands",
   missing OKR (13 files, fully gated by the time this session started) and 14 of
   ROI's 19 files entirely.

### 8.3 The `reopenApprovedRoiCaseForRevision` finding, in detail

Discovered while cross-referencing this document's own §4 table against the actual
source (building the table honestly, not copying the prior draft's claim) —
`git log -p` shows the capability constant `ROI_CASE_APPROVAL_CAPABILITIES.reopenForRevision`
and the `access: CommandAccessContext` field on
`ReopenApprovedRoiCaseForRevisionInput` were both added in the same commit(s) that
gated this file's other 4 commands, but the actual `assertCommandCapability` call
was missing from this one function's body — an editing slip, not a documented
decision (no comment anywhere near it explaining an exception, unlike every
genuine skip in §6). The route
(`server/src/routes/resultsVnext/roi.routes.ts`'s
`POST /cases/:caseId/transitions/reopen-for-revision`) already resolved and passed
a real `access` — so the gap was silent: the field flowed all the way from the
HTTP layer into the command and was simply never read. Impact: any authenticated
org member (not just the case owner, not just someone with the capability) could
reopen ANY approved ROI case for revision, unfreezing its baseline and economic
model — the two `unfreezeRoi*` calls this function makes are themselves plain
`PoolClient`-taking internal helpers with no guard of their own (correctly so —
see §6.3's identical shape for `openOrEscalateDeviationCase`), so nothing else in
the call chain would have caught this either.

## 9. What this does NOT prove (read before saying "safe")

- **The 3 new KPI files' real-Postgres coverage is thinner than the rest of the
  program.** `kpiCorrectiveActionCommands.ts` and `kpiInitiativeImpactCommands.ts`
  have NO passing real-Postgres exercise of their new guard code in this
  session's own measurement (§7) — their only real-Postgres-capable test file
  (`kpiInitiativeImpactPerspectivesRoutesRealdb.test.ts`) is on the
  forbidden-to-touch list AND independently dies at fixture setup before it would
  ever reach them, for the pre-existing B4 reason. `kpiScorecardCommands.ts` is
  better covered (2 real-Postgres files exercise it and both pass), but even
  those never construct a "stranger tries and is denied" scenario the way
  `rnG5CommandCapabilityGuardOkrRoi.security.realdb.test.ts` does for OKR/ROI —
  they only prove the OWNER path (their fixture actor is always the record
  owner). No negative-control cycle (§5's method) was run against any of this
  session's own 3 new files. The mocked unit tests (15/15,
  `scorecardCommands.test.ts` + `initiativeKpiImpactCommands.test.ts`) all use
  wildcard access precisely so they are NOT testing the guard — they test the
  surrounding CAS/state-machine logic with the guard neutralized. Concretely:
  nothing in this repository's test suite currently proves, on real Postgres,
  that a non-owner/non-capability-holder actor is DENIED by
  `addCorrectiveAction`, `updateCorrectiveAction`, `proposeInitiativeKpiImpact`,
  `commitInitiativeKpiImpact`, `recordReviewedAttribution`, or
  `supersedeInitiativeKpiImpact`. This is the single most important gap a
  follow-up should close — a `rnG5CommandCapabilityGuardKpiE005E003.security
  .realdb.test.ts` mirroring the OKR/ROI file's own shape (stranger-403 +
  owner-allow + admin-allow) for at least one command per new file.

- **`kpiScorecardCommands.ts`'s `createScorecard`/`publishReviewSnapshot`
  guard is real-Postgres exercised, but only via the OWNER path.**
  `scorecardPublishNonLeak.realdb.test.ts` and
  `kpiScorecardRepositoryRoutesRealdb.test.ts` both use `USER_A` as owner/
  creator/publisher throughout — they prove the happy path still works with a
  real `resolveEffectiveAccess`-shaped grant (wildcard, in this case), not that
  a stranger is denied.

- **`§6`'s deliberate skips are only as safe as their own stated boundaries.**
  `createKpiDraft`/`createRoiCase` create INERT rows (only reachable through a
  separately-gated submit/approve pipeline) — that reasoning has not been
  re-verified this session, only inherited. `postComment`/`postRecognition`
  being team-wide is a product decision, not something this document can
  independently validate.

- **The capability-grant pathway for ordinary (non-owner, non-admin) members is
  still architecturally absent**, unchanged from the original draft's §6.5:
  `resolveEffectiveAccess` without a `projectId` only grants
  `APPLICATION_ROLE_BASELINE_CAPABILITIES` (a small hardcoded map) plus
  OWNER/ADMIN/SUPERADMIN's `'*'`. In practice, ALLOW comes from OWNER/ADMIN/
  SUPERADMIN or record ownership only.

- **This session touched nothing under `server/src/database/PostgresDatabase.ts`,
  the 3 forbidden KPI realdb test files, or
  `server/migrations/20260810_fix_initiatives_status_default.sql`** — the B4
  blocker responsible for all 48 measured failures remains exactly as broken as
  it was before this session, by explicit instruction, for a parallel session to
  own.

- **`tests/acceptance/**` was not run or fixed.** At least
  `rvn-cross-domain-gold-flow.e2e.test.ts` and
  `rvn-outbox-mywork-projection.e2e.test.ts` call already-gated KPI-deviation
  commands (`approvePlan`, `submitPlan`, `closeDeviationCase`,
  `addCorrectiveAction`, `updateCorrectiveAction`) with a bare
  `actorEffectiveRole` string and no `access` field at all — these were almost
  certainly already failing before this session touched anything (git history
  shows neither acceptance file has been edited since before the RN-G5 branch's
  first gating commit), and this session's OWN `addCorrectiveAction`/
  `updateCorrectiveAction` gating adds a SECOND reason they'd fail if the first
  one were ever fixed. Reconciling `tests/acceptance/**` fixtures is tracked as
  follow-up work, not part of this session's or the prior session's committed
  diff, and — per the task brief's own instruction — out of the measured scope
  (`tests/resultsVnext` only).
