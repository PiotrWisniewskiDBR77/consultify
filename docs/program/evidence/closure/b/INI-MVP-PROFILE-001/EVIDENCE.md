# INI-MVP-PROFILE-001 — Evidence: one project/team/capability/approval policy and canonical writer

Lane B (evidence-only). Worktree: `/Users/piotrwisniewski/Developer/consultify-closure-claude-b`,
branch `codex/closure-claude-b-transformation`, HEAD `64f507859c` at analysis time.
Live DB: `postgresql://consultinity:consultinity@127.0.0.1:55811/consultinity` (703 migrations, isolated
lane instance). All line numbers are `path:line` on this exact worktree state and were re-checked by
reading the file, not by memory of a prior inventory.

## 0. Two unreconciled initiative data models (finding not present in the prior inventory)

Before the writer count: this codebase has **two structurally different, non-overlapping persistence
models for "an initiative"**, not one:

1. **Classic relational model** — the `initiatives` SQL table, populated by ~19 live raw-`INSERT`
   call sites (§1) plus one dormant canonical funnel (§2).
2. **"Canonical runtime" aggregate model** — `ie_aggregate_state` (aggregate_type='initiative',
   JSONB payload), built exclusively through the material-command bus
   (`server/src/domain/initiatives-execution/materialCommand.ts`,
   `executeMaterialCommand`) via `registerInitiative`
   (`server/src/domain/initiatives-execution/registerInitiative.ts:77-189`). This is mounted at
   `POST /api/initiatives/runtime-v1/registrations` (router mount:
   `server/src/routes/pmo/initiatives.routes.ts:133` → `router.use('/runtime-v1',
   initiativesExecutionRuntimeRouter)`; app mount: `server/src/Gateway.ts:657,1106` →
   `/api/initiatives`, `/api/pmo/initiatives`).

`registerInitiative` **never touches the `initiatives` table** — verified by reading the full function
body (`registerInitiative.ts:88-188`): it only calls `getSourceProposalForUpdate`,
`claimRelation`, `markSourceProposalRegistered`, and returns a `mutation` object that
`executeMaterialCommand` persists into `ie_aggregate_state` only (`materialCommand.ts:479-486` →
`transaction.persistAggregate`). Conversely, none of the 19 raw `INSERT INTO initiatives` sites in
§1, nor the funnel in §2, ever write to `ie_aggregate_state`.

**Live-DB proof this is not a paper distinction** (read-only queries, 2026-08-16):
```
catalog_rows | selection_rows | version_rows | distinct_initiatives_with_cards | initiative_aggregates | initiatives_total
26           | 0              | 0            | 0                                | 0                      | 1
```
`initiatives` has 1 row (an unrelated seed row from another executor's session:
`odbior--h16--init-scheduled-go-2`); `ie_aggregate_state` has **zero** rows for
`aggregate_type='initiative'`, and `initiative_candidates` (the source-proposal table
`registerInitiative` depends on) is also empty. **The "canonical runtime" model is currently
unpopulated in this environment** — it exists in code and schema (migration
`server/migrations/933_initiative_card_versions.sql`) but has no live data to verify determinism
against (see INI-MVP-CARDS-001 evidence for the consequence).

Any statement of "writer inventory = 1" that only unifies the 19+1 relational writers (§1–§2) still
leaves a second, entirely separate initiative representation live in production routes. This is a
material scope point for the recommendation in §5.

## 1. Live raw `INSERT INTO initiatives` writers (relational model), confirmed by reading each site

`INITIATIVE_FUNNEL_ENABLED` gate check: `process.env.INITIATIVE_FUNNEL_ENABLED !== 'true'`
anywhere in `server/src` defaults the funnel OFF (no `=== 'true'` short-circuit found; no env
template — `.env*.example`, `server/.env.test` — sets it). **Confirmed default OFF.** Every site
below is therefore live at shipped defaults unless noted otherwise.

| # | File:line | Gated by `INITIATIVE_FUNNEL_ENABLED`? | Anchors `project_id` via `resolveInitiativeProjectId`? | Live route reached from | Notes |
|---|---|---|---|---|---|
| 1 | `server/src/controllers/InitiativeController.ts:609` (+legacy fallback `:669`) | Yes (else-branch) | No — but this route runs a **separate hard block** before either branch (§2) | `POST /api/initiatives` (`server/src/routes/pmo/initiatives.routes.ts:2872-2875`) | Primary interactive create path |
| 2 | `server/src/controllers/ToolController.ts:2564` | Yes (else-branch) | Yes, `ToolController.ts:2540-2545` | Tools → Initiative promotion | |
| 3 | `server/src/routes/assessment-workflow-v2.routes.ts:~1428` | Yes | Yes, `assessment-workflow-v2.routes.ts:1424-1428` | Assessment workflow v2 promote-to-initiative | |
| 4 | `server/src/routes/report-builder.routes.ts:5682` | Yes (one of two insert variants in same else-branch, columns-empty case) | Yes, `anchoredProjectId` built above (`report-builder.routes.ts:~5670`) | Report Builder → initiative from section | |
| 5 | `server/src/routes/report-builder.routes.ts:5717` | same else-branch as #4 (columns-present case) | Yes, same `anchoredProjectId` | same | |
| 6 | `server/src/routes/my-work.routes.ts:7238` | Yes | **No** — the `insertCols`/`add()` builder never adds `project_id` at all; the column is silently absent from the INSERT | My Work idea → initiative promotion | Every initiative created here is a `project_id` orphan regardless of the flag |
| 7 | `server/src/routes/economics.routes.ts:2004` | Yes | Yes, `economics.routes.ts:1997-1999` | Financial analysis → initiative | |
| 8 | `server/src/services/onboardingService.ts:~505` | Yes | Yes, `onboardingService.ts:~500-502` | AI onboarding plan → initiative | |
| 9 | `server/src/services/aiActionExecutor.ts:1178` | Yes | **No** — inserts `action.project_id` raw | AI action executor `_executeCreateInitiative` | |
| 10 | `server/src/services/reportImportService.ts:1559` | Yes | **No** — inserts `projectId \|\| importRecord.projectId \|\| null` raw | PDF report import → initiative | |
| 11 | `server/src/services/ToolInitiativeService.ts:299` | Yes | **No** — inserts `toolSession.project_id \|\| null` raw | Tool session → initiative | |
| 12 | `server/src/routes/pmo/initiatives.routes.ts:1232` | n/a (duplicate endpoint, not funnel-gated; its own fallback branch) | Yes, `resolveInitiativeProjectId` at `:1200-1204` | `POST /:id/duplicate` fallback (no-columns case) | |
| 13 | `server/src/routes/pmo/initiatives.routes.ts:1270` | n/a | Yes, `resolveInitiativeProjectId` at `:1263-1267` | `POST /:id/duplicate` (columns-present case) | Same route as #12, being edited live by another Lane B executor — read only, not modified |
| 14 | `server/src/services/reportInitiativeService.ts:~689` | Yes | **No** — inserts `projectId` raw (caller-supplied) | Report → initiative bulk save | |
| 15 | `server/src/services/assessmentInitiativeService.ts:1042` | Yes (checked elsewhere in file, `:953`) | **No** — `push('project_id', assessment.project_id \|\| null)` raw | Assessment → initiative | |
| 16 | `server/src/services/notebookConversionService.ts:338` | Yes | **No** — the `add()` builder never adds `project_id`; column absent entirely | Notebook → initiative conversion | Same defect shape as #6 |
| 17 | `server/src/services/cqrs/initiative/CreateInitiative.ts:47` | Yes | **No** — inserts `command.projectId` raw. **Also drops `organization_id` from the column list entirely** (not in the INSERT's column list at `:47-50`) | `CreateInitiativeHandler.execute`, dispatched via CQRS `registry.ts`/`initiativeService.ts` | Distinct, additional defect: org-id is never persisted on this path |
| 18 | `server/src/services/artifacts/ArtifactConversionService.ts:448` (+ catch-fallback `:480`) | Yes | **No** — inserts `conversion.projectId ?? null` raw | Artifact → initiative conversion | |
| 19 | `server/src/services/assessment/AssessmentWorkbenchService.ts:658` | **No — unconditional, not gated by the flag at all** (no `INITIATIVE_FUNNEL_ENABLED` check anywhere in this file) | **No** — `add('project_id', projectId)` raw, caller-supplied | Fires automatically when a P28 assessment workbench transitions to `'completed'` (`AssessmentWorkbenchService.ts:814-822`) | Permanent writer, independent of the flag rollout story entirely |
| 20 | `server/src/services/initiative/InitiativeDefinitionService.ts:193` (col list built `:159`) | Yes (`:102`) | **No** — `push('project_id', data.project_id \|\| null)` raw | `InitiativeDefinitionService.createInitiative` | Caller-reachability not traced further (out of time budget); flag-gated at minimum |

**Excluded from the live count** (verified, not just asserted):
- `server/src/routes/initiatives.routes.ts:186` — a **second, unmounted** `initiatives.routes.ts`
  (distinct from `routes/pmo/initiatives.routes.ts`). Confirmed dead: `grep` for every import
  spelling of this specific path across `server/src` finds no importer in `Gateway.ts` or anywhere
  else. **This file was mentioned in the prior inventory's raw-grep hit list but is not a live
  writer.** Illustrates the CLAUDE.md rule "verify the real caller, not the grep hit."
- `server/src/services/demo/demoSeedService.ts:2298` — explicit, documented exception
  ("USPOJNIENIE A3", `demoSeedService.ts:2290-2296`): idempotent `ON CONFLICT(id) DO UPDATE` seed
  writer, deterministic ids, not a user-facing creation path.
- `server/src/services/health/healthProbeService.ts:380,752,811` — synthetic monitoring probes that
  insert and then delete a throwaway row against the live DB; not a user data-creation path, though
  they do exercise the same table and would need updating in step with any schema change.
- `server/src/scripts/t01InitiativeGateDecisionRealDbProof.ts:159`,
  `server/src/scripts/t01InterviewRealDbProof.ts:1284,1831`,
  `server/src/scripts/agentMigrationsIdempotencyRealDbProof.ts:107` — manually/CI-run proof
  scripts, not HTTP-reachable production writers.

**Live writer inventory to the relational `initiatives` table today: 19 files, ~20 call sites**
(counting the two InitiativeController branches and the two report-builder/pmo-duplicate variants
as one call site each per file). Of these, only **7** (`#1` partially via hard-block, `#2,3,4,5,7,8,12,13`)
route through `resolveInitiativeProjectId` at all; **12** insert `project_id` completely unanchored,
and **2** (`#6,#16`) don't even include the column.

## 2. The dormant "canonical funnel" — `createInitiativeService.ts`

`server/src/services/initiative/createInitiativeService.ts:213,278` is the intended single writer
(module docstring, `:5`: "Gwarantuje jeden kontrakt"). It is reached only when
`INITIATIVE_FUNNEL_ENABLED === 'true'` in every one of the 20 call sites in §1 that check the flag —
confirmed by grep (`grep -rn "INITIATIVE_FUNNEL_ENABLED" server/src` → every production match is
either the guard itself or a comment referencing it; no site invokes the funnel unconditionally
except through this same `if` check). At shipped defaults (`.env.example`, `.env.production.example`,
`.env.staging.example` — none sets this var) **the funnel never executes on any of these 20 sites.**

## 3. `initiativeProjectPolicyService.ts` / `REQUIRE_INITIATIVE_PROJECT`

File: `server/src/services/initiativeProjectPolicyService.ts` (NOTE: not at
`server/src/services/initiative/initiativeProjectPolicyService.ts` as the task brief assumed — it is
one directory level up, at `server/src/services/initiativeProjectPolicyService.ts`).

- `isRequireInitiativeProjectEnabled()` (`:33-35`): `process.env.REQUIRE_INITIATIVE_PROJECT !==
  'false'` — **confirmed default ON**, no env template overrides it.
- `resolveInitiativeProjectId(orgId, projectId, opts)` (`:124-142`): if `projectId` is already
  truthy, returns it unchanged (no policy applied); if empty and the flag is ON, lazily
  resolves/creates the org's system "Portfel" project (`resolveOrCreateSystemPortfolioProject`,
  `:47-101`) and returns that id; **fail-soft everywhere** — any DB error degrades to `null`
  (`:134-141`), never throws, never blocks the write.
- This is a **convenience auto-anchor helper that only runs where a caller explicitly invokes it.**
  It is not middleware, not a DB constraint (no `NOT NULL` on `initiatives.project_id`, not verified
  further but not claimed here either), and not wired into every write path.
- **Only 8 of the ~20 writer call sites in §1 call it** (`#2,3,4,5,7,8,12,13`). The other 12 write
  `project_id` unanchored or omit the column, so `REQUIRE_INITIATIVE_PROJECT=true` (the shipped
  default) is **not actually enforced on most live write paths** — it is enforced only where each
  writer happened to opt in.
- The **one genuine hard block** is `InitiativeController.ts:474-483`: when
  `isRequireInitiativeProjectEnabled()` is true and `req.body.projectId` is falsy, the interactive
  `POST /api/initiatives` route returns `400 INITIATIVE_PROJECT_REQUIRED` **before either the
  funnel or raw-insert branch runs** (comment at `:480-483` confirms this is deliberate: "Runs
  BEFORE the funnel/raw-insert branch ... regardless of INITIATIVE_FUNNEL_ENABLED"). This blocks a
  missing project on the *primary human-driven* create path only; it does not anchor — the caller
  must already supply a valid `projectId`, it does not auto-resolve one.

**Verdict on "is the policy enforced on every write path or only some": only some.** Confirmed:
1 hard block (route #1, human path only) + 7 soft auto-anchors (routes #2,3,4,5,7,8,12,13) out of
~20 live writers. 12 writers persist unanchored/orphan `project_id` today even though
`REQUIRE_INITIATIVE_PROJECT` defaults ON.

## 4. Capability/RBAC — the shadow-mode finding is CONFIRMED, verbatim as suspected

`server/src/middleware/effectiveCapability.middleware.ts`:
- `:44` — `capabilityEnforceMode()`: `(process.env.CAPABILITY_ENFORCE ?? 'shadow').trim()
  .toLowerCase() === 'enforce' ? 'enforce' : 'shadow'`. **Default is `'shadow'`, confirmed — no env
  template sets `CAPABILITY_ENFORCE`.**
- `:104-120` (`handleShadowCapability`) — doc comment at `:22-26` states explicitly: "When `shadow:
  true` and `CAPABILITY_ENFORCE` is unset or `shadow` (the default), the middleware NEVER blocks: it
  resolves effective access, logs ... and always calls `next()`. This is pure telemetry."

`server/src/routes/pmo/initiatives.routes.ts` — **every single**
`requireInitiativeCapability(...)` call in this file passes `{ shadow: true, ... }` (checked all 20
occurrences via grep, including `initiative.create` at `:1187` (duplicate route) and `:2872` (primary
create route), `initiative.update`, `initiative.dependency.manage`, `initiative.program.manage`,
`initiative.template.manage/apply`, `initiative.change.manage`, `initiative.section_type.manage`).
None omit `shadow: true`.

**Conclusion, stated plainly: at shipped defaults, no initiative write in this codebase — create,
update, duplicate, template apply, program/dependency management — is ever blocked by RBAC.**
Every capability gate resolves effective access, logs a `wouldAllow` verdict for telemetry, and
calls `next()` unconditionally. This is a real, serious gap, not a phantom flag: the gate has a full
implementation (`resolveEffectiveAccess`/`hasEffectiveCapability` in
`server/src/services/effectiveAccessService.ts`), it is wired into every relevant route, and it
still never returns a 403 because the *mode* switch defaults to log-only.

**What would need to change:** flip `CAPABILITY_ENFORCE=enforce` in the deployed environment (no
code change required — this is a pure env var flip, `effectiveCapability.middleware.ts:44`). This is
an **operational/deploy change, not a Lane B code change**, and is explicitly **out of the Lane B
lease** (Lane B is evidence-only per the HARD RULES; flipping a production env var is also outside
"evidence"). Before flipping it, the shadow logs (`{userId, capability, route, method, projectId,
wouldAllow}`) should be reviewed to confirm real users would not be broken — that data-driven check
was the explicit design intent of shadow mode (`effectiveCapability.middleware.ts:19-26`).

## 5. What "writer inventory = 1" would require

To collapse the relational-model writer count from ~20 files to 1 (`createInitiativeService.ts`) the
following would be needed, with an explicit in-lease/out-of-lease split (Lane B's current lease for
these two tasks is evidence-only in `docs/program/evidence/closure/b/**`, and it may not touch
`initiativeCandidateService.ts`, `postgresMaterialCommandUnitOfWork.ts`, or
`initiatives.routes.ts` even under a future code-writing lease, since those are leased to other
live executors):

1. **Flip `INITIATIVE_FUNNEL_ENABLED=true` by default** (or delete the flag and always call the
   funnel) — this alone reroutes all 20 `else`-branch call sites in §1 through
   `createInitiativeService.ts`, closing the project-anchoring gap for the 12 currently-unanchored
   writers for free (the funnel anchors internally, per `initiativeProjectPolicyService.ts:104-107`
   doc comment referencing `createInitiativeService.ts` lines ~173-178).
2. Each of the ~20 call sites still needs its **post-funnel column backfill** kept working (several
   already do this today for funnel-unknown columns, e.g. `priority_order`, `type`,
   `estimated_effort` — see `ToolController.ts` comment at `:2456-2459`, `ToolInitiativeService.ts`
   `:283-296`, `reportInitiativeService.ts` `:658-673`) — i.e. the funnel's column contract needs to
   be a superset, or every caller keeps a follow-up `UPDATE`. This is call-site-by-call-site work
   across all ~14 files listed in §1, not a single change.
3. **`AssessmentWorkbenchService.ts:658`** needs the flag check added — today it is not gated at
   all, so flipping the flag's default does not fix it; it must be migrated explicitly.
4. **`server/src/services/cqrs/initiative/CreateInitiative.ts:47-58`** has the extra,
   unrelated `organization_id` omission bug that must be fixed independent of the funnel migration.
5. **`InitiativeController.ts`'s hard-block-then-branch logic (§3)** must be preserved or
   reimplemented as-is post-migration — it is the one correctly-enforced policy point today and is
   not itself a defect.
6. The **"canonical runtime" aggregate model (§0)** is architecturally out of scope for a "writer
   inventory = 1" collapse of the *relational* table — it is a parallel system with its own single
   writer already (`registerInitiative` + `postgresMaterialCommandUnitOfWork.ts`, which is itself
   leased to another Lane B executor right now). Reconciling the two initiative models (so that
   "an initiative" means one thing across `/api/initiatives` and `/api/initiatives/runtime-v1/*`) is
   a distinct, larger piece of work not covered by "writer inventory = 1" as scoped in this task.

**Span:** ~14-15 production files touched for the relational collapse (§1 minus the already-correct
`InitiativeController.ts` hard block, minus the intentionally-excluded demo seed/health-probe/dead
files), plus `CreateInitiative.ts`'s separate bug, plus the `initiativeCandidateService.ts` /
`postgresMaterialCommandUnitOfWork.ts` / `initiatives.routes.ts` files already **actively being
edited by other Lane B executors in this same worktree** (per the task's HARD RULES) — those three
are explicitly **out of Lane B's editable lease for this task** regardless of any future
code-writing mandate; they were read-only inputs to this analysis, never modified.

**Lane B may edit under the current (evidence-only) lease: zero of the above** — this task's lease
is `docs/program/evidence/closure/b/**` only. No source file was modified to produce this analysis.

## 6. Recommended verdict

**`PARTIAL`**

Reasoning: the profile/policy story is coherently *designed* (one funnel, one anchoring helper, one
capability gate, all flag-gated for safe rollout) but **not actually converged at shipped defaults**:
writer inventory is ~20 files not 1, project anchoring covers 8/20 writers not all, and capability
enforcement is verified to be zero-blocking everywhere. None of this is a phantom-flag situation —
every flag has a real implementation and real callers; the gap is that the flags default to the
pre-consolidation, non-enforcing state. This is not `BLOCKED_OWNER` (no missing decision is needed —
the anchoring/funnel/capability code all already exists and the direction is already documented in
`initiativeProjectPolicyService.ts`'s own comments); it is not `FIX_REQUIRED` in the Lane B
evidence-only sense (Lane B cannot fix it under this lease); it is `PARTIAL` because meaningful
pieces (the interactive hard block, the funnel's existence, the capability telemetry) are real and
working, while the aggregate writer count and default RBAC enforcement are not.
