# EXE-MVP-ACTIONS-001 — Action Inventory + `case_core`/`ai_agent_plans` Retirement Packet

Lane B, Sonnet executor. Analysis + evidence only — no source files touched. All claims below
are `path:line` grounded against the worktree at
`/Users/piotrwisniewski/Developer/consultify-closure-claude-b` (HEAD `64f507859c`, branch
`codex/sync-demo-20260729`... — see the lane's own git state). Anything not directly verified by
reading code is marked `NOT_VERIFIED`.

---

## Deliverable 1 — `case_core` / `ai_agent_plans` retirement decision packet

### 1.1 Summary verdict

**Neither table is dormant. Both are written by live, mounted, authenticated routes today.**
Retirement of either table as currently proposed by the lane brief ("no write to retired
`case_core`, `ai_agent_plans`") is **not achievable without a product/scope decision** — it would
either delete the entire Case Workspace domain (11 route files, 11 services, ~2,900 lines) or the
entire Agent Plan / "Uruchom agenta z Teresy" feature (HP-4). This packet documents exactly what
each write path is, how it is reached, and what breaks if writes stop. **The retirement call
itself is intentionally left to Piotr/CTO, per the task brief.**

### 1.2 `case_core` — every production write site

| # | Function | `path:line` | Statement |
|---|---|---|---|
| 1 | `createCase` | `server/src/services/caseWorkspace/caseCoreService.ts:425` | `INSERT INTO case_core (...)` |
| 2 | `transitionStatus` | `server/src/services/caseWorkspace/caseCoreService.ts:624` | `UPDATE case_core ... case_status` |
| 3 | `updateGovernanceTier` | `server/src/services/caseWorkspace/caseCoreService.ts:700` | `UPDATE case_core ... governance_tier` |
| 4 | `updateAutonomyPolicy` | `server/src/services/caseWorkspace/caseCoreService.ts:760` | `UPDATE case_core ... autonomy_policy` |
| 5 | `updateClosureAxisStatus` | `server/src/services/caseWorkspace/caseCoreService.ts:829` | `UPDATE case_core ... closure axis` |
| 6 | `recordClosure`/`cancelCase` (shared tail) | `server/src/services/caseWorkspace/caseCoreService.ts:905` | `UPDATE case_core ... closure_type/case_status` |
| 7 | `casePlanVersionService` (sets/clears active plan pointer) | `server/src/services/caseWorkspace/casePlanVersionService.ts:1374`, `:1489` | `UPDATE case_core SET current_plan_version_id = ...` |
| 8 | `caseIntakeService.confirmWorkOrder` | `server/src/services/caseWorkspace/caseIntakeService.ts:976` | `INSERT INTO case_core (...)` — **a second, independent create-case path**, distinct from #1 |

`caseIntakeService.ts:976`'s `INSERT` is not a duplicate of `caseCoreService.createCase` — it is
the Teresa chat-intake path's own case-creation, invoked from `confirmWorkOrder` (line 888) which
is in turn called by `confirmConversationWorkOrder` (line 1475, verified by reading the call at
offset +32 lines inside that function).

### 1.3 `case_core` — mount-chain reachability (traced, not assumed)

Two **independent** live route surfaces write `case_core`. This matters: gating one does not gate
the other.

**Surface A — `/api/v8/case-workspace/*` (the 11-service Case Workspace domain)**
```
server/src/Gateway.ts:1394   app.use('/api/v8', v8FeatureGate, v8Router)
server/src/routes/v8/index.ts:101   v8Router.use('/case-workspace', caseWorkspaceRoutes)
server/src/routes/caseWorkspace/index.ts:46-61   router.use(casesRoutes) / casePlanVersionsRoutes / ... / intakeRoutes
server/src/routes/caseWorkspace/cases.routes.ts:67,137,159,181,203,222,241   POST /cases, /cases/:caseId/status,
   /governance-tier, /autonomy-policy, /closure-axis, /closure, /cancel
```
`v8FeatureGate` (`server/src/middleware/v8FeatureGate.middleware.ts:14-21`) 404s the **entire**
`/api/v8` tree unless `process.env.ENABLE_V8_GLOBAL === 'true'` (a hard `===` string check, not
present in the shown snippet as an env-default — i.e. **off unless explicitly set**). A second,
per-org gate (`v8OrgGate`, same file, lines 27-64) applies further downstream but is not on the
`/api/v8` mount itself; note its `allowImplicitOrgRowsFallback()` (line 7) defaults to **allow**
outside `NODE_ENV=production` when an org has zero explicit V8 flag rows — i.e. even the org gate
fails open in non-prod environments. Whether `ENABLE_V8_GLOBAL=true` on the live demo/prod
environment is **NOT_VERIFIED** here (this is a runtime env-var question, not a code-reachability
one; per CLAUDE.md's own golden rule, that must be checked against the live environment, not
inferred).

**Surface B — `/api/v10/teresa/*` (chat-intake work-order confirm) — NOT gated by `ENABLE_V8_GLOBAL`**
```
server/src/Gateway.ts:1398   app.use('/api/v10/teresa', v10TeresaRoutes)   (unconditional mount)
server/src/routes/v10/teresa.routes.ts:328-341   POST /case-intake/conversations/:conversationId/confirm
   -> verifyToken, attachV8Context, caseWorkspaceHandler(...)
   -> caseIntakeService.confirmConversationWorkOrder(...) -> confirmWorkOrder(...) -> INSERT INTO case_core (line 976)
```
`attachV8Context` (`server/src/middleware/v8Auth.middleware.ts:153`) only resolves
`organizationId`/`userId` onto the request — it contains **no `ENABLE_V8_GLOBAL` check** (grepped
the file; the only `ENABLE_V8`-style check in the codebase's v8-auth family lives in
`v8FeatureGate.middleware.ts`, which is never imported into `v10/teresa.routes.ts`). So **`case_core`
rows are created via the Teresa chat-confirm flow regardless of the v8 global toggle.** Any
retirement plan that only flips `ENABLE_V8_GLOBAL` off, or removes the `/api/v8/case-workspace`
mount, leaves this second write path fully live.

**Conclusion on reachability:** `case_core` is not a phantom table behind an OFF flag. It has one
gated write surface (A) and one unconditionally-mounted write surface (B). Both are
production-reachable authenticated routes today (auth: `verifyToken` on both; `caseWorkspaceHandler`
funnels errors but does not itself gate access — see §2 for what access checks actually run).

### 1.4 `ai_agent_plans` — every production write site

| # | Function | `path:line` |
|---|---|---|
| 1 | `agentPlannerService.createPlan` | `server/src/services/ai/agentPlannerService.ts:400` (`INSERT INTO ai_agent_plans`) |
| 2-9 | `replaceSteps`, `schedulePlan`, `approveStep`, `cancelPlan`, `setFolder`, `claimRunSubmission`/`releaseRunSubmissionClaim`, `executeGovernedEnqueue`, background execution status updates | `server/src/services/ai/agentPlannerService.ts:206,225,285,312,321,712,901,1011,1099,1112,1154,1168` (all `UPDATE ai_agent_plans`) |
| 10 | `agentFolderService` (unassign plan from deleted folder) | `server/src/services/ai/agentFolderService.ts:211` (`UPDATE ai_agent_plans SET folder_id = NULL ...`) |

### 1.5 `ai_agent_plans` — mount-chain reachability

```
server/src/Gateway.ts:45     import aiDomainRoutes from './routes/ai/index.js'
server/src/Gateway.ts:570    app.use('/api/ai', aiDomainRoutes)              (unconditional mount, no v8/feature gate)
server/src/routes/ai/index.ts:75  router.use('/agent-plan', agentPlanRoutes)
server/src/routes/ai/agent-plan.routes.ts:94  router.use(verifyToken)        (auth is the only gate; every handler below is live)
```
All nine mutating endpoints (`POST /`, `PATCH /:id/steps`, `POST /:id/run`, `POST /:id/schedule`,
`POST /:id/approve-step`, `POST /:id/cancel`, `POST /folders`, `PUT /folders/:folderId`,
`DELETE /folders/:folderId`, `PATCH /:id/folder`) are reachable to any authenticated user with an
`organizationId`, unconditionally — no `ENABLE_V8_GLOBAL`, no feature flag of any kind gates this
route file (confirmed: `agent-plan.routes.ts` imports nothing from `v8FeatureGate.middleware.ts` or
`v8Auth.middleware.ts`). The route file's own header comment (`agent-plan.routes.ts:40-42`) claims
mounting is "behind flag `ff_agentPlan`" — **that claim is about a frontend-only flag
(`src/utils/agentPlanFlag.ts`, not verified further here) gating whether the UI ever calls it, not
whether the backend route exists or is reachable.** A direct authenticated HTTP call reaches it
regardless of that frontend flag's state. This is exactly the "FANTOM flag" pattern CLAUDE.md's
golden rule #1 warns about, in reverse: here the flag is real but frontend-only, and the doc
comment's phrasing ("montaż backendu... za flagą") could mislead a reader into thinking the
*route* is conditional. It is not.

### 1.6 Is `case_core` retirable without touching `ai_agent_plans`, and vice versa?

Yes — they are structurally and operationally independent:
- **Different owning services**: Case Workspace (`server/src/services/caseWorkspace/*`, 11 files)
  vs. Agent Planner (`server/src/services/ai/agentPlannerService.ts`,
  `agentFolderService.ts`, HP-4 "Uruchom agenta z Teresy").
- **No code cross-reference found**: grepped `ai_agent_plans` writers (`agentPlannerService.ts`)
  for any join against `case_core` or `transformation_cases` (§1.7) — the service instead joins
  `transformation_cases` (`agentPlannerService.ts:144,735,772,1032`), a *third*, separate table.
  `case_core` is never referenced by any file under `server/src/services/ai/`.

So this is genuinely two unrelated retirement questions bundled under one lane-acceptance
sentence, not one.

### 1.7 `case_core` vs. `transformation_cases` — two parallel concepts, no shim

Verified by reading both `CREATE TABLE` statements:

| | `case_core` (`server/migrations/20260809_case_workspace_case_core.sql`) | `transformation_cases` (`server/migrations/20260807_agent_t01_transformation_case.sql`) |
|---|---|---|
| Primary key | `case_id` | `transformation_case_id` |
| Project link | `project_id` **UNIQUE**, `NOT NULL`, `ON DELETE CASCADE` (strict 1:1 with `projects`) | `project_id` nullable, not unique (many-per-project allowed) |
| Status enum | `DRAFT / ACTIVE / BLOCKED / CLOSED / FAILED / CANCELLED` | `draft / plan_proposed / plan_approved / active / cancelled` (different vocabulary, different case) |
| Lifecycle model | governance tier + autonomy policy + closure-axis (delivery/decision/implementation/outcome) | `lifecycle_stage` enum (`mandate → discovery → ... → sustainability → final_outputs`, 15 stages) |
| Cross-reference column | none found | none found |

No FK, no shared id, no mapping table. Grepped the entire `server/src` tree for
`transformation_case_id` appearing anywhere near `case_core`'s own migrations, and for any
`case_core ... transformation_cases` join in application code: **zero matches**. The only overlap
is conceptual naming ("a Case"), not data. **These are two genuinely parallel, non-integrated
domains, not one model with a compatibility shim.** A reader of the lane brief's phrase "retired
`case_core`" should not assume `transformation_cases` is `case_core`'s replacement or successor —
nothing in the code asserts that relationship; it would need to be a product decision, not
something inferable from the schema.

`ai_agent_plans`, in turn, relates to **`transformation_cases`** (via joins in
`agentPlannerService.ts`), not to `case_core` — so the "three tables" in the lane brief
(`case_core`, `ai_agent_plans`) actually sit on two different sides of this parallel-domain split:
`case_core` alone in the Case Workspace domain, `ai_agent_plans` joined against
`transformation_cases` in the Agent/Transformation domain.

### 1.8 What would have to change for each write to stop, and what breaks

**`case_core`:**
- Removing/gating Surface A (`/api/v8/case-workspace/cases/*`) alone is insufficient — Surface B
  (`/api/v10/teresa/case-intake/.../confirm`) still writes. Both must be closed.
- Closing Surface A means removing or 404-ing all of `cases.routes.ts`,
  `casePlanVersions.routes.ts`, and the other 9 case-workspace route files — this breaks every
  Case Workspace UI screen in `src/components/CaseWorkspace/**` (14 lease-owned files:
  `CaseDetailScreen.tsx`, `CasesListScreen.tsx`, `PlanView.tsx`, `RealizacjaView.tsx`,
  `RezultatyView.tsx`, `PlanGraphCanvas.tsx`, etc.) since `src/components/CaseWorkspace/api.ts` is
  the sole client for these endpoints.
- Closing Surface B breaks the Teresa chat "confirm this work order → create a Case" flow
  (`v10/teresa.routes.ts:325-345`), which per that file's own comment is the *production* path a
  real user takes ("real user even though `caseIntakeService`... conversation had a working
  backend" — `v10/teresa.routes.ts:194-197`).
- **Net**: retiring `case_core` writes = retiring the entire Case Workspace product surface, both
  its dedicated UI and its Teresa chat-intake entry point. Not a small deletion.

**`ai_agent_plans`:**
- Removing the mount (`Gateway.ts:570` or the `router.use('/agent-plan', ...)` line in
  `routes/ai/index.ts:75`) 404s the whole HP-4 "Plan" feature backend. The frontend flag
  (`ff_agentPlan`, `src/utils/agentPlanFlag.ts`, **NOT_VERIFIED** default state) already controls
  whether the UI calls it — if that flag is OFF in production, retiring the backend route may be
  a low-blast-radius change (no live UI caller). This is a materially easier retirement than
  `case_core`'s, *if* the frontend flag is confirmed off. That confirmation was not performed here
  (would require checking `agentPlanFlag.ts`'s default and the live env/DB flag value) —
  **NOT_VERIFIED**.
- A background cron (`server/src/jobs/agentPlanSchedulerJob.ts`, referenced at
  `agent-plan.routes.ts:31-32`) also reads/writes `ai_agent_plans` for scheduled dispatch,
  independent of the HTTP route — retiring the table requires stopping that job too, not just the
  route.

### 1.9 Lane B lease membership for the changes each retirement path would touch

Checked with `jq -r '.files[]' docs/cleanup/agents/generated/CLAUDE_LANE_B_PATH_LEASE.json | grep -qxF "<path>"`:

| Path | In Lane B lease? |
|---|---|
| `server/src/services/caseWorkspace/caseCoreService.ts` | **YES** |
| `server/src/services/caseWorkspace/caseIntakeService.ts` | **YES** |
| `server/src/services/caseWorkspace/casePlanVersionService.ts` | **YES** |
| `server/src/services/caseWorkspace/caseWorkspaceAuthContext.ts` | **YES** |
| `server/src/routes/caseWorkspace/cases.routes.ts`, `_shared/access.ts`, `actionProposals.routes.ts`, `index.ts` | **YES** |
| `src/components/CaseWorkspace/**` (14 files checked individually) | **YES**, all |
| `src/components/Execution/**` (checked individually, ~60 files) | **YES**, all |
| `server/src/services/ai/agentPlannerService.ts` | **NO** |
| `server/src/services/ai/agentFolderService.ts` | **NO** |
| `server/src/routes/ai/agent-plan.routes.ts` | **NO** |
| `server/src/routes/v8/index.ts` | **NO** |
| `server/src/Gateway.ts` | **NO** |
| `server/src/middleware/v8FeatureGate.middleware.ts` | **NO** |

**Consequence**: a `case_core` retirement (or hardening — see §2.2's role-floor gap, which sits in
files the lease *does* cover) is executable inside Lane B. **An `ai_agent_plans` retirement is
NOT executable inside Lane B** — every file that would need to change
(`agentPlannerService.ts`, `agentFolderService.ts`, `agent-plan.routes.ts`, the
`routes/ai/index.ts` mount) sits outside the Lane B path lease. That work belongs to whichever
lane/owner holds the AI/Agent surface, or to a cross-lane change coordinated at the Gateway level
(itself unleased by any single lane, per `Gateway.ts` and `routes/v8/index.ts` both being
outside Lane B).

### 1.10 Recommendation

- **Do not retire `case_core` as a blanket "stop all writes" action.** It is the live persistence
  layer for a functioning product surface (Case Workspace UI + Teresa chat-intake). The risk of
  doing so is high: breaks two independent live entry points, one of which (`v10/teresa`) the
  route file's own comments describe as production-facing.
- **The one Lane-B-actionable item that plausibly *is* "retirement-adjacent" work** is not
  deleting `case_core` but closing the role-floor gap documented in §2.2/finding (b) below — the
  file's own header (`caseWorkspaceAuthContext.ts:74-77`) already names this as unfinished
  "RETROFIT NOTE" priority #3. That is a hardening fix, not a retirement, and it is inside the
  lease.
- **`ai_agent_plans` retirement is a real option** (if the frontend flag is confirmed off) but is
  **out of Lane B's lease entirely** — recommend flagging to program coordination rather than
  attempting it here.
- **Do not conflate `case_core` and `transformation_cases`.** Any future consolidation of the two
  "Case" concepts is a product/architecture decision (which one wins, how existing rows migrate)
  that this packet deliberately does not make.

---

## Deliverable 2 — `EXE-MVP-ACTIONS-001` action inventory

### 2.1 Verified findings from the task brief

**(a) `executionBudgetService.ts` `deleteBudgetEntry` — HOLDS, confirmed exactly as reported.**

```
server/src/services/executionBudgetService.ts:179-193
export async function deleteBudgetEntry(organizationId, entryId, initiativeId) {
  await dbRun(`DELETE FROM budget_entries WHERE id = ? AND organization_id = ?`, [entryId, organizationId]);
  await recalcInitiativeActualTotal(organizationId, initiativeId);   // runs unconditionally
  ...
}
```
- No `initiativeId` filter on the `DELETE` itself, and no check of the driver's affected-row
  count anywhere in the function.
- Caller (`server/src/routes/executionControl.routes.ts:540-555`, `DELETE
  /budget/entries/:entryId`) unconditionally returns `res.json({ success: true })` at line 553 —
  a wrong `entryId` (nonexistent, or belonging to a different initiative than the `initiativeId`
  query param claims) still gets HTTP 200 and still triggers `recalcInitiativeActualTotal` for
  whatever `initiativeId` the caller supplied, which may not be the entry's real (or any)
  initiative.
- Gate: `requireOrgRole('admin')` at `executionControl.routes.ts:544` — confirmed present, exactly
  as reported.
- **Contrast with the codebase's own established pattern**: the *sibling* handlers in the very
  same route file (e.g. `executionControl.routes.ts:238-260`, field-change updates) explicitly
  `SELECT` first, 404 on `existing.length === 0`, and write an `execution_audit_log` row
  (`INSERT INTO execution_audit_log ...` at lines 256, 662, 778, 907). `deleteBudgetEntry` follows
  neither convention despite both being demonstrated elsewhere in the same file.
- **Test coverage**: confirmed zero. `deleteBudgetEntry` does not appear in any `.test.ts` file in
  the repo (`grep -rln "deleteBudgetEntry" **/*.test.ts` → no hits). The only test referencing this
  exact route path is `tests/unit/backend/demo/publicDemoWriteAllowlist.test.ts:443`, which lists
  `DELETE /api/execution-control/budget/entries/:entryId` purely as a row in a demo-write-block
  allowlist table — it asserts the *demo guard* refuses the call, never exercises the handler's
  actual delete/row-count logic. `execution-control.routes.test.ts` and
  `v8-execution-control-api.test.ts` test only the `POST` (create) budget-entry route, at a
  **different, v8-prefixed path** (`/api/v8/execution-control/budget/entries`) served by a
  **separate file**, `server/src/routes/v8/execution-control.routes.ts`, which — confirmed by
  grepping its full route list (lines 212-1819) — **has no `DELETE` handler at all**. The only
  DELETE for budget entries lives in the legacy, deprecated
  (`Gateway.ts:1334-1336, deprecationHeader('/api/v8/execution-control')`) route file, still
  actively mounted at `/api/execution-control`.
- **Frontend caller**: searched `src/components/Execution/**` and the whole `src/` tree for any
  call to `budget/entries/${...}` with method DELETE — **none found**. `BudgetControlPanel.tsx`
  (`src/components/Execution/BudgetControlPanel.tsx:201`) only calls the `POST` (create) endpoint.
  So today there is **no wired UI control** for this destructive action inside
  `src/components/Execution/**` — but the backend endpoint is live, authenticated, and reachable
  by any admin-role JWT (e.g., direct API call), independent of any UI gating.

**(b) `caseWorkspaceAuthContext.ts` — HOLDS, confirmed and shown to be broader than the single
cited example.**

- `requireCaseAccess` (`server/src/services/caseWorkspace/caseWorkspaceAuthContext.ts:387-418`)
  checks only active org membership (`requireOrgMember`, line 407) — no role comparison anywhere
  in its body.
- `requireOrgRole` (lines 350-364) *does* exist and *does* implement a real role-floor check
  (`roleRank(membership.role) < roleRank(minimumRole)`) — the primitive is available, just unused
  for case mutations.
- The file's own header **already documents this exact gap** as unresolved, verbatim:
  `caseWorkspaceAuthContext.ts:74-77` — *"caseCoreService.transitionStatus (especially ->
  CLOSED/CANCELLED) and recordClosure — governance-terminal state changes with no role floor
  today; a MEMBER can currently close/cancel a Case exactly as freely as an OWNER."* This is a
  self-identified, not newly discovered, gap.
- **Confirmed at the call-site level**, not just in the auth module: grepped every
  `router.(get|post|patch|put|delete)` mutation across all 11 files in
  `server/src/routes/caseWorkspace/` for which of `requireCaseAccessForActor` (membership-only) vs
  `requireOrgRoleForActor` (role-floor) each uses:
  - `requireOrgRoleForActor(actor, 'ADMIN')` is used **only** in `capabilities.routes.ts` (lines
    96, 187, 215) and `migrationReadiness.routes.ts` (lines 58, 117, 174, 199, 218, 239, 259,
    278) — both platform-global config surfaces, not per-case mutations.
  - **Every case-level mutating route** — `cases.routes.ts` (status/governance-tier/autonomy-policy/
    closure-axis/closure/cancel, lines 137-250), `actionProposals.routes.ts` (approval-decision
    endpoints, lines 88-323), `runLifecycle.routes.ts` (`POST /runs/:runId/cancel`, line 164),
    `waitSubscriptions.routes.ts` (`POST /waits/:waitId/cancel`, line 190),
    `artifactLinks.routes.ts` (`DELETE /artifact-links/:linkId`, line 209) — calls
    `requireCaseAccessForActor` **only**. A `MEMBER` can cancel a Case, cancel a Run, cancel a
    Wait, unlink an artifact, and decide a DESTRUCTIVE-effect-class action proposal, with exactly
    the same standing as an `OWNER`.
- **No audit trail on any of these mutations either.** `appendCaseHistoryEvent` (defined
  `caseHistoryService.ts:641`) is called from exactly one call site in the whole codebase —
  `server/src/routes/caseWorkspace/caseHistory.routes.ts:62`, a dedicated
  client-driven "append a history event" endpoint. None of `caseCoreService.ts`'s
  transitionStatus/cancelCase/recordClosure/updateGovernanceTier/updateAutonomyPolicy/
  updateClosureAxisStatus functions call it (grepped `caseHistoryService` inside
  `caseCoreService.ts`: zero matches), and neither does `cases.routes.ts`. So closing/cancelling a
  Case leaves no automatic history-event record — a caller would have to separately, explicitly
  POST a history event, and nothing forces that to happen.

### 2.2 Which fixes are inside the Lane B lease

| Fix | Files that need to change | In Lane B lease? |
|---|---|---|
| (a) row-count check + 404-on-no-op for `deleteBudgetEntry` | `server/src/services/executionBudgetService.ts` | **YES** |
| (a) same for the calling route (surface the 404) | `server/src/routes/executionControl.routes.ts` | **YES** |
| (a) add test coverage | new test file under `server/src/**/__tests__` or `tests/` (path TBD by fix author) | would be **YES** if placed under an already-leased directory; new files need `git add -f` per CLAUDE.md's execution-hygiene rule |
| (b) add `requireOrgRoleForActor` floor to case-terminal mutations | `server/src/routes/caseWorkspace/cases.routes.ts`, `actionProposals.routes.ts`, `runLifecycle.routes.ts`, `waitSubscriptions.routes.ts`, `artifactLinks.routes.ts` | **YES**, all five |
| (b) the role-floor primitive itself (`requireOrgRole`) | `server/src/services/caseWorkspace/caseWorkspaceAuthContext.ts` | **YES** — already exists, no change needed there, just needs to be *called* from the route layer |
| (b) add audit-trail emission on terminal transitions | `server/src/services/caseWorkspace/caseCoreService.ts` (call `appendCaseHistoryEvent` from `caseHistoryService.ts`) | **YES**, both files leased |

**Both confirmed gaps are fully fixable inside the Lane B lease.** No cross-lane coordination is
required for either (a) or (b), unlike the `ai_agent_plans` retirement question in Deliverable 1.

### 2.3 Full action-control inventory

Scope: every mutating/destructive action control found under `src/components/Execution/**` and
`src/components/CaseWorkspace/**` with a live handler calling a backend write. (Controls
correctly hidden/disabled with no backend counterpart are listed separately in §2.4 — they are
not gaps.)

| UI control (`path:line`) | Backend endpoint | Route `file:line` | Impl. status | Capability/role check (`path:line`) | Audit write | Fails closed on no-op/wrong id? |
|---|---|---|---|---|---|---|
| "Anuluj zlecenie" kebab action, `src/components/CaseWorkspace/CasesListScreen.tsx:893-899` → `cancelCase()` (`src/components/CaseWorkspace/api.ts:621`) | `POST /cases/:caseId/cancel` | `server/src/routes/caseWorkspace/cases.routes.ts:241-250` | Implemented | `requireCaseAccessForActor` only — `cases.routes.ts:246` (`server/src/services/caseWorkspace/caseWorkspaceAuthContext.ts:387`) — **NO role floor (finding b)** | NONE (see §2.1b) | Yes on nonexistent case (`requireCaseAccess` 404s via enumeration-safe `case_access_denied`, `caseWorkspaceAuthContext.ts:398-404`); **no** role-based fail-closed |
| "Zamknij" confirm dialog, `src/components/CaseWorkspace/CaseDetailScreen.tsx:2320` → `potwierdzZamkniecie` (`:967`) → `recordCaseClosure` (`:977`) + `closeCase` (`:998`) | `POST /cases/:caseId/closure` then `POST /cases/:caseId/status` (via `closeCase` alias) | `server/src/routes/caseWorkspace/cases.routes.ts:222-236` (closure), `:137-151` (status) | Implemented | `requireCaseAccessForActor` only — **NO role floor (finding b)** | NONE | Existence: yes (enumeration-safe 404). Role: no |
| Closure-axis controls, `src/components/CaseWorkspace/CaseDetailScreen.tsx:940` → `updateCaseClosureAxis` | `POST /cases/:caseId/closure-axis` | `server/src/routes/caseWorkspace/cases.routes.ts:203-214` | Implemented | `requireCaseAccessForActor` only — **NO role floor** | NONE | Existence: yes. Role: no |
| "Anuluj oczekiwanie" (`src/components/CaseWorkspace/RealizacjaView.tsx:1446` → `cancelWait`, `:686`) | `POST /waits/:waitId/cancel` | `server/src/routes/caseWorkspace/waitSubscriptions.routes.ts:190` | Implemented | `requireCaseAccessForActor` only (`waitSubscriptions.routes.ts:81/99/116`) — **NO role floor** | NONE (no `appendCaseHistoryEvent` call found in `waitSubscriptionService.ts` cancel path) | Existence: `NOT_VERIFIED` (service-level; not read in this pass) |
| "Anuluj przebieg" (`src/components/CaseWorkspace/RealizacjaView.tsx:1614` → `cancelRun`, `:766`) | `POST /runs/:runId/cancel` | `server/src/routes/caseWorkspace/runLifecycle.routes.ts:164-165` | Implemented | `requireCaseAccessForActor` only (`runLifecycle.routes.ts:85`) — **NO role floor** | NONE found | `NOT_VERIFIED` (service-level) |
| "Odepnij" artifact link (`src/components/CaseWorkspace/RezultatyView.tsx:826-828` → `otworzDialogOdpiecia` → `unlinkArtifactFromCase`, `:1063-1080`) | `DELETE /artifact-links/:linkId` | `server/src/routes/caseWorkspace/artifactLinks.routes.ts:208-221` | Implemented | `requireCaseAccessForLink` (membership-derived — same primitive family, `_shared/access.ts`) — **NO role floor** | NONE found | `NOT_VERIFIED` (service-level) |
| Action-proposal approve/reject (DESTRUCTIVE-effect-class), `src/components/CaseWorkspace/**` callers of `actionProposals.routes.ts` decision endpoints | `POST /proposals/:proposalId/decision` (and neighbors) | `server/src/routes/caseWorkspace/actionProposals.routes.ts:172-323` | Implemented | `requireCaseAccessForActor` only throughout the file (lines 67,103,120,142) — **NO role floor**, confirmed the RETROFIT NOTE's #1 priority item (`caseWorkspaceAuthContext.ts:61-66`) is still open | `NOT_VERIFIED` in this pass (would need reading `proposalApprovalService.ts` fully) | `NOT_VERIFIED` |
| KPI delete, `src/components/Execution/RolloutTab.tsx:547` → `Api.delete('/rollout/kpis/${id}')` | `DELETE /rollout/kpis/:id` | `server/src/routes/rollout.routes.ts:187-201` | Implemented | `requireRolloutWrite` = `requirePermission('MANAGE_ROLLOUT')` (`rollout.routes.ts:49,189`) — real capability check present | NONE (`grep -i audit server/src/routes/rollout.routes.ts` → zero hits) | **Yes** — checks `result.changes`, 404s if `!result.changes` (`rollout.routes.ts:198`) — correct pattern |
| Risk delete, `src/components/Execution/RolloutTab.tsx:592` → `Api.delete('/rollout/risks/${id}')` | `DELETE /rollout/risks/:id` | `server/src/routes/rollout.routes.ts:327-340` | Implemented | `requireRolloutWrite` | NONE | **Yes** — same `result.changes` check, `:337` |
| Change delete, `src/components/Execution/RolloutTab.tsx:610` → `Api.delete('/rollout/changes/${id}')` | `DELETE /rollout/changes/:id` | `server/src/routes/rollout.routes.ts:445-458` | Implemented | `requireRolloutWrite` | NONE | **Yes** — `:455` |
| Closure delete, `src/components/Execution/RolloutTab.tsx:628` → `Api.delete('/rollout/closures/${id}')` | `DELETE /rollout/closures/:id` | `server/src/routes/rollout.routes.ts:561-574` | Implemented | `requireRolloutWrite` | NONE | **Yes** — `:571` |
| Dependency delete, `src/components/Execution/ExecutionTimelineView.tsx:867` → `Api.delete('/initiatives/portfolio/dependencies/${id}')` | `DELETE /initiatives/portfolio/dependencies/:id` | `server/src/routes/pmo/initiatives.routes.ts:734-742` | Implemented | Route-level `requireOrgRole('user')` (low floor) + `requireInitiativeCapability('initiative.dependency.manage', {shadow:true})` — **the capability check is LOG-ONLY by default** (`server/src/middleware/effectiveCapability.middleware.ts:41-46`, `CAPABILITY_ENFORCE` env var defaults to `'shadow'`, only `'enforce'` makes it block); controller (`InitiativeController.deletePortfolioDependency`, `server/src/controllers/InitiativeController.ts:1945-1979`) additionally runs `assertCanEditInitiative` **only when `dep.from_initiative_id` is set** | NONE | Partial — controller SELECTs first and returns `success:true` on not-found (idempotent-delete semantics, arguably correct) but the raw `DELETE` itself (`InitiativeController.ts:1974-1977`) has no rowcount re-check after the capability gate |
| Budget entry delete — **no wired UI control found** in `src/components/Execution/**` | `DELETE /api/execution-control/budget/entries/:entryId` | `server/src/routes/executionControl.routes.ts:540-555` | Backend implemented, **not called from any Execution/CaseWorkspace UI control** (verified: `BudgetControlPanel.tsx` only calls the `POST` create endpoint) | `requireOrgRole('admin')` (`executionControl.routes.ts:544`) | NONE | **No — confirmed finding (a), see §2.1** |

### 2.4 Correctly hidden/disabled controls (not gaps — listed for completeness)

- **Initiative row "Archive" / "Delete"**, `src/components/Execution/ExecutionHub.tsx:2760-2769` —
  `universalHandlers.edit`/`archive` and `destructive` left undeclared on purpose; the file's own
  comment (`:2722-2727`) states there is no execution-side archive/delete endpoint yet, and
  `StandardTable`'s canon (block 4/5) renders these as disabled with a "Coming soon (backend)"
  note rather than silently omitting them — this matches the EXE-MVP-ACTIONS-001 requirement
  ("hidden" is acceptable for unimplemented actions) correctly.
- **Report catalog "Edit"/"Archive"**, `ExecutionHub.tsx:2775-2780` — same pattern, same
  justification (generated definitions, no per-row backend).

### 2.5 What was NOT fully verified in this pass (time-boxed; flagged rather than guessed)

- Row-count/fail-closed behavior of `cancelRun` (`runLifecycleService.ts`), `cancelWait`
  (`waitSubscriptionService.ts`), and `unlinkArtifactFromCase` (`artifactLinkService.ts`) at the
  service-method level — only the route-layer access check was traced for these three, not the
  service body's own existence/OCC-version handling. Marked `NOT_VERIFIED`.
- Audit-write behavior of `proposalApprovalService.recordApprovalDecision` — not read in full;
  the RETROFIT NOTE (`caseWorkspaceAuthContext.ts:61-66`) already flags it as the #1 priority gap
  for exactly the same role-floor issue as finding (b), but this was not independently confirmed
  by reading `proposalApprovalService.ts` line-by-line in this pass.
- Whether `ENABLE_V8_GLOBAL` is actually `true` on the live demo/prod environment (§1.3) —
  explicitly out of scope for a static-code pass; would require checking the live Railway env,
  per CLAUDE.md's own golden rule against trusting flags/docs over live state.
- Default state of frontend flag `src/utils/agentPlanFlag.ts` (§1.8) — file not opened in this
  pass.

---

## Evidence-gathering method (for reviewer reproducibility)

All claims above were established by direct `grep`/`Read` of the worktree, not by trusting
existing docs or comments (except where a comment is itself cited as evidence of a
self-documented gap, e.g. §2.1b). Mount chains were traced from `Gateway.ts` through each
intermediate router file to the final `router.get/post/patch/delete` call, per the task
instruction not to assume a file being present means it is wired. Lease membership was checked
with the exact `jq`/`grep -qxF` command specified in the task brief, run per-file (directory-level
checks were expanded to their full file listing before checking, since the lease manifest is a
flat file list, not a directory-pattern list).
