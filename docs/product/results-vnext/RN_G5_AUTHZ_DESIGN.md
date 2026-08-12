# RN-G5 — Results Next command-layer authorization

Status: implemented for KPI (deviation + definition + measurement verify/dispute/correct)
and for ROI's 5 case-decision commands. NOT implemented for OKR or the remaining
~90% of ROI's command surface — see §6 "What this does NOT cover."

Base SHA: `35a1dee6c03b66907219b5b645e4e3ecb267f80a`. Branch `rn-g5-authz`,
worktree `/Users/piotrwisniewski/rn-g2-lanes/g5-authz`.

## 1. Problem (verified in code, 2026-08-12)

No write command anywhere under `server/src/services/resultsVnext/**` checked the
calling actor's authorization before mutating. `grep -E "role ===|role !==|EffectiveRole ===|EffectiveRole !=="`
across the whole tree returned zero hits. `actorEffectiveRole` was threaded through
every command signature and landed only in the audit event
(`rvn_platform_events.actor_effective_role`) — recorded, never compared against
anything. Routes computed it as `req.user?.role ? String(req.user.role) : 'member'`
(`kpi.routes.ts:152`, `kpiDeviation.routes.ts:141`, `roi.routes.ts:295`, identical
in all three) — a raw, sometimes-defaulted string, never checked.

The only pre-existing protection was maker-checker ("you may not approve/close your
own case"): `SelfApprovalDeniedError` (`kpiDefinitionCommands.ts`),
`DeviationSelfApprovalDeniedError` (`kpiDeviationCommands.ts`),
`RoiSelfApprovalDeniedError` (`roiCaseApprovalCommands.ts`). That is a business rule
about who may not decide a SPECIFIC case, not an authorization check about who may
call the command family at all. A total stranger with zero relationship to a KPI
could approve its corrective plan, verify/dispute/correct any measurement, approve
any ROI case, etc. — tenant isolation (`verifyToken` + `requireOrgAccess()`) held,
so this was a within-organization privilege-escalation gap, not a cross-tenant one.

## 2. Decision (owner's, implemented literally)

A write command's access rule:

**ALLOW** iff at least one holds:
1. `hasEffectiveCapability(access, <capability>)` is true. This already covers
   SUPERADMIN/OWNER/ADMIN (they hold `'*'` — see `effectiveAccessService.ts`
   `resolveEffectiveAccess`, L834-848) and any regular member explicitly granted
   the capability.
2. The actor is one of the record's own designated responsible people — read off
   the row already loaded inside `applyMutation` (owner_user_id/manager_user_id
   for KPI deviation cases and ROI cases; owner_user_id alone for KPI
   definitions/measurements, which have no manager concept).

**DENY** otherwise, via a single non-leaking error class.

Maker-checker stays a SEPARATE, ADDITIONAL check, run AFTER this guard (see §3 for
the ordering rationale) — never replaced or weakened.

Denial is generic (Decision D06): the thrown error's message/details never reveal
whether the record exists, which capability would have sufficed, or who the
responsible people are.

## 3. The guard — `server/src/services/resultsVnext/platform/commandCapabilityGuard.ts`

```ts
export type CommandAccessContext = Pick<AccessContext, 'capabilities' | 'platformRole'>;
export type CommandAccessDecision = 'ALLOW' | 'DENY';

export function evaluateCommandAccess(params: {
  access: CommandAccessContext;
  actorUserId: string;
  capability: string;
  responsibleUserIds?: Array<string | null | undefined>;
}): CommandAccessDecision;

export class CommandCapabilityDeniedError extends Error {
  code = 'COMMAND_CAPABILITY_DENIED';
  details: Record<string, unknown>; // { capability } only — nothing else
}

export function assertCommandCapability(params: EvaluateCommandAccessParams): void; // throws on DENY
```

`hasEffectiveCapability`/`resolveEffectiveAccess` are REUSED from
`effectiveAccessService.ts` (not modified — out of this pakiet's allowlist), per
`RN_G1_PLATFORM_DESIGN.md` L232-233 ("RBAC/PBAC short-circuit — reuse
effectiveAccessService — NIE wynajdywać").

**Ordering: RBAC gate FIRST, maker-checker self-approval SECOND**, inside every
`applyMutation`, before any read/write past the row lock `loadForUpdate` already
took. Rationale: the RBAC gate answers "can this actor touch this command family at
all" — a coarse authorization question that must be answered, and answered with a
GENERIC denial, before anything about the specific record's business state
(including who submitted/created it) is allowed to shape the error an unauthorized
caller receives. Checking self-approval first would let a total stranger who
submitted nothing trigger a `SELF_APPROVAL_DENIED`-shaped response by process of
elimination, and would run self-approval's own row comparisons for an actor never
authorized to be evaluated in the first place. Verified empirically (§5, negative
control #2): with the RBAC gate in place, `approvePlan` called by the case's own
owner (who ALSO submitted the plan) throws `DeviationSelfApprovalDeniedError`, not
`CommandCapabilityDeniedError` — proving maker-checker still fires on top of a
passing RBAC gate, not instead of it.

## 4. Command → capability → responsible-field table

### KPI deviation (`kpiDeviationCommands.ts`) — all 10 route-callable commands gated

| Command | Capability | Responsible fields | Guard site |
|---|---|---|---|
| `acknowledgeDeviationCase` | `results.kpi.deviation.acknowledge` | `owner_user_id`, `manager_user_id` | L~558 |
| `submitRootCause` | `results.kpi.deviation.submit_root_cause` | `owner_user_id`, `manager_user_id` | L~660 |
| `submitPlan` | `results.kpi.deviation.submit_plan` | `owner_user_id`, `manager_user_id` | L~761 |
| `approvePlan` | `results.kpi.deviation.approve_plan` | `owner_user_id`, `manager_user_id` | L~863 (before self-approval) |
| `recordRecoveryObservation` | `results.kpi.deviation.record_recovery_observation` | `owner_user_id`, `manager_user_id` | L~960 |
| `submitEffectivenessVerification` | `results.kpi.deviation.submit_effectiveness_verification` | `owner_user_id`, `manager_user_id` | L~1071 |
| `closeDeviationCase` | `results.kpi.deviation.close` | `owner_user_id`, `manager_user_id` | L~435 |
| `escalateDeviationCase` | `results.kpi.deviation.escalate` | `owner_user_id`, `manager_user_id` | L~1186 (shared `runEscalationOverlay`) |
| `deescalateDeviationCase` | `results.kpi.deviation.deescalate` | `owner_user_id`, `manager_user_id` | L~1186 (shared `runEscalationOverlay`) |
| `reopenDeviationCase` | `results.kpi.deviation.reopen` | prior case's `owner_user_id`, `manager_user_id` | L~1328 |

`openOrEscalateDeviationCase` is NOT gated — it is not a route-callable top-level
command; it runs inside `recordMeasurement`'s/`correctMeasurement`'s own
transaction, under that command's own actor/guard.

### KPI definitions (`kpiDefinitionCommands.ts`) — 7 of 8 commands gated

| Command | Capability | Responsible fields | Guard site |
|---|---|---|---|
| `createKpiDraft` | — | — | **NOT GATED, see §6.1** |
| `editDraft` | `results.kpi.definition.edit_draft` | KPI's `owner_user_id` (fresh lookup) + version's own `created_by` | L~485 |
| `submitDefinition` | `results.kpi.definition.submit` | KPI's `owner_user_id` + version's `created_by` | L~626 |
| `approveDefinitionVersion` | `results.kpi.definition.approve` | KPI's `owner_user_id` only | L~730 (before self-approval) |
| `rejectDefinitionVersion` | `results.kpi.definition.reject` | KPI's `owner_user_id` only | L~925 |
| `activateKpi` | `results.kpi.definition.activate` | `rvn_kpi_definitions.owner_user_id` (direct, same row) | L~1058 (shared `runKpiLifecycleTransition`) |
| `suspendKpi` | `results.kpi.definition.suspend` | same | same |
| `archiveKpi` | `results.kpi.definition.archive` | same | same |

`rvn_kpi_definition_versions` carries no `owner_user_id` of its own — only the
parent `rvn_kpi_definitions` row does. `editDraft`/`submitDefinition` resolve it
with a small extra `SELECT owner_user_id FROM rvn_kpi_definitions WHERE kpi_id = $1`
inside the transaction (`loadKpiOwnerUserId`); `activateKpi`/`suspendKpi`/
`archiveKpi` CAS directly against `rvn_kpi_definitions`, which already has the
column on the loaded row.

### KPI measurements (`kpiMeasurementCommands.ts`) — verify/dispute/correct only (task scope)

| Command | Capability | Responsible fields | Guard site |
|---|---|---|---|
| `verifyMeasurement` | `results.kpi.measurement.verify` | KPI's `owner_user_id` (fresh lookup, no actor fallback) | shared `insertSupersedingMeasurement`, after loading the original row |
| `disputeMeasurement` | `results.kpi.measurement.dispute` | same | same |
| `correctMeasurement` | `results.kpi.measurement.correct` | same | same |
| `recordMeasurement` | — | — | **explicitly out of scope, see §6.2** |

The lookup is a NEW helper (`loadKpiOwnerUserId`), deliberately NOT the pre-existing
`resolveDeviationCaseOwner` — that one falls back to the acting user when the KPI
has no owner (correct for "a deviation case must always have someone"), which would
make the guard trivially pass for every unowned KPI if reused here.

### ROI case decisions (`roiCaseApprovalCommands.ts`) — 5 of 5 commands in this file gated

| Command | Capability | Responsible fields | Guard site |
|---|---|---|---|
| `submitRoiCaseForApproval` | `results.roi.case.submit_for_approval` | `owner_user_id` | before the status guard |
| `approveRoiCase` | `results.roi.case.approve` | `owner_user_id` | before self-approval |
| `rejectRoiCase` | `results.roi.case.reject` | `owner_user_id` | before the status guard |
| `requestChangesOnRoiCase` | `results.roi.case.request_changes` | `owner_user_id` | before the status guard |
| `reopenApprovedRoiCaseForRevision` | `results.roi.case.reopen_for_revision` | `owner_user_id` | before the status guard |

`rvn_roi_cases` has no manager column — owner only.

## 5. Real-Postgres measurement (mandatory per task brief)

**Setup (exact, copyable):**
```bash
export PATH=/opt/homebrew/opt/postgresql@17/bin:$PATH
export LC_ALL=C   # macOS "postmaster became multithreaded during startup" workaround
initdb --locale=C -D <scratch>/pgdata-g5 -U postgres
pg_ctl -D <scratch>/pgdata-g5 -l <scratch>/pgdata-g5/logfile -o "-p 55803 -h 127.0.0.1" start
createdb -h 127.0.0.1 -p 55803 -U postgres rn_g5_authz
DATABASE_URL="postgresql://postgres@127.0.0.1:55803/rn_g5_authz" DB_TYPE=postgres NODE_ENV=test npm run db:migrate
# NODE_ENV=test is required — databaseTargetResolver.ts refuses a localhost
# DATABASE_URL outside test mode. --safe was NOT used (it reports a failed
# migration as "skipped" and exits 0 — a lie). All migrations ran clean,
# verified against information_schema (1404 public tables, 42 rvn_* tables),
# not the schema_migrations bookkeeping table.
```

**Test command (exact, copyable):**
```bash
RUN_DB_TESTS=1 NODE_ENV=test MOCK_DB=false \
  DATABASE_URL="postgresql://postgres@127.0.0.1:55803/rn_g5_authz" DB_TYPE=postgres \
  POSTGRES_SKIP_INIT_IN_TEST=1 \
  npx vitest run tests/resultsVnext --no-file-parallelism
```

**PRZED (before any RN-G5 code change), on this exact Postgres:**
`711 passed / 48 failed / 17 skipped` (776 total, 114 files, 25 files failing).

All 25 failing files split into two PRE-EXISTING, UNRELATED causes:
- 3 files under `tests/resultsVnext/kpi/*.realdb.test.ts`
  (`initiativeKpiImpactBaselineFreeze`, `kpiIdentityAcrossSurfaces`,
  `kpiInitiativeImpactPerspectivesRoutesRealdb`) — these are 3 of the 5 files on
  the parallel-session forbidden list this pakiet was explicitly told not to
  touch; already broken independent of RN-G5.
- 22 files under `tests/resultsVnext/roi/*.realdb.test.ts` — the documented B4
  blocker (`initiatives.status DEFAULT 'step3'` fails its own CHECK constraint,
  Postgres checks CHECK before FK, so fixture setup — inserting an `initiatives`
  row — fails before any ROI command ever runs). Not touched, per instruction.

**PO (after all 11 RN-G5 commits, same Postgres, same command):**
`739 passed / 48 failed / 17 skipped` (804 total, 116 files, 25 files failing).

**Delta:** `+28 passed / +0 failed / +0 skipped / +2 files`. The failing-file SET is
BYTE-IDENTICAL before/after (`diff` of the sorted `FAIL` line lists — empty diff).
The 2 new files are `tests/resultsVnext/platform/commandCapabilityGuard.test.ts`
(14 unit tests) and `tests/resultsVnext/platform/rnG5CommandCapabilityGuard.security.realdb.test.ts`
(14 real-Postgres security tests) — exactly the 28 new passing tests. Every new
failure: NONE. Every pre-existing failure: unchanged, same file, same reason.

## 6. What this does NOT cover (read before saying "safe")

### 6.1 `createKpiDraft` is deliberately UNGATED

No record exists yet at create time — there is no owner/manager row to fall back
to, so a gate here would be capability-only. `results.kpi.definition.create` is not
part of `APPLICATION_ROLE_BASELINE_CAPABILITIES.USER` (`effectiveAccessService.ts`
— out of this pakiet's allowlist, cannot add a baseline grant there). Verified
gating it breaks a real, currently-passing e2e gold flow:
`tests/resultsVnext/teresa-kpi-e2e-no-silent-approval.test.ts`'s
`draft_quality_review` create path — the acting fixture user has no
`organization_members` row at all, so `resolveEffectiveAccess` resolves it to bare
USER capabilities (canvas.* + okr.checkin.create only), and the create call would
be denied. Drafting a brand-new KPI is also materially lower-risk than the named
vulnerability (approving/verifying/correcting an EXISTING, possibly someone else's,
KPI) — a fresh draft is inert until it passes the separately-guarded submit/approve
pipeline, which IS gated.

### 6.2 `recordMeasurement` is out of scope (per task brief)

Explicitly excluded from the KPI measurement scope given in the task ("verify/
dispute/correct" only). It is a high-frequency import/connector path per the
file's own header comment, and — unlike verify/dispute/correct — it does not let
an actor touch anyone else's EXISTING work; it only creates a new fact.

### 6.3 ROI — only 5 of ~40 command files gated

`server/src/services/resultsVnext/roi/**` has ~35 OTHER command files completely
unguarded: cost lines, benefit lines, assumptions, scenarios, calculation policy/
runs, forecast versions, actual entries/snapshots, variance, PIR, finance links/
reconciliation, benefits realization, tracking. None of these were touched by this
pakiet. The 5 gated commands (`roiCaseApprovalCommands.ts`) are the direct ROI
analogue of the named vulnerability (approving someone else's case) — the rest of
the ROI write surface has the SAME "any authenticated org member can mutate
anything" gap this whole pakiet exists to close, just not addressed here.

### 6.4 OKR — NOT TOUCHED AT ALL

Zero files under `server/src/services/resultsVnext/okr/**` were read for this
pakiet's implementation (only skimmed for the capability-table task, not gated).
`okrObjectiveCommands.ts`/`okrKeyResultTypes.ts` confirmed to have `owner_user_id`
on both Objective and KeyResult rows (no manager field) — the same pattern would
apply, not implemented.

### 6.5 Capability-grant pathway for ordinary members is architecturally absent

`resolveEffectiveAccess` without a `projectId` (the correct call shape for these
org-level domains — KPI/ROI/OKR aggregates carry no project association) only
grants capabilities from `APPLICATION_ROLE_BASELINE_CAPABILITIES` (a small,
hardcoded map — currently just `USER: [...CANVAS_MEMBER_CAPABILITIES,
'okr.checkin.create']`) plus OWNER/ADMIN/SUPERADMIN's `'*'`. There is currently NO
mechanism to grant an ordinary member one of this pakiet's new
`results.*` capabilities without also making them OWNER/ADMIN — the "jawne nadanie
zdolności zwykłemu członkowi" pathway named in the task brief exists in the design
(`evaluateCommandAccess` honors any capability string present in `access.capabilities`)
but has no ADMIN UI or seed data wiring it up today. In practice, until that
pathway is built, ALLOW comes from OWNER/ADMIN/SUPERADMIN or record ownership only
— which is the intended, and currently the only reachable, non-owner path.

## 7. Known limitation of the measurement itself

The `tests/resultsVnext` run is the only scope actually measured (per the task
brief's own instruction). `tests/acceptance/**` and `tests/unit/**` were NOT run as
part of this pakiet's before/after — several files under `tests/acceptance/`
(`rvn-cross-domain-gold-flow.e2e.test.ts`,
`rvn-outbox-mywork-projection.e2e.test.ts`, `rvn-outbox-finance-projection.e2e.test.ts`,
and reportedly ~18 files under `rvn-g4-*` from a parallel session) call the newly-
gated commands directly with a bare `actorEffectiveRole` string and no `access`
field — these will now be DENIED. This is the correct, intended effect of closing
the vulnerability, not a bug; reconciling those fixtures (granting the acting
fixture users real capabilities/ownership) is tracked as follow-up integration work,
not part of this pakiet's committed diff.
