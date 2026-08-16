# EXE-BVP-001 — Initiative -> case -> work/control/report -> approved evidence -> exactly one Results signal -> reload

Evidence gathered 2026-08-16 in worktree `consultify-closure-claude-b`,
branch `codex/closure-claude-b-transformation`. Live DB queried read-only via
`docker exec consultify-closure-b-64f50785 psql`. No source files edited.

## Verdict up front

**The chain breaks at step 1 (Initiative -> Case) and again at the evidence
gate and the Results signal.** Both critical prior findings in the task
brief are CONFIRMED, with exact line citations below. "Exactly one Results
signal" on "approved delivery evidence" is not achievable today without new
code: the evidence gate accepts any non-blank string, and there is no
automatic Results-module signal tied to case closure at all — only a
manually-invoked, unrelated "create a KPI scorecard" capability.

## Step-by-step trace

### Step 1: Initiative -> Case (intake)

**ABSENT.** Confirmed by three independent checks:

1. **Schema**: `case_core` (confirmed live via `\d case_core`) has columns
   `case_id, project_id, organization_id, case_profile, governance_tier,
   ..., case_name, intake_confirmation_key` — **no `initiative_id` column,
   no FK to `initiatives`**. Its only FKs are to `projects`,
   `organizations`, `users` (`case_core_project_id_fkey`,
   `case_core_organization_id_fkey`, `case_core_sponsor_user_id_fkey`, all
   confirmed via `pg_constraint`).
2. **Intake route**: `server/src/routes/caseWorkspace/intake.routes.ts`
   (`/case-intake/work-orders/propose` and `/confirm`, lines 106 and 124)
   takes a `workOrderBody` schema (`intake.routes.ts:56-76`) keyed on
   `projectId: z.string().trim().min(1)` — there is no `initiativeId` field
   anywhere in the schema. The file's own header states plainly (lines 1-9):
   "It is the HTTP contract that the chat/Teresa layer calls" — this is a
   Project(chat/Teresa)->Case path, not an Initiative->Case path.
3. **Reverse-direction search**: the only adapter connecting Cases and
   Initiatives is `server/src/services/caseWorkspace/adapters/initiativeAdapter.ts`,
   and it goes the OTHER way — a Case can **create** a new `initiatives` row
   (`buildInitiativeCreateBinding`, `initiativeAdapter.ts:52-120`, wraps
   `initiativeService.createInitiative`) and link it as an `OUTPUT`
   artifact. `grep`-ing the whole `server/src/services/caseWorkspace` and
   `server/src/routes/caseWorkspace` trees for `initiativeId` turns up only
   `initiativeAdapter.ts` and its test — no file takes an existing
   `initiativeId` as input to create or attach a Case. No file named
   anything like `initiativeToCaseBridge` exists anywhere under `server/src`.

**Conclusion**: an existing Initiative today has no code path into Case
Workspace at all. The only route in is via a brand-new chat-originated work
order that happens to produce a Case which (optionally, later) spawns a
brand-new Initiative as an OUTPUT artifact — the reverse of what the BVP
chain requires.

### Step 2: Case -> work (execution graph / node runs)

**IMPLEMENTED**, inside Case Workspace, once a Case exists.
`server/src/services/caseWorkspace/executionGraphService.ts` and
`nodeRunService.ts` write to `case_workspace_node_runs` /
`case_workspace_runs` (both confirmed present live, currently 0 rows). Not
traced deeper in this pass (in scope per prior Case Workspace assessments
noted in session memory as the most mature of the four execution models —
see EXE-MVP-SPINE-001 evidence file for the cross-model picture); the
concern here is entry/exit, not this middle segment's internal correctness.

### Step 3: Case -> control (gateway evaluations)

**IMPLEMENTED.** `case_workspace_gateway_evaluations` (confirmed live,
0 rows) is written by `executionGraphService.ts:669`
(`INSERT INTO case_workspace_gateway_evaluations (...)`), read back at
lines 750, 775, 806, 823 of the same file. This is a real, versioned
governance-gate mechanism ("§3: case_workspace_gateway_evaluations has no
version column" comment at line 715 shows deliberate design attention).

### Step 4: Case -> report

**NOT CLEANLY MODELLED.** No artifact type literally named "report" exists
in the artifact-link catalog. `grep`-ing every adapter's `artifactType:`
literal across `server/src/services/caseWorkspace/adapters/*.ts` returns:
`finance_model`, `kpi_scorecard`, `assessment`, `decision`, `document`,
`presentation`, `kpi`, `initiative` — no `report`. The closest fit is
`artifactType: 'document'` (`documentsAdapter.ts:351`) or `'presentation'`
(`documentsAdapter.ts:593`); whether either is what the BVP chain means by
"report" is a product-definition question, NOT_VERIFIED in this pass.

### Step 5: approved delivery evidence (closure gate)

**CONFIRMED BROKEN — not a real approval gate.**
`server/src/services/caseWorkspace/caseCoreService.ts:889`:
```
const hasNamedRemainingScope = Boolean(evidenceRef) || Boolean(row.acceptance_criteria_ref);
```
inside `recordClosure()` (`caseCoreService.ts:876-917`), for the
`COMPLETED_PARTIAL` closure type. `Boolean(evidenceRef)` is a truthy-string
check — **any non-blank string passes**, with:
- **No lookup into `case_workspace_artifact_links`** — confirmed by
  `grep -n "case_workspace_artifact_links\|artifactLinkService"
  server/src/services/caseWorkspace/caseCoreService.ts`, which returns zero
  matches. The service that owns evidence-artifact linking
  (`artifactLinkService.ts`) is never imported or called by
  `caseCoreService.ts`.
- **No format constraint at the HTTP layer either**:
  `server/src/routes/caseWorkspace/cases.routes.ts:217-219`:
  ```
  const recordClosureBody = z.object({
    closureType: closureTypeEnum,
    evidenceRef: z.string().trim().min(1).nullable().optional(),
  });
  ```
  Any client can `POST /cases/:caseId/closure` with
  `{ "closureType": "COMPLETED_PARTIAL", "evidenceRef": "x" }` and it will
  satisfy the gate. There is no check that `evidenceRef` refers to a real
  linked artifact, a real approval record, or any object that exists.

For the other four closure types (`DELIVERY_COMPLETED`,
`DECISION_COMPLETED`, `IMPLEMENTATION_COMPLETED`, `OUTCOME_VALIDATED`) the
gate is stronger — it requires the matching closure axis
(`delivery_status`/`decision_status`/`implementation_status`/
`outcome_status`) to already be `COMPLETED`/`VALIDATED`
(`caseCoreService.ts:894-899`) — but reaching that axis status is itself a
separate, unaudited-in-this-pass write path (`transitionAxisStatus` and
similar), so this pass cannot confirm those four are gated on genuine
evidence either, only that `COMPLETED_PARTIAL` definitively is not.

### Step 6: exactly one Results signal

**CONFIRMED ABSENT as an automatic consequence of closure.** Searched the
whole `server/src` tree for consumers of the `case.closure_recorded` event
`caseCoreService.ts` publishes (`publishEvent(client, { eventType:
'case.closure_recorded', ... })` inside `recordClosure`): the only
non-test files that reference the string `case.closure_recorded` are
`caseCoreService.ts` itself (the publisher). No listener, projector, or
downstream handler consumes it to write into any Results-module table.

The only "Results" touchpoint in Case Workspace is
`server/src/services/caseWorkspace/adapters/resultsAdapter.ts`, a
**manually-invoked capability** (`case-workspace.results.scorecard.create`)
that creates a `kpi_scorecards` row on demand — unrelated to case closure,
callable at any point in a Case's lifecycle, not gated on evidence approval
or closure at all. The file's own header (lines 14-40) is explicit that this
was a deliberate, narrow choice among three candidate "Results" objects and
that the other two were REJECTED as not being create+read capability shapes:
- `case_workspace_node_result_acceptances` — a runtime-written record of one
  execution-graph node's own acceptance, "not a Results MODULE object a
  capability could create" (header, lines 23-32).
- `initiative_kpis` via `kpiDefinitionService.ts` — already wrapped by a
  DIFFERENT adapter (`kpiAdapter.ts`, `case-workspace.kpi.create`), so using
  it again under a "results" id would just be the same object under two
  capability ids (header, lines 33-40).

This means "exactly one Results signal" is not just unimplemented, it is
**architecturally ambiguous today** — there are at least three candidate
objects (`kpi_scorecards`, `case_workspace_node_result_acceptances`,
`initiative_kpis`) that could each plausibly BE "the Results signal," none
of which is automatically produced by, or exclusively tied to, case closure.

### Step 7: reload

Not reached — there is nothing downstream of step 6 to reload, since no
automatic Results signal exists. If a human manually calls
`case-workspace.results.scorecard.create` at some point during a Case's
life, a reload of the Results module would show that scorecard (persisted
in `kpi_scorecards`, real table, real read via `getScorecard` re-read
confirmed at `resultsAdapter.ts:197-200`) — but this is unrelated to, and
not gated by, the Initiative/Case/evidence chain being traced here.

## Summary table

| Step | Status | Evidence |
|---|---|---|
| Initiative -> Case intake | **ABSENT** | `case_core` has no `initiative_id`/FK; `intake.routes.ts` schema has no `initiativeId`; only adapter found is the reverse (Case creates Initiative) |
| Case -> work | IMPLEMENTED | `executionGraphService.ts`, `nodeRunService.ts` -> `case_workspace_node_runs` |
| Case -> control | IMPLEMENTED | `executionGraphService.ts:669` -> `case_workspace_gateway_evaluations` |
| Case -> report | NOT_VERIFIED / no dedicated artifact type | no `artifactType: 'report'` found; closest is `document`/`presentation` |
| Approved delivery evidence (closure gate) | **STUB — confirmed non-gate** | `caseCoreService.ts:889`, `Boolean(evidenceRef)`; no `case_workspace_artifact_links` lookup; HTTP body just requires a non-blank string (`cases.routes.ts:217-219`) |
| Exactly one Results signal | **ABSENT** | no listener for `case.closure_recorded`; only touchpoint is a manual, closure-independent `resultsAdapter.ts` scorecard-create capability; 3 ambiguous candidate "Results" objects, none canonical |
| Reload | not reached | depends on step 6 |

## Is "exactly one Results signal" achievable today?

**No, not without new code.** Two independent gaps must both close first:
1. The evidence gate must become a real check (verify `evidenceRef` against
   `case_workspace_artifact_links`, or an equivalent approval record) rather
   than a truthy-string check.
2. A single, automatic projection from `case.closure_recorded` (or a new,
   more specific event) to exactly one canonical Results object must be
   built — today three plausible target tables exist
   (`kpi_scorecards`, `case_workspace_node_result_acceptances`,
   `initiative_kpis`) with no product decision recorded in code as to which
   one is canonical.

And upstream of both: without an Initiative->Case intake adapter, the
Initiative half of "Initiative -> case -> ... " has no way to reach a Case
at all today, so the full chain as specified cannot be exercised end to end
starting from an Initiative regardless of the other two gaps.

## In-lease / out-of-lease split

Checked against `docs/cleanup/agents/generated/CLAUDE_LANE_B_PATH_LEASE.json`:

**IN-LEASE**: `server/src/routes/pmo/initiatives.routes.ts`,
`server/src/routes/caseWorkspace/intake.routes.ts`,
`server/src/routes/caseWorkspace/cases.routes.ts`,
`server/src/services/caseWorkspace/caseCoreService.ts`,
`server/src/services/caseWorkspace/adapters/initiativeAdapter.ts`,
`server/src/services/caseWorkspace/adapters/resultsAdapter.ts`,
`server/src/services/caseWorkspace/executionGraphService.ts`,
`server/src/services/caseWorkspace/artifactLinkService.ts`.

**OUT-OF-LEASE**: none of the files central to this trace fell outside the
lane B lease.

This means a fix for the evidence-gate and Results-signal gaps (steps 5-6)
is plausibly lane-B-scoped from a file-ownership perspective, but is a
genuine design decision (which Results object is canonical; what "approved"
evidence means) that needs product sign-off before implementation, not a
mechanical fix.
