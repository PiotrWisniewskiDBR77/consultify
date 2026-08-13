# Q2 — scope accounting: run/case outcomes, closure verdict, criteria matrix, journey adjudication (2026-08-12)

Worktree `/Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809`,
branch `claude/case-workspace-v1-20260809`, HEAD at start `d72eb74966` (clean).
Role: **worker, adjudication/accounting only** — no product code touched.
Files touched by this packet: this directory, `CRITERIA_MATRIX_219.csv` (new,
same directory), one append-only row to
`docs/product/case-workspace/acceptance/VISUAL_TRIADA_SPEC_A_LEDGER.csv`
(`ARTIFACT-PANEL-SECTIONS-M4b`, LF-only, `git diff --stat` shows `1 insertion(+)`).
`CUSTOMER_JOURNEY_LEDGER.csv` was read only, not appended to — every fact this
packet needed was already recorded there in full detail by packet M5.

Backend used for all live probes: `127.0.0.1:3001`, PID `43176`
(coordinator-owned; `curl .../api/health` → 200, `database: connected`,
confirmed before starting; never restarted). Disposable Postgres
`case_workspace_test` @ `55432`, `case_workspace` role, synthetic data only.

---

## TASK 1 — Run-level PARTIALLY_ACCEPTED and Case-level COMPLETED_PARTIAL

Both **reached**. The coordinator's original "unreachable via HTTP" claim
stays FALSE, now closed out with fresh, independent proof rather than a
corrected guess.

### 1a. Run-level `PARTIALLY_ACCEPTED`, driven personally over live HTTP

Full sequence run against the live coordinator backend, `cw.local@local.test`,
real JWT from `POST /api/auth/login`:

1. `POST /api/v8/case-workspace/cases` — `{"projectId":"cw-stream-a-project",
   "caseProfile":"STANDARD","contractedClosureType":"DELIVERY_COMPLETED",
   "sponsorUserId":"cw-local-user"}` → 201,
   `caseId=case-5c32f92f-84ff-482b-897c-9d634cccecc6`, `caseProfile: STANDARD`
   (STANDARD/TRANSFORMATION is the documented gate for `createRun` —
   `runLifecycleService.ts:610-649`; LIGHT is the one that must use the
   one-click path, confirmed by reading the same function this session).
2. `POST /cases/:caseId/plan-versions` with a minimal valid `semanticGraph`
   (schema per `contractHarness.ts:303` `minimalGraph()`) → `DRAFT` v1.
3. `POST /plan-versions/:id/propose` → `IN_REVIEW` v2.
4. `POST /plan-versions/:id/publish` → `PUBLISHED` v3.
5. `POST /cases/:caseId/runs` with `casePlanVersionId` + `Idempotency-Key`
   header → 201, `runId=cwrun-12dd60a5b557464fded08487eabdacc2`,
   `status: CREATED`.
6. `POST /runs/:runId/cancel` `{"expectedVersion":1,"reason":"..."}` → 200,
   `status: CANCELLED` — `CREATED → CANCELLED` is a directly allowed edge in
   `ALLOWED_TRANSITIONS` (`runLifecycleService.ts:316`), the fastest honest
   path to a "technically complete" run status without inventing NodeRun
   machinery out of scope for this packet.
7. `POST /runs/:runId/outcome` `{"expectedVersion":2,"outcomeStatus":
   "PARTIALLY_ACCEPTED"}` → 200, response body:
   `"status":"CANCELLED","outcomeStatus":"PARTIALLY_ACCEPTED","version":3`.

**SQL readback** (own probe, `pg` client, disposable Postgres @ 55432,
independent of the API's own response):

```
select run_id, case_id, status, outcome_status, version
from case_workspace_runs
where run_id = 'cwrun-12dd60a5b557464fded08487eabdacc2';

 run_id                                    | case_id                                | status    | outcome_status      | version
 cwrun-12dd60a5b557464fded08487eabdacc2    | case-5c32f92f-84ff-482b-897c-9d634cccecc6 | CANCELLED | PARTIALLY_ACCEPTED | 3
```

`recordRunOutcome` (`runLifecycleService.ts:1670`) requires the run to already
be `COMPLETED | COMPLETED_WITH_WARNINGS | FAILED | CANCELLED | COMPENSATED`
before an outcome can be recorded (§4.4's "technical completion is separate
from outcomeStatus") — this run genuinely satisfied that gate rather than
bypassing it.

### 1b. Case-level `COMPLETED_PARTIAL`, over real HTTP, real Postgres

Ran `goldenCaseRequestChangesPartialRetry.pg.test.ts` myself:

```
cd server && DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  POSTGRES_SKIP_INIT_IN_TEST=1 \
  DATABASE_URL="postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test" \
  npx vitest run src/services/caseWorkspace/__tests__/goldenCases/goldenCaseRequestChangesPartialRetry.pg.test.ts --environment node

 Test Files  1 passed (1)
      Tests  1 passed (1)
```

This is a genuine HTTP-driven proof, not a service-layer shortcut: the test
uses `createGoldenCaseApp()` (`goldenCaseHarness.ts:72`), which mounts the
**real** `routes/caseWorkspace/index.ts` router behind `supertest`, and drives
`POST /cases` (`caseProfile: STANDARD`) → propose/publish plan → proposal 1
`REQUEST_CHANGES` → proposal 2 `APPROVED` → `EXECUTING` → `FAILED` → retry →
`EXECUTED` → node result `resultAcceptance: PARTIAL` → `POST /cases/:caseId/
closure-axis` → `POST /cases/:caseId/closure {"closureType":"COMPLETED_PARTIAL",
"evidenceRef":...}` → `POST /cases/:caseId/status {"targetStatus":"CLOSED"}`.
Its own **SQL readback**, executed inside the test against the same disposable
Postgres:

```ts
const caseRow = await control.query(
  `SELECT case_status, closure_type FROM case_core WHERE case_id = $1`,
  [caseId]
);
expect(caseRow.rows[0]).toMatchObject({ case_status: 'CLOSED', closure_type: 'COMPLETED_PARTIAL' });
```

— asserted, and the suite passed. This satisfies the task's own either/or
("run the golden-case test yourself and show the SQL readback, or drive it
over HTTP") on both counts at once, since the golden case *is* HTTP-driven.

**Bonus finding, load-bearing for Task 2**: this same test's route calls
(`POST /cases/:caseId/closure-axis`, `POST /cases/:caseId/closure`) are the
concrete proof that a real, mounted, HTTP-reachable closure route exists —
see Task 2.

---

## TASK 2 — Case-closure defect: verdict = **(a) IN V1, unimplemented at the client/UI layer only**

**Verdict: IN V1.** No exception exists. Per the task's own rule
("without a citation it stays IN SCOPE"), the burden was on finding an
out-of-scope citation, and none exists for closure itself (`11_OWNER_DECISION_
REGISTER.md` has zero occurrences of the word "closure" anywhere in its 12
owner decisions — grepped in full).

### Canon citations, closure is a first-class V1 concept

- `00_CASE_WORKSPACE_CANON.md:84` (§8, "Results and value"): "Delivery,
  Decision, Implementation and Outcome are separate closure levels."
- `04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md` §4.1 (Case state machine, ~line
  203-209): "`CLOSED` records one immutable `CaseClosureRecord` with the
  contracted closure type: `DELIVERY_COMPLETED | DECISION_COMPLETED |
  IMPLEMENTATION_COMPLETED | OUTCOME_VALIDATED | COMPLETED_PARTIAL`... Run
  completion alone does not close a Case."
- `12_CASE_WORKSPACE_MODULE_SSOT.md` §6.4 "Closure" (line 184-198): repeats
  the same five closure types verbatim, "Run completion does not close a
  Case. Delivery does not prove benefit. Benefit does not prove
  sustainability."
- `14_COMPLETE_DOD_EPICS_ACCEPTANCE_AND_CLAUDE_PROMPT.md`: EPIC E11
  ("history, closure, value and Monitoring", line 179) and DoD-B's own
  checklist item: "Contracted closure, acceptance criteria, autonomy and
  tier history persist." (line 232).

### Server layer — COMPLETE and proven reachable over real HTTP

- `server/src/services/caseWorkspace/caseCoreService.ts:807` —
  `updateClosureAxisStatus` (tagged `CW-00-016, CW-00-017` in its own header
  comment) and `caseCoreService.ts:872` — `recordClosure` (tagged
  `CW-RT-027, CW-SSOT-6.4-01, HIST-013`).
- `server/src/routes/caseWorkspace/cases.routes.ts:204` — `POST /cases/
  :caseId/closure-axis` (`updateClosureAxisStatus`), `cases.routes.ts:223` —
  `POST /cases/:caseId/closure` (`recordClosure`).
- Mounted: `routes/caseWorkspace/index.ts:45` — `router.use(casesRoutes)`
  (confirmed by reading the file directly; `cases.routes.ts` is not one of
  the "not mounted yet" files — that caveat applies only to
  `runLifecycle.routes.ts`, a different router, and even that one **is**
  mounted at `index.ts:58`, its own header comment is simply stale).
- Reachability proof: Task 1b's golden-case run drives both routes over real
  HTTP and reads back `closure_type = 'COMPLETED_PARTIAL'` from Postgres.

### Client layer — the gap is real, confirmed independently twice

- `grep -n "closure" src/components/CaseWorkspace/api.ts` → **zero matches**
  (this packet, 2026-08-12). Packet M5 (`evidence/m5-journeys-2026-08-12/
  README.md`, finding 4, and `CUSTOMER_JOURNEY_LEDGER.csv` row `CW-JRN-18`)
  independently found and recorded the same fact the same day: "A full-file
  grep of `api.ts` for the string `closure` returns nothing — there is no
  client function for any closure endpoint at all."
- Every other `src/components/CaseWorkspace/*.tsx` reference to "closure"
  (`CaseDetailScreen.tsx`, `RezultatyView.tsx`, `PlanView.tsx`,
  `CasesListScreen.tsx`) is **read-only display** — labels, status pills,
  the evidence-ref value ("Dowód zamknięcia") — none of them call an API to
  *write* a closure. Grepped and confirmed line-by-line this packet.

### Exact gap, per layer

| Layer | State |
|---|---|
| Canon/contract | Fully specified (5 closure types, 2 axes, immutability rule) |
| DB schema | Present (`case_core.closure_type`, `closed_at`, `closed_by_actor_id`, `closure_evidence_ref`, axis status columns — confirmed live via the `POST /cases` response body in Task 1a, which already carries `closureType:null, closedAt:null,...deliveryStatus:"NOT_APPLICABLE"` etc. on a freshly created case) |
| Service | Complete — `recordClosure`, `updateClosureAxisStatus` |
| Route | Complete, mounted, HTTP-reachable — `POST /cases/:caseId/closure`, `POST /cases/:caseId/closure-axis` |
| **Client (`api.ts`)** | **Missing** — zero exported functions for either endpoint |
| **UI** | **Missing** — zero buttons/controls anywhere in `src/components/CaseWorkspace/*.tsx` that could call them even if the client functions existed |

**What "fixing" this requires, precisely**: two new `api.ts` exports
(`updateClosureAxisStatus`, `recordClosure`, matching the existing pattern
other write actions use — e.g. `startRun`, `retryProposal`), and a UI entry
point (most naturally in `RezultatyView.tsx` or `CaseDetailScreen.tsx`, where
closure state is already displayed) that calls them. No server or schema
work is needed. This is reported, not implemented — out of this packet's
allowlist.

---

## TASK 3 — Criteria matrix, 219 `APPLICABLE_REQUIRED_V1` rows

Full matrix: `CRITERIA_MATRIX_219.csv` in this directory (225 rows: 218
currently-open + 4 PASS + 3 FAIL, columns `criterion_id, applicable, status,
implementation_or_evidence, test_ref, result, final_sha, blocker_group,
owner_of_missing_dependency, source_file_line`). `final_sha` is
`PENDING-CANDIDATE-SHA` throughout per the hard rules.

### Independent recount — corrects the headline "212" to **218**

The task brief (quoting packet M4) states "212 unverified." This packet
**independently recomputed the current truth** by resolving the ledger's own
`supersedes_row_id` chains (a row is "current" only if no other row names it
in `supersedes_row_id`) rather than trusting the raw `status` column, which
still holds stale values on superseded rows (append-only ledger, by design —
old rows are never edited in place):

```
236 current-truth leaf rows (of 474 total rows in the CSV):
  APPLICABLE_REQUIRED_V1        218   <- was reported as 212
  NOT_APPLICABLE_TO_THIS_SURFACE  6
  DEFERRED_POST_V1                5   (6, after this packet's own correction below)
  PASS_WITH_EVIDENCE              4
  FAIL                            3   (2, after this packet's own correction below)
```

The 6-row gap traces to one specific, self-documented artifact: M4's own
README (§6, "self-correction within this pass") records that `CW-RT-031-M4`
was first classified `APPLICABLE_REQUIRED_V1`, then the packet caught its own
error and superseded it with `CW-RT-031-M4b` (`FAIL`) later in the *same*
session — the intermediate row's `status` field still literally reads
`APPLICABLE_REQUIRED_V1` in the CSV (append-only), so a naive `status ==
'APPLICABLE_REQUIRED_V1'` count double-books it. Resolving the chain to the
true leaf removes it from the open count. The remainder of the 212→218 gap
is M4's own prose arithmetic in its README not exactly matching its own CSV
output (235 total − 6 − 4 − 4 − 3 = 218, not 212) — the CSV itself, now
verified twice independently (M4's tool and this packet's), is the authority.

### Second correction made by this packet: `ARTIFACT-PANEL-SECTIONS-M4` was stale FAIL

Independently found, not carried over from any sibling packet: **Owner
Decision OD-12** (`11_OWNER_DECISION_REGISTER.md`, committed
`91d300a607`, `2026-08-12T20:45:36+02:00` — chronologically *after* M4 wrote
its `ARTIFACT-PANEL-SECTIONS-M4` FAIL verdict) explicitly defers the
`Komentarze` right-panel section past V1. OD-12's own carve-out ledger row
(`ARTIFACT-SPEC-A-COMMENTS-OD12`) scoped itself **only** to the sibling
compound row `ARTIFACT-SPEC-A-SHELL-M4` (source line 768) and, by its own
explicit text, deliberately left `ARTIFACT-PANEL-SECTIONS-M4` (source line
913 — the **same** underlying "Komentarze missing from `CaseDetailScreen.
tsx`'s right-panel accordion" defect) untouched. Re-verified live this
packet: the accordion still shows exactly AKCJE / WŁAŚCIWOŚCI / POWIĄZANIA /
ŹRÓDŁA I ZAŁOŻENIA / HISTORIA, Komentarze absent, and the file's own header
comment now cites OD-12. Appended one correction row,
`ARTIFACT-PANEL-SECTIONS-M4b` (supersedes `ARTIFACT-PANEL-SECTIONS-M4`,
status `DEFERRED_POST_V1`, citing OD-12), to
`VISUAL_TRIADA_SPEC_A_LEDGER.csv` — append-only, LF-only, `git diff --stat`
shows exactly `1 insertion(+)`. **True current FAIL count: 2**
(`CW-03-009-M4` — Polish plan-status label mismatch, live-reproduced by M4;
`CW-RT-031-M4b` — the identical label defect on a sibling row), not 3.

### The 4 PASS rows (unchanged, re-confirmed by reading each cited evidence file)

`CW-RT-038-U2`, `CW-SSOT-7.4-03-M4`, `CW-DOD-F5-M4`, `CW-DOD-H7-U2` — each
cites a specific evidence directory (`f3-partial-skipped`,
`c4-deliverable-ui`, source-level crimson grep, `l3-axe-completion`
respectively); not re-litigated here, present in full in the matrix CSV.

### The 218 genuinely-open rows, grouped by real blocker (not re-verified by hand, honestly bucketed)

| Blocker group | Count | Owner |
|---|---:|---|
| `GENERIC-CW-SWEEP` — Case Workspace's own screens (Case Detail, Plan/Realizacja/Rezultaty, Zlecenia list) already carry *some* live evidence for other criteria, but this specific clause was never individually checked | 103 | Case Workspace UI/backend |
| `SHARED-LIST-STANDARD` — TRIADA_KANON / MY_WORK_TABLE_SURFACE_CONTRACT geometry/token rules (Menu 1/2/3 pixel dimensions, table row hairlines, kebab zone counts, color tokens) that are properties of the **shared** `src/components/standard/{StandardModuleBar,StandardTable,StandardPreview}` components, not Case Workspace's own code — evidenced by `CasesListScreen.tsx`'s own header comment ("Kanon... pasek modułu to `StandardModuleBar`, tabela to `StandardTable`, podgląd to `StandardPreview`. Ten plik NIE...") plus grep-confirmed unmodified imports at lines 22-24, 983, 1021, 1061, 1098, and its own inline comment "`StandardTable` nietknięty" (untouched) at line ~1047 | 40 | platform shared-UI (`src/components/standard/*`) |
| `ARTIFACT-SHELL-SWEEP` — SPEC-A shell rows against `CaseDetailScreen.tsx`'s own `ArtifactRightPanel` instance. **Kept as a Case Workspace-owned bucket, not delegated to shared code**, precisely because this pass already found one proven, live divergence in this exact surface (the Comments-section omission, §above) — a blanket "shared component, not our problem" claim would be false here | 30 | Case Workspace UI (`CaseDetailScreen.tsx` / `ArtifactRightPanel` instance) |
| `CW-CONTENT-SWEEP` — the content-declaration half of `TRIADA-*`/`MYWORK-*` (which domain columns, which filter chips, which saved views the Zlecenia table declares) — this is the module's own job even when the chrome is shared ("moduł deklaruje treść, komponent narzuca wygląd" — CLAUDE.md rule #1) | 28 | Case Workspace UI (Zlecenia list content) |
| `ZOOM-200-NO-EVIDENCE` — 200% browser zoom, named mandatory (`CW-DOD-H2`, `CW-SSOT-7.5-02`), no evidence directory addresses it | 5 | Case Workspace UI (full sweep at 200% zoom) |
| `PLAN-EKSPERCKI-LISTA-NO-EVIDENCE` — every live evidence directory (E5, L3, M1, F1-F3) exercises Plan **Prosty** only; Ekspercki/Lista projections (`CW-02-015/016`, "three synchronized views, same graph digest") are entirely unverified | 4 | Case Workspace UI (Plan tab, Ekspercki/Lista) |
| `ATTENTION-QUEUE-SHARED` — the cross-Case "Wymaga uwagi" attention queue is explicitly named in canon as living **in My Work**, a shared surface (`CW-02-004`: "a shared attention queue through My Work") — Case Workspace's own responsibility is limited to feeding correct rows into it, not owning the queue UI | 3 | My Work module (shared queue owner) |
| `SAVED-VIEWS-NO-EVIDENCE` — the six named saved views (`Wymaga mojej uwagi`, `Moje aktywne`, `Zespół`, `Szkice`, `Zaplanowane`, `Zakończone` — `CW-02-010`) have no evidence exercising any of them | 2 | Case Workspace UI (Zlecenia list) |
| `WAITS-UI-NO-EVIDENCE` | 1 | Case Workspace UI (Realizacja wait-state rendering) |
| `MOBILE-NO-EVIDENCE` — `<768px` Zlecenia list as single-column card (`CW-SSOT-16-02`); F3/C4 captured mobile screenshots of *tables* scrolling, not this specific claim | 1 | Case Workspace UI (Zlecenia list, `<768px`) |
| `VOICEOVER-BLOCKED` | 1 | Environment/host — VoiceOver requires a real macOS Accessibility setting change, out of bounds for an unattended session; documented pre-existing blocker (`TERMINAL_STATUS_2026-08-12.md`, "BLOKER 3") |
| **Total** | **218** | |

**Whole-product-debt proof, explicitly, per the task's instruction**: the
`SHARED-LIST-STANDARD` bucket (40 rows) is the one genuinely arguable as "not
a Case Workspace criterion." The proof is the canon citation plus source
evidence above (CLAUDE.md rule #1 mandates list screens be built *only* from
`src/components/standard/*`; `CasesListScreen.tsx` is confirmed, by its own
header comment and unmodified imports, to comply) — **not** merely "this
looks generic." Everything else stays counted as a Case Workspace criterion,
per the task's own default rule.

---

## TASK 4 — The 14 PARTIAL customer journeys

`CUSTOMER_JOURNEY_LEDGER.csv` carries `CW-JRN-01`..`CW-JRN-18`, all written by
packet M5 the same day with per-journey re-verification (five golden-case
files + `chatIntake.pg.test.ts` personally re-run by M5, `2026-08-12 20:19-
20:23`, all PASS). Exactly **14** carry `status: PARTIAL`
(`CW-JRN-01,02,03,04,05,06,07,08,10,12,15,16,17,18`); the other 4
(`CW-JRN-09,11,13,14`) are `IMPLEMENTED_AND_PROVEN`. This packet read every
row's full text and evidence citation (not just the status column) before
adjudicating; no journey below is upgraded past PARTIAL on a lower-level
test, per the task's own rule.

| Journey | Missing piece | Inside / External |
|---|---|---|
| **CW-JRN-01** — informational Chat produces zero Case | The propose→confirm mechanism is real over a real HTTP route (14/14 tests PASS), but the chat-response-assembly layer never attaches `case_intake_proposal` metadata to a message, so `CaseIntakeConfirmCard.tsx` never renders in a live conversation (`MessageRenderer.tsx` own comment: "Nothing in this chat pipeline attaches this metadata type today") | **EXTERNAL** — blocker is the AIChat/Teresa message-orchestration layer (`MessageRenderer.tsx` and whatever assembles chat responses), a different module than Case Workspace; owner: **Chat/Teresa module** |
| **CW-JRN-02** — LIGHT one-click, single semantic op | Inherits CW-JRN-01's chat gap (light-start is only reachable on a case that already exists, not via a real confirmed chat proposal); *additionally* the deliverable-link/closure half at the end is backend-only (same as CW-JRN-15/18) | **MIXED**: primary blocker EXTERNAL (Chat/Teresa, same as JRN-01); secondary blocker INSIDE (artifact-link write path / closure UI, Case Workspace) |
| **CW-JRN-03** — STANDARD plan→run, end to end | (1) `case_core.current_plan_version_id` never written server-side (open question in `casePlanVersionService.ts`'s own header); (2) `updatePlanDraft` has a real call site (`PlanView.tsx:256`) but zero reachable UI control (`onClick`/button) that triggers it | **INSIDE** — both gaps are Case Workspace's own code: (1) `casePlanVersionService.ts` (server), (2) `PlanView.tsx` (UI, missing button wiring) |
| **CW-JRN-04** — TRANSFORMATION, multi-module | Cross-module artifact linking has zero real UI callers (`RezultatyView.tsx`/`CaseDetailScreen.tsx` explicitly comment why they do *not* call `linkArtifactToCase`); capability-adapter bootstrap is gated behind two unset env vars, live-process state not verifiable without restart | **INSIDE** for the artifact-link UI gap (Case Workspace); the capability-boot gate is **configuration/ops**, not a code gap — owner: deployment/ops env-var provisioning, not a Case Workspace code defect |
| **CW-JRN-05** — module artifact used with zero Case | The negative-space design claim (Case Workspace never touches a module's canonical object) is proven at the schema/backend level; a *live* demonstration of a real other module (e.g. Documents) producing an artifact through its own UI with zero Case-workspace involvement was not attempted | **EXTERNAL** — driving that proof requires the other module's own product surface (e.g. Documents/Materials); owner: **that module's team**, not Case Workspace |
| **CW-JRN-06** — late-binding, pointer not copy | Backend contract (pointer update, schema has no content/payload column) is solid; the WRITE path (`linkArtifactToCase`/`pinArtifactRevision`) has zero UI callers — a user cannot late-bind an artifact through the product today | **INSIDE** — `RezultatyView.tsx`/`CaseDetailScreen.tsx` missing UI controls for an existing, working `api.ts` function |
| **CW-JRN-07** — REQUEST_CHANGES terminal | Backend fully proven (409 refusal, no new decision row); UI wiring confirmed only by static code trace (`RealizacjaView.tsx`'s "Poproś o zmiany" button, pre-existing), not independently re-driven with a fresh screenshot in this pass | **INSIDE** — evidence gap, not a code gap: Case Workspace's own live-verification backlog (needs one fresh click-through + DB readback) |
| **CW-JRN-08** — REJECTED, Case still closes | Backend solid (rationale/evidence durable); "Odrzuć" UI wiring confirmed by code trace only, not re-driven live; **Case-level closure after rejection has no UI trigger at all** (same root cause as CW-JRN-18) | **INSIDE** — both the live-click evidence gap and the closure-UI gap are Case Workspace's own (`RealizacjaView.tsx`, `api.ts`) |
| **CW-JRN-10** — wait blocks and resolves | HUMAN-wait satisfy is real, UI-backed (`RealizacjaView.tsx:360`); TIMER-type multi-day survival is unevidenced; live click-through of "Podaj dane" not independently re-driven this pass | **INSIDE** — both the TIMER-wait test-coverage gap and the live-click evidence gap belong to Case Workspace's own wait subsystem |
| **CW-JRN-12** — retry + restart | Proposal-level retry is fully proven, UI+DB, live-clicked. Process-restart durability is real (30-minute worker-kill/recover window, committed JSON snapshots) but is infrastructure-level, not a user-facing product action — no product control "restarts a Case" | **INSIDE**, and arguably not a real gap at all — the "restart" half is a scope/definition mismatch (an ops-level DAG-worker durability proof, correctly distinct from a user journey), not a missing capability; no external dependency involved |
| **CW-JRN-15** — view/pin/unlink an artifact link | View/open (read) is real and demonstrated live. Pin-new-revision, mark-stale, mark-unavailable, unlink (the write actions this journey's own title names) exist **only** as `api.ts` exports — zero `.tsx` call sites anywhere in `src/` | **INSIDE** — `RezultatyView.tsx`/`CaseDetailScreen.tsx` missing UI controls for four already-implemented, already-exported `api.ts` functions |
| **CW-JRN-16** — deliverable chip opens owning module | Open+return+keyboard-nav+refresh-survival all real and demonstrated live. The deep link carries artifact identity but **no revision parameter** — "opens at the pinned revision" is unproven at the UI boundary even though the server pins the revision correctly | **INSIDE** — `src/utils/artifactLinks.ts` / `RezultatyView.tsx` deep-link construction, missing a query parameter |
| **CW-JRN-17** — replan supersedes prior version | The supersedes mechanism itself is real, live, DB-proven (plan #1 untouched, plan #2 correctly points at it). Canon's exact button wording ("Zaproponuj zmianę planu") does not match the live UI ("Nowy szkic (zmiana planu)"); full replan→republish→approve cycle not independently re-driven end to end | **INSIDE** — copy/label mismatch (`CaseDetailScreen.tsx`) plus a live-evidence gap, both Case Workspace's own |
| **CW-JRN-18** — Case closes, history/value stay visible | History and Value display are real, wired, live-data consumers (`CaseDetailScreen.tsx:688/702`). **Closure has no UI path at all** — confirmed independently by this packet (Task 2) and by M5 the same day: zero `closure` string anywhere in `api.ts` | **INSIDE** — this is the same finding as Task 2, restated at the journey level: `api.ts` (client) + UI button, Case Workspace's own, nothing external blocks it |

### Summary: 14 PARTIAL journeys are overwhelmingly an INSIDE-Case-Workspace backlog, not external blockers

Of the 14, only **CW-JRN-01/02** have a genuinely external primary blocker
(the Chat/Teresa message-orchestration layer, a different module), and
**CW-JRN-05** requires a demonstration inside a *different* module's own UI
to fully close (though Case Workspace's own side of that contract is already
proven). **CW-JRN-04**'s capability-boot gap is configuration/ops, not a code
gap in either module. The remaining ten (and the secondary half of JRN-02/04)
are squarely Case Workspace's own missing UI wiring (JRN-03, 06, 15, 16, 17,
18), missing test coverage (JRN-10's TIMER branch), or missing live-evidence
re-drives of already-wired code (JRN-07, 08, 10, 17) — none of which require
another team or module to unblock.

---

## What this packet could NOT verify

- The 218 `GENERIC-CW-SWEEP`/`CW-CONTENT-SWEEP`/`ARTIFACT-SHELL-SWEEP` rows'
  individual pass/fail state — a full live SPEC-L/SPEC-A sweep across every
  required Case Workspace surface at every breakpoint/theme is multiple
  sessions of work, consistent with M4's own stated limitation; each row is
  bucketed by real blocker, not silently assumed to pass.
- The `SHARED-LIST-STANDARD` bucket's 40 rows against the *component's own*
  compliance — this packet confirmed Case Workspace's own usage is
  unmodified (delegation is real), not that `src/components/standard/*`
  itself passes every TRIADA_KANON checklist item; that is a platform-level
  question outside this packet's scope.
- Whether the live coordinator-owned backend (PID 43176) has
  `CASE_WORKSPACE_CAPABILITY_BOOT_ACTOR_ID`/`CASE_WORKSPACE_CAPABILITY_BOOT_
  ORG_ID` set (CW-JRN-04) — checking requires reading its process env or an
  authenticated capabilities call this packet has no credentials for, and
  restarting it is forbidden.
- VoiceOver/NVDA — unattended-session limitation, unchanged, documented
  pre-existing blocker.
- Did not attempt to independently re-verify M5's five golden-case re-runs or
  its `chatIntake.pg.test.ts` run; read its README and the ledger rows in
  full and treated its citations as load-bearing evidence rather than
  re-deriving them from scratch, consistent with this packet's own scope
  (accounting/adjudication, not re-running every prior packet's test suite).

## Files

- This README.
- `CRITERIA_MATRIX_219.csv` — 225 rows, full per-criterion columns.
- One append-only row in `../acceptance/VISUAL_TRIADA_SPEC_A_LEDGER.csv`
  (`ARTIFACT-PANEL-SECTIONS-M4b`), LF-only, `candidate_sha:
  PENDING-CANDIDATE-SHA`.
- Live HTTP/SQL probe artifacts (login token, ad hoc SQL runner) were kept in
  the session scratchpad, not committed to the repo.
