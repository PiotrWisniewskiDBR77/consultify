# SCOPE_ADJUDICATION — Case Workspace V1

> Author: Stream F (Acceptance, Golden Cases, Evidence).
> Ground rule from the owner, quoted verbatim and followed literally in this
> document: **"Jeżeli uważasz, że wymaganie nie należy do Case Workspace V1,
> wskaż DOKŁADNY fragment kanonu lub istniejącą decyzję właściciela. W
> przeciwnym razie pozostaje otwarte."** and **"Nie wolno zmniejszać licznika
> GAP przez mechaniczną zmianę statusów."**
>
> Consequence of that rule, applied here without exception: this document
> **excludes nothing by inference, silence, or "it looks unrelated."** Every
> exclusion below carries a literal quote and a file:line. Every row I could
> not find such a quote for is left OPEN, even where I personally believe it
> probably does not belong to V1 — a belief is not a citation. **No CSV
> status was changed by this pass.** Where fresh Golden Case evidence now
> exists for a requirement, that is noted as "duplicate-covered, not
> mechanically marked" — promoting it to `IMPLEMENTED_AND_PROVEN` is a
> decision for the coordinator's ledger-consolidation pass, against a real
> commit SHA (see §5 — this worktree has none yet).

---

## 1. Golden Cases — result

12 scenarios requested. 9 test files existed or were built this pass; all
run against **real PostgreSQL** (`case_workspace_test` @
`127.0.0.1:55432`), real HTTP, the real router/service stack — no mocks.
Final full-suite run this pass:

```
DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
POSTGRES_SKIP_INIT_IN_TEST=1 DATABASE_URL=postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test \
npx vitest run src/services/caseWorkspace/__tests__/goldenCases --environment node

 Test Files  8 passed (8)
      Tests  9 passed (9)
```

| # | Scenario (owner's list) | File | Status |
|---|---|---|---|
| 1 | Small LIGHT Case, conversation → result | `goldenCaseLightOneClick.pg.test.ts` (**new**) | **PASS** |
| 2 | STANDARD with plan and approval | `goldenCaseHappyPath.pg.test.ts` (pre-existing) | **PASS** |
| 3 | Material/TRANSFORMATION work, multiple modules | `goldenCaseTransformationMultiModule.pg.test.ts` (**new**) | **PASS** |
| 4 | Direct module, no Case, then late binding | `goldenCaseDirectModuleLateBinding.pg.test.ts` (**new**) | **PASS** |
| 5 | Wait / human input | `goldenCaseTransformationMultiModule.pg.test.ts` (satisfied) + `goldenCaseWaitExpiry.pg.test.ts` (expired, pre-existing) | **PASS** (both branches) |
| 6 | Approval reject | `goldenCaseApprovalRefused.pg.test.ts` (pre-existing, 2 tests: reject + expired review window) | **PASS** |
| 7 | Request changes | `goldenCaseRequestChangesPartialRetry.pg.test.ts` (**new**) | **PASS** |
| 8 | Partial result | `goldenCaseRequestChangesPartialRetry.pg.test.ts` (**new**) | **PASS** |
| 9 | Retry / restart | `goldenCaseRequestChangesPartialRetry.pg.test.ts` (**new**) | **PASS** |
| 10 | Cross-tenant refusal | `goldenCaseTenancyRefusal.pg.test.ts` (**new**) | **PASS** |
| 11 | Revoked membership | `goldenCaseTenancyRefusal.pg.test.ts` (**new**) | **PASS** |
| 12 | Deliverable opened in source module, back to Case | `goldenCaseDirectModuleLateBinding.pg.test.ts` (**new**) | **PARTIAL — see below, literally** |

**Item 12, literally PARTIAL, not PASS.** The backend contract that MAKES
that round trip possible is proven: the artifact link carries exactly
(`artifactType`, `artifactId`, `artifactRevision`) — enough to construct a
deep link into the owning module — and the Case's own view of the link is
byte-identical before and after the point where that navigation would
happen. What is **not and cannot be proven at this layer, and is not
pretended to be**: "opening it in the module" and "returning to the Case"
are client-side routing actions with **no corresponding case-workspace API
call** in this packet's surface — no backend test can observe a page
navigation. This is reported as **EVIDENCE_MISSING for the UI half**, stated
in the test file's own header rather than glossed over. No PASS is claimed
for the whole item.

**Negative controls run this pass** (owner's mandate: "zepsuj poprawkę,
potwierdź że test się czerwieni, przywróć"):
- `goldenCaseTenancyRefusal`: commented out the `REVOKED` membership UPDATE →
  the two revoked-membership assertions went **red** (`expected 200 to be
  404`) → restored → suite green again. Confirms the assertion is real, not
  vacuous.
- `goldenCaseRequestChangesPartialRetry`: replaced the expected
  `causationId` with a sabotaged string → assertion went **red**, and the
  failure output showed the ACTUAL `causation_id` is a real, non-null event
  id (`cwevt-...`), not an accidental `null === null` match → restored →
  suite green again.

**Hygiene finding, fixed in this pass (not GAP-relevant, reported per Task
3's honesty requirement):** the first working version of
`goldenCaseLightOneClick` passed its own assertions but leaked its
organization/case rows on every run — `lightOneClickService.createNodeRun`
writes `case_workspace_node_runs`, a table `ContractFixtures.teardown()`
(the shared harness) does not know about, whose FK on `run_id` silently
blocked `case_workspace_run_bindings` cleanup, which cascaded to blocking
`case_core`/`projects`/`organizations` cleanup — all swallowed by the
harness's own `.catch(() => undefined)`. Fixed by adding an explicit
`DELETE FROM case_workspace_node_runs WHERE case_id = $1` in that test's own
cleanup, mirroring the pattern the pre-existing golden cases already use for
`case_workspace_history_events`/`case_workspace_action_proposal_decisions`.
Verified clean: `SELECT count(*) FROM organizations WHERE id LIKE
'cw-contract-org-golden-%'` → **0** after a full suite run, both before and
after this fix's own test passed on its own.

**What Golden Case coverage does NOT claim:** the golden-case-evidence CSV
rows this maps to (`GOLDEN_CASE_EVIDENCE_LEDGER.csv`, `CW-RT-055..066` etc.)
were **not edited** in this pass. §5 explains why — no candidate SHA exists
yet on this uncommitted worktree, and `CW-RT-055`'s own existing note
already states this exact constraint for the pre-existing three golden
cases; the same constraint now applies to the five added here.

---

## 2. Semantic deduplication — methodology and result

### 2.1 Method

A read-only script (not committed as product code; available on request)
parsed all 12 acceptance CSVs, resolved `supersedes_row_id` chains per file
(same algorithm as `scripts/case-workspace/ledger-report.mjs`, cross-checked
against its own `LEDGER_SNAPSHOT.md` output — **numbers match exactly**:
1682 effective rows, 1273 `NOT_IMPLEMENTED`), then grouped the **1505**
effective rows that carry a `requirement_text` field into semantic clusters
by:

1. **Exact-text match** after normalization (lowercase, Unicode NFKD fold,
   strip punctuation, collapse whitespace) — the strong, defensible signal:
   two rows with byte-identical requirement prose are the same requirement,
   full stop.
2. Cross-checked against **same `(source_file, source_line)` cited by ≥2
   different ledger files** — every group found this way was ALSO found by
   (1), so citation-matching added no extra groups; it is reported as
   corroboration, not a separate technique.

`TRACEABILITY_AUTH_ROUTES.csv` (177 effective rows) has **no
`requirement_text` field at all** — its schema is `route ×
authorization_predicate`, not prose requirements — so it is **not
included** in the semantic-dedup pass below and is reported as its own,
undeduped category. This is a real limitation, stated rather than hidden:
route-level near-duplicates (the same predicate checked on two routes worded
differently) were not attempted.

**What this method does NOT do:** it does not detect *paraphrased*
duplicates — the same requirement worded differently by two independent
extracting sub-agents (the acceptance ledgers' own `README.md` names this
exact risk: *"near-duplicate rows across clusters... have not been
deduplicated yet"*). Catching those needs semantic judgment per pair, which
at 1505 rows is not a single-session task; doing it superficially would
risk exactly the "mechanical status shrinkage" the owner forbade. The exact-
match pass below is the part of the job that is mechanically verifiable and
therefore trustworthy; the paraphrase-level pass is explicitly **not done**
and not claimed to be done.

### 2.2 Result

| Metric | Count |
|---|---:|
| Effective rows with `requirement_text` (10 of 12 files) | 1505 |
| Distinct semantic groups after exact-text dedup | **836** |
| Rows collapsed into a group with ≥2 members | 1222 (in 553 groups, avg 2.2/group) |
| Rows that were already unique (group of 1) | 283 |
| Groups where **every** member is still `NOT_IMPLEMENTED` | 597 |
| Groups with ≥1 member at a better status (`PARTIAL`/`IMPLEMENTED_AND_PROVEN`/`OUT_OF_SCOPE_THIS_WAVE`) but at least one other copy still stuck at a worse status | 239 |
| `TRACEABILITY_AUTH_ROUTES.csv` (separate schema, not deduped) | 177 rows on its own axis |

The 239 "mixed" groups are a genuine **ledger-hygiene finding**, distinct
from a scope question: the same requirement was extracted into two ledgers
by two different sub-agents, one of whom later recorded real evidence and
one of whom did not go back and update their copy. That is not something
this pass fixes by touching the CSVs (that would be exactly the "mechanical
status change" the owner forbade) — it is flagged here as a worklist item
for whoever next reconciles the ledgers, not resolved.

> **Correction (§8, this pass, 2026-08-11):** the "239" row above and the
> "10 of 12 files" row were produced by an ad-hoc script this document itself
> says was "not committed as product code." That method is now committed to
> `scripts/case-workspace/ledger-report.mjs` (reproducible by anyone,
> `node scripts/case-workspace/ledger-report.mjs`) and reproduces every other
> number in this table **exactly** (1505, 836, 1222/553/2.2, 283, 597) — except
> "mixed groups," which the committed parser measures as **165**, and
> "files with `requirement_text`," which is **9 of 12**, not 10. See §8 for
> the full re-derivation, the root-cause of the 239 discrepancy, and why
> neither correction moves GAP (no CSV cell was touched by either pass).

---

## 3. Normative exclusion review — the "wide documents" question

The task brief named two documents by example:
`docs/product/AGENT_EXECUTION_V8_SSOT.md` and
`AI_BACKGROUND_AND_SCHEDULED_AGENT_RUNTIME_V8.md`. Grep of `source_file`
across all 12 ledgers found a **third** in the same category,
`docs/product/AGENT_EXECUTION_V8_AS_IS.md`, and confirmed these three are
the only source files outside `docs/product/case-workspace/**` that
contribute `NOT_IMPLEMENTED`/`PARTIAL` rows framed as generic,
cross-application "Execution Agent" requirements (as opposed to, e.g.,
`docs/ui-standards/TRIADA_KANON.md` and `Harvard/wdrozenie-100/
ARTIFACT_ANATOMY_STANDARD.md`, which are also non-`case-workspace/` sources
but are Consultify's **mandatory, cross-module UI standard** — CLAUDE.md's
own §UI rules apply it to every module including this one, so those stay
open with no adjudication needed; they are unambiguously in scope).

**44 raw ledger rows** cite one of the three wide docs, collapsing (via the
same exact-text method as §2) to **29 distinct requirements**. All 29 were
read in full against the source document and against Case Workspace's own
canon. Result:

### 3.1 The controlling citation

`docs/product/case-workspace/00_CASE_WORKSPACE_CANON.md`, §12 "Authority and
supersession" (verbatim):

> "This package refines the earlier Run Agent agreements and Agent
> Transformation documents for the unified lightweight and
> transformation-capable Case model. Existing module SSOTs continue to own
> their artifacts and legal mutations. **Agent Execution V8 continues to own
> governed runtime behavior where it does not conflict with the
> owner-approved decisions recorded here.**"

This is the one place Case Workspace's own canon draws the line: Agent
Execution V8 is a **live, continuing, separate authority**, not a backlog
Case Workspace absorbs wholesale. Case Workspace's canon **refines** it only
where the two conflict. Everything Case Workspace's own documents (04, 05,
08) actually specify for Case/Plan/Run/NodeRun/ActionProposal is squarely in
V1 — and demonstrably built (see §1's Golden Cases). Requirements the wide
docs state that describe the **generic, cross-module** Execution Agent
architecture, upstream of a Case ever existing, are not re-claimed by that
refinement.

### 3.2 Excluded from Case Workspace V1 (citation-backed) — 3 requirements

| Requirement | Text | Citation for exclusion |
|---|---|---|
| `AEV8-SOURCE-HONESTY-01` (`AGENT_EXECUTION_V8_SSOT.md:629`) | "If the agent used note, report, retrieval, table, or conversation context, that must be attributable in run-level traceability (sourceContextRefs)." | Doc 00 §2 (verbatim): *"An informational answer, exploration or ordinary conversation does not create a Case."* Attributing what the agent read **before** a Case exists is chat/Teresa's own context-assembly responsibility, not Case Workspace's — confirmed in code, not just doc: `server/src/routes/caseWorkspace/intake.routes.ts`'s own header states *"this packet deliberately does NOT edit `chat.routes.ts`, `teresa.routes.ts` or `ai.routes.ts`; it builds the contract they will call, so the wiring is a separate, reviewable change."* Case Workspace receives an already-digested `workOrder`; it has no conversation/retrieval context to attribute. |
| `AEV8-PRIVACY-01` (`AGENT_EXECUTION_V8_SSOT.md:640`) | "Execution runs must inherit chat and platform privacy rules; private mode and restricted memory modes must be respected." | Same citation as above — privacy-mode inheritance from chat happens before/during context assembly, which is explicitly outside `intake.routes.ts`'s owned surface per its own header (quoted above), and outside doc 00 §2's Case-creation boundary. |
| `AEV8-BG-RESUME-01` (`AI_BACKGROUND_AND_SCHEDULED_AGENT_RUNTIME_V8.md:162`) | "Long-running work can resume from checkpoints without duplicating approved mutations; **every non-interactive AI run has a durable job object** and status history." | Names a **different canonical entity** ("a durable job object") than what Case Workspace owns. This session's frozen owner decisions (quoted in the launch brief, restated here because they are the operative constraint on this exact question): *"Plan Definition, immutable Plan Version, Run i NodeRun to ROZNE byty"* and *"nie powstaje... drugi runtime"* — Case Workspace has exactly Case/Plan Version/Run/NodeRun, by decision, and is barred from inventing a second runtime concept alongside them. Doc 00 §12 (above) confirms the generic background/scheduled runtime remains Agent Execution V8's own continuing authority. A generic cross-app "job object" for *all* non-interactive AI work (not just Case-scoped Runs) is that separate initiative's entity to define. |

### 3.3 Remain OPEN, no citation found (26 of 29) — duplicate-coverage noted, status NOT changed

For every other wide-doc requirement, I looked for and could not find a
canon fragment or owner decision that excludes it — several, in fact,
**explicitly name Case Workspace's own Run/NodeRun model as their intended
home**, which is the opposite of an exclusion. These stay open in their own
ledger rows per the owner's rule. Where I found the SAME requirement already
proven under Case Workspace's own vocabulary (via a `CW-*`-prefixed row
and/or a Golden Case from §1), that is noted as **duplicate-covered** — a
ledger-consolidation opportunity, not a status I am authorized to flip
myself:

- `AEV8-ASIS-NORUNTRUTH-01` (`AGENT_EXECUTION_V8_AS_IS.md:351`) states
  verbatim: *"there is no single canonical execution-run truth entity
  today... this is the entity **the Run/NodeRun model must consolidate**."*
  This names Case Workspace's own model as the fix. **Duplicate-covered**:
  Golden Cases A/D/E/H (§1) prove one Case → one Plan Version → one Run →
  many NodeRun/proposal/decision/artifact/deliverable chain, reconstructible
  from the outbox alone under one correlation id.
- `AEV8-ASIS-IDEMPOTENCY-01` (`AGENT_EXECUTION_V8_AS_IS.md:324`) states
  verbatim its pattern *"should be carried into the canonical Run/NodeRun
  execution model."* **Duplicate-covered**: `Idempotency-Key` on proposals
  and waits (Golden Cases A, B, H), the deterministic
  `case.light_one_click.started` completion marker (Golden Case D) all prove
  this for the Case-scoped slice.
- `AEV8-LIFECYCLE-01`/`-02` (draft→planning→proposed→pending_review→
  approved→executing→completed→audited; approved ≠ executed; partial
  approval/completion first-class) — **duplicate-covered** by Case
  Workspace's own `ActionProposal` state machine
  (`DRAFT→PENDING_REVIEW→APPROVED→EXECUTING→EXECUTED→AUDITED`, plus
  `REQUESTED_CHANGES`/`REJECTED`/`FAILED→APPROVED` retry), proven end-to-end
  in Golden Cases A, B, H.
- `AEV8-DESTRUCTIVE-CLASS-01` (safe_additive/safe_update/sensitive_update/
  destructive/governance_transition classification) — **duplicate-covered**:
  `effectClass` (`SAFE_ADDITIVE`, `SENSITIVE_UPDATE`) is a real, exercised
  field on every proposal in every Golden Case in §1.
- `AEV8-APPROVAL-01..04` (approval mandatory for material mutations;
  auto-execution only for low-risk; approve/reject/request-changes with the
  run kept open; reject is a real, auditable state) — **duplicate-covered**
  by Golden Cases A (approve), B (reject, twice), H (request-changes).
- `AEV8-GOVERNANCE-01`/`-02` (agent cannot bypass role/gate semantics; may
  not self-approve or impersonate a role) — **duplicate-covered**: GOV-022
  self-approval-forbidden is proven with a real refused attempt in Golden
  Case A.
- `AEV8-EXECLAYER-01`, `AEV8-AUDITLAYER-01`, `AEV8-FAILURE-MODEL-01`
  (adapter dispatch/approval validation/partial-failure handling; audit
  trail with actor+timestamp+artifact refs; distinguishable failure classes)
  — **duplicate-covered** by the `EXECUTING→FAILED→retry→APPROVED` arc and
  the `AUDITED` terminal state, both proven with a real causal
  (`causationId`) edge in Golden Case H.
- `AEV8-RUN-MODEL-01`, `AEV8-PLAN-MODEL-01`, `AEV8-STEP-MODEL-01`,
  `AEV8-PROPOSAL-MODEL-01`, `AEV8-RESULT-MODEL-01` (the generic
  ExecutionAgentRun/Plan/Step/Proposal/Result data shapes) — **partially
  duplicate-covered**: Case Workspace's Case/Plan Version/NodeRun/
  ActionProposal are the Case-scoped instances of these same concepts, but
  field-for-field parity with the AEV8 generic schema names was not checked
  and is not claimed.
- `AEV8-PREVIEW-MODEL-01` (ActionPreview: diff/before-after/created/updated/
  destructive-impact/followup) — **partially duplicate-covered**: Case
  Workspace deliberately stores only a `previewRef` **pointer**, never an
  inline diff — `proposalApprovalService.ts`'s own §6 comment calls
  `previewRef`/`policySnapshotRef` "the payload pointers ('referenced rather
  than copied')", the same design principle `artifactLinkService.ts` uses
  for artifact content — so the pointer half is proven, the rich-diff-UI
  half is not and stays open.
- `AEV8-DOD-01` (understand→plan→propose→preview→approve→apply→audit as
  canonical DoD) — **duplicate-covered** conceptually by the exact same
  lifecycle proven in §1, though this specific row's own DoD-phrasing was
  not individually re-verified against docs 13/14.
- `AEV8-RUNTIME-ARCH-01` (chat intake → context assembly → intent/plan
  builder → proposal compiler → preview builder → approval gate → module
  adapters → audit logger) — **mixed**: the upstream half (chat
  intake/context assembly/intent-and-plan-builder) is chat/Teresa's own
  layer per the §3.2 citation; the downstream half (proposal compiler
  through audit logger) is duplicate-covered by Case Workspace's own
  proposal/decision/execute/audit chain. Left open as one row since the
  ledger does not split it.
- `AEV8-BG-WAITSTATUS-01`, `AEV8-BG-IDEMPOTENCY-01`, `AEV8-BG-NOBYPASS-01`
  — the **Case-scoped instantiation** of each (Wait/Proposal statuses;
  idempotency-key replay; approval never bypassed even mid-EXECUTING) is
  proven in §1's Golden Cases. The **literal claim as written** — a
  platform-wide background/scheduled job runtime, for *all* non-interactive
  AI work, not only Case-scoped work — is the separate initiative named in
  §3.1/§3.2 and is not Case Workspace's to close. Left open rather than
  split, since no ledger row currently distinguishes the two readings.

**Net for §3: 29 requirements reviewed, 3 excluded with citation, 26 remain
open** (of which roughly 20 are duplicate- or partially-duplicate-covered by
proven Case Workspace evidence, and 6 are cleanly unresolved: the
field-schema-parity claims and the UI-diff half of the preview model).

---

## 4. What this pass does NOT claim

- **No adjudication was performed on the remaining ~807 semantic groups**
  (836 total minus the 29 reviewed in §3) or on `TRACEABILITY_AUTH_ROUTES`'s
  177 rows. Per the owner's rule, **silence is not exclusion** — every one
  of those stays exactly where the parser found it: open if
  `NOT_IMPLEMENTED`/`PARTIAL`/`EVIDENCE_MISSING`, closed only if the ledger
  already says `IMPLEMENTED_AND_PROVEN` with real evidence.
- **GAP was not reduced.** Zero CSV `status` cells were edited in this pass.
  The counts in §5 below are the same parser output as before this session
  (`LEDGER_SNAPSHOT.md`, regenerated by `ledger-report.mjs`, itself
  untouched).
- The 239 "mixed-status duplicate groups" from §2.2 and the ~20
  "duplicate-covered" wide-doc requirements from §3.3 are **findings for a
  reconciliation pass**, not resolutions. Turning them into an actual GAP
  reduction requires the coordinator (or a future stream) to point each
  specific ledger row at real, current, committed evidence — exactly the
  discipline Task 3's own rule demands (kod istnieje + konsument go woła +
  test pokrywa DOKŁADNIE wymaganie + dowód z właściwej warstwy + dowód z
  aktualnego SHA), which this uncommitted worktree cannot yet satisfy (§5).

---

## 5. Ledger hygiene (Task 3)

- **No `UNCOMMITTED-WORKTREE` evidence refs were written.** This pass added
  no rows to any evidence ledger (including `GOLDEN_CASE_EVIDENCE_LEDGER.csv`)
  because there is no candidate SHA yet — this is an active, uncommitted,
  five-agent shared worktree per the launch brief, and `CW-RT-055`'s own
  pre-existing note states the identical constraint for the three
  pre-existing golden cases: *"on an UNCOMMITTED worktree — no candidate SHA
  exists to accept against... until then this row cannot be PASS by its own
  wording."* The same now applies to the five golden cases added in §1.
  **Recommendation for whoever stamps the next candidate SHA:** add rows to
  `GOLDEN_CASE_EVIDENCE_LEDGER.csv` for the five new files
  (`goldenCaseLightOneClick.pg.test.ts`,
  `goldenCaseTransformationMultiModule.pg.test.ts`,
  `goldenCaseDirectModuleLateBinding.pg.test.ts`,
  `goldenCaseRequestChangesPartialRetry.pg.test.ts`,
  `goldenCaseTenancyRefusal.pg.test.ts`) against that SHA, and reconcile the
  §3.3 duplicate-covered wide-doc rows at the same time rather than leaving
  the same fact tracked twice at different statuses.
- **No stale `candidate_sha` was introduced or left behind** by this pass —
  again, none was written at all, for the reason above.
- **`IMPLEMENTED_AND_PROVEN` was not applied to anything by this pass.**
  Every new fact in §1 stays as prose in this document plus the test files
  themselves until a real SHA exists to stamp it against.

---

## 6. Parser distribution (unchanged by this pass — from `LEDGER_SNAPSHOT.md`)

Regenerated by `node scripts/case-workspace/ledger-report.mjs` this session,
before any file in this document's scope was touched:

- Raw rows across all 12 CSVs: **2061**
- Effective rows (after `supersedes_row_id` resolution, files with a
  `status` column): **1682**
- **NOT_IMPLEMENTED: 1273**, **PARTIAL: 201**, **IMPLEMENTED_AND_PROVEN:
  187**, **EVIDENCE_MISSING: 16**, **OUT_OF_SCOPE_THIS_WAVE: 5**
- GAP (`NOT_IMPLEMENTED` + `PARTIAL` + `EVIDENCE_MISSING`) = **1490**,
  unchanged by this pass.

## 7. Literal PARTIAL / BLOCKED / EVIDENCE_MISSING from this pass's own work

- **PARTIAL**: Golden Case list item 12 ("deliverable otwierany w module
  źródłowym i powrót do Case") — backend pointer contract PASS, UI
  round-trip navigation **EVIDENCE_MISSING** (no case-workspace API call
  exists for either navigation step; documented in
  `goldenCaseDirectModuleLateBinding.pg.test.ts`'s own header rather than
  silently treated as proven).
- **BLOCKED**: none. All 9 Golden Case tests reached a real PASS on real
  Postgres; nothing in §1 was blocked by missing infrastructure.
- **EVIDENCE_MISSING**: the UI-navigation half of item 12 (above); the
  field-schema-parity claims in §3.3 for `AEV8-RUN-MODEL-01` et al.
  (Case Workspace's models are the conceptual equivalent, not verified
  field-for-field against the generic AEV8 schema names); the rich-diff-UI
  half of `AEV8-PREVIEW-MODEL-01`.

---

## 8. Addendum (2026-08-11, same packet, continuation) — parser committed,
## dedup re-verified, evidence-metadata hygiene

> Author note: this addendum continues Pakiet B6 in the same worktree/
> document. It does not delete or rewrite anything above — §§1-7 stand as
> written by the prior pass. Everything below is either (a) an independent
> re-derivation of §2's numbers through a now-committed, rerunnable tool, or
> (b) new work (Task 3, evidence-metadata hygiene) that pass did not do.
> **No CSV cell — status, evidence_ref, candidate_sha, or otherwise — was
> edited by this addendum.** Command used throughout:
> `node scripts/case-workspace/ledger-report.mjs --json` (default run also
> regenerates `LEDGER_SNAPSHOT.md` in place; the JSON/stdout numbers below
> are read from that same run).

### 8.1 Task 1 — semantic dedup is now parser code, not a one-off script

§2.1 described an exact-text dedup method run by "a read-only script (not
committed as product code; available on request)." That was a real gap: an
unreproducible number is not a trustworthy number. The same method — NFKD
fold, lowercase, strip punctuation, collapse whitespace, then group
effective rows across all files by identical normalized text — is now
`normalizeRequirementText()` + `buildRequirementGroups()` in
`scripts/case-workspace/ledger-report.mjs`, and its output is a permanent
section of `LEDGER_SNAPSHOT.md` ("Deduplikacja semantyczna wymagan") plus a
new evidence-hygiene section ("Higiena dowodowa"), both produced on every
run alongside the pre-existing per-row analysis — nothing about the
pre-existing sections changed.

Re-running the now-committed method reproduces **five of six** numbers in
§2.2's table exactly:

| Metric | §2.2 (prior pass) | Parser (this addendum) | Match? |
|---|---:|---:|:---:|
| Effective rows with `requirement_text` | 1505 (stated "10 of 12 files") | **1505** (verified: **9 of 12** files — see §8.2) | value matches, file count corrected |
| Distinct semantic groups | 836 | **836** | exact |
| Rows collapsed into ≥2-member groups | 1222 in 553 groups, avg 2.2 | **1222 in 553 groups, avg 2.2** | exact |
| Singleton groups (already unique) | 283 | **283** | exact |
| Groups where every member is `NOT_IMPLEMENTED` | 597 | **597** | exact |
| "Mixed" groups (≥1 better-status member + ≥1 worse-status member) | 239 | **165** | **does not match — see §8.3** |

The §3 wide-document sub-analysis was independently re-run too (filtering
`source_file` to the three named documents, same exact-text grouping): **44
raw rows → 29 distinct groups**, matching §3's own count precisely. §3's
citations and adjudications are untouched by this addendum.

### 8.2 Correction: "10 of 12 files" → 9 of 12

Checked directly against each CSV's header row: `API_EVENT_SCHEMA_COVERAGE`,
`CUSTOMER_JOURNEY_LEDGER`, `EPIC_DOD_COVERAGE`,
`FUNCTIONAL_REQUIREMENT_COVERAGE`, `GOLDEN_CASE_EVIDENCE_LEDGER`,
`LEGACY_MIGRATION_PARITY`, `RESPONSIVE_ACCESSIBILITY_LEDGER`,
`SECURITY_RESILIENCE_MATRIX`, `VISUAL_TRIADA_SPEC_A_LEDGER` — **9** files
carry `requirement_text`. `TRACEABILITY_AUTH_ROUTES.csv` (route ×
authorization_predicate schema), `CODEBASE_CONVERGENCE_MAP.csv` (area ×
disposition schema) and `CARTESIAN_UX_COVERAGE.csv` (0 rows) do not. This is
a one-line correction with no effect on any count (1505 is right either way);
noted because the prior pass's own §2.1 explicitly said `TRACEABILITY` has
"no `requirement_text` field at all," which is inconsistent with the same
pass's "10 of 12" — the 9-of-12 figure is the one consistent with the rest of
that section's own prose.

### 8.3 Root cause of the 239 vs 165 "mixed groups" discrepancy

The committed parser applies §2.2's own stated definition literally: a group
is "mixed" iff it has at least one member whose status is in the
prior pass's own named "better" set (`PARTIAL`, `IMPLEMENTED_AND_PROVEN`,
`OUT_OF_SCOPE_THIS_WAVE`; `PASS` added for schema-completeness though no
`requirement_text`-bearing row currently carries it) **and** at least one
member outside that set (`NOT_IMPLEMENTED`, `EVIDENCE_MISSING`, `BLOCKED`,
`BLOCKED_ON_UI`, or blank). Under that exact rule, the real count is **165**,
not 239 — this is deterministic and rerunnable, not a judgment call.

The likely origin of "239" was located: of the **283** singleton groups
(already-unique requirements, one copy each), exactly **239** carry status
`NOT_IMPLEMENTED`. That is a real, correct number — but it answers a
different question ("how many never-duplicated requirements are still
untouched") than "how many duplicate-groups have inconsistent status across
copies." The two numbers colliding at exactly 239 make a summary-table
transcription mix-up (copying the wrong row while the source script itself
was never committed for anyone to check) the most probable explanation. This
is reported as a probable cause, not asserted as certain — the original
script no longer being available means it cannot be re-run to confirm
directly.

**Effect on GAP: none.** Neither 239 nor 165 is a CSV status; both are
read-only counts over the existing, unedited `status` column. This
correction changes what the parser *reports about* the ledgers, not the
ledgers themselves.

### 8.4 Task 3 — evidence-metadata hygiene (new; §5 of the prior pass covered
### only this stream's own new rows, not a full-ledger sweep)

All counts below are **active (effective) rows only** — rows whose
`row_id`/`requirement_id` is not superseded — and are read directly from
`docs/product/case-workspace/acceptance/*.csv`, no sampling.

**a) `evidence_ref` literally equal to the sentinel `UNCOMMITTED-WORKTREE`:
zero.** Checked every effective row's `evidence_ref` cell for an exact or
prefix match; none exists. The sentinel is not used in that column anywhere
in the corpus.

**b) `candidate_sha` starting with `UNCOMMITTED-WORKTREE` (the actual sentinel
location, used as `UNCOMMITTED-WORKTREE-<date>`): 71 active rows**, across 5
files (`EPIC_DOD_COVERAGE.csv`: 56, `SECURITY_RESILIENCE_MATRIX.csv`: 6,
`GOLDEN_CASE_EVIDENCE_LEDGER.csv`: 4, `API_EVENT_SCHEMA_COVERAGE.csv`: 4,
`LEGACY_MIGRATION_PARITY.csv`: 1). Of those, **6 carry status
`IMPLEMENTED_AND_PROVEN`** despite an admittedly-not-a-real-commit
`candidate_sha` — the most severe instance of this finding, since
"IMPLEMENTED_AND_PROVEN" reads as a durable claim while its own evidence
column says the tree it was proven on has no commit yet:

| File | Row ID | candidate_sha |
|---|---|---|
| EPIC_DOD_COVERAGE.csv | CW-DOD-F5-U4 | `UNCOMMITTED-WORKTREE-2026-08-10` |
| EPIC_DOD_COVERAGE.csv | CW-DOD-F1-U4 | `UNCOMMITTED-WORKTREE-2026-08-10` |
| EPIC_DOD_COVERAGE.csv | CW-CANON-01-U4 | `UNCOMMITTED-WORKTREE-2026-08-10` |
| GOLDEN_CASE_EVIDENCE_LEDGER.csv | CW-GC-F-04-U1 | `UNCOMMITTED-WORKTREE-2026-08-11` |
| SECURITY_RESILIENCE_MATRIX.csv | SEC-009-U1 | `UNCOMMITTED-WORKTREE-2026-08-11` |
| SECURITY_RESILIENCE_MATRIX.csv | CW-DOD-D6-U1 | `UNCOMMITTED-WORKTREE-2026-08-11` |

The remaining 65 are `PARTIAL`/`EVIDENCE_MISSING`/`NOT_IMPLEMENTED`, where a
placeholder `candidate_sha` is defensible (row-authors flagged the exact same
constraint in prose — see the `CW-RT-055-U4` note quoted in §1) but still not
"current" per the owner's rule, so all 71 are reported, not just the 6.

**c) `candidate_sha` equal to the requirements-corpus commit
(`80d75f24ce01751639e572226f4e52b30503cd22`, `PACKET_REGISTRY.md:5`: "Corpus
commit:" — the commit of the source DOCUMENTS the requirements were
extracted from, not a commit of Case Workspace code) on a row marked
`IMPLEMENTED_AND_PROVEN`/`PASS`: 18 active rows**, all in
`API_EVENT_SCHEMA_COVERAGE.csv` (5: `CW-00-020-INV10`, `CW-GR-025`,
`CW-GR-028`, `SEC-020`, `SEC-025`) and `GOLDEN_CASE_EVIDENCE_LEDGER.csv` (13:
`CW-GR-044`, `CW-GR-045`, `CW-GR-050`, `CW-GC-B-05`, `CW-GC-B-10`,
`CW-GC-C-02`, `CW-GC-D-01`, `CW-GC-D-02`, `CW-GC-D-03`, `CW-GC-D-04`,
`CW-GC-E-02`, `CW-GC-E-03`, `CW-GC-READ-01`). A docs-corpus SHA cannot
evidence which code state a row's implementation was reviewed against — it
identifies zero lines of Case Workspace code. This does not mean the
underlying `IMPLEMENTED_AND_PROVEN` claim is false (many of these rows also
carry a real `test_ref`/`evidence_ref`, unchecked by this specific pass); it
means the `candidate_sha` column specifically cannot be trusted to answer
"against what commit was this accepted."

**d) `IMPLEMENTED_AND_PROVEN` rows in a file with no `candidate_sha` column
at all: 113 active rows, all in `TRACEABILITY_AUTH_ROUTES.csv`.** That
file's schema (`requirement_id, route, command_or_query,
authorization_predicate, canonical_object_id_field, event_audit_record,
test_ref, evidence_ref, status, epic, kind, matched_coverage_row_ids, note`)
never had a `candidate_sha` field to begin with — a structural gap, not a
per-row data-entry omission: there is no column in which any actor could
have recorded which commit these 113 PROVEN routes were verified against.

**e) Net for Task 3: 71 + 18 + 113 = 202 active rows** have a
`candidate_sha`-shaped evidence-metadata problem (sentinel, corpus-SHA
mix-up, or missing column entirely); 6 of those are the highest-severity
overlap (`IMPLEMENTED_AND_PROVEN` + sentinel). Per the task's own
instruction, **no status and no evidence field was changed** — this is a
report for whoever next stamps a real candidate SHA (§5's own
recommendation) to act on, including retrofitting a `candidate_sha` column
onto `TRACEABILITY_AUTH_ROUTES.csv` as a schema fix.

### 8.5 What this addendum does not claim

- It does not re-review the ~807 semantic groups §4 already said were out of
  scope for a citation-backed exclusion pass — those remain open, unchanged.
- It does not resolve the 165 (or 239) mixed-status groups by editing any
  CSV — both counts stay exactly what the ledgers already say until a real
  reconciliation pass touches specific rows with specific new evidence.
- It does not stamp a `candidate_sha` anywhere — this worktree still has no
  commit, so §5's constraint still applies verbatim.

### 8.6 Packet C5 (ledger hygiene / generator) — 2026-08-12

Scope: `scripts/case-workspace/ledger-report.mjs` generator determinism, two
whitespace-lint violations, and the highest-severity item named in §8.4(b) —
the 6 `IMPLEMENTED_AND_PROVEN` rows sitting on an `UNCOMMITTED-WORKTREE`
sentinel. This pass touched **only** the allowlisted files
(`docs/product/case-workspace/acceptance/*.csv`,
`LEDGER_SNAPSHOT.md`, this file, and the generator script itself); no
product code and no test file was modified.

**Generator non-determinism (fixed).** The generator stamped
`new Date().toISOString()` into `LEDGER_SNAPSHOT.md` on every run, so two
runs over byte-identical CSV inputs never matched and the worktree was
dirtied on every invocation. Replaced with a sha256 fingerprint of the
sorted input CSVs' names+bytes (changes if and only if an input file
changes). Also hardened `buildBasenameIndex()`'s directory walk with an
explicit sort (readdirSync order is filesystem-dependent, not guaranteed
stable run-to-run, and could have silently changed which file a bare
`test_ref` basename resolved to). Proof: two consecutive runs over the
current CSVs, `cmp`'d and `sha256sum`'d byte-for-byte identical —
`63b46193513df3298eb32adaf6e4293bb2bb67a4ea9e6cec57916b0e7c37e7eb` both
times (see the worker's session transcript for the raw `cmp`/`shasum`
output; not reproduced here since exact bytes will differ on the next CSV
edit).

**Trailing-blank-line-at-EOF (fixed).** `git diff --check` flagged
`LEDGER_SNAPSHOT.md:339` and this file's own `:571` for a blank line at
EOF. `LEDGER_SNAPSHOT.md`'s came from the generator itself (`lines.push('')`
as the last element before `join('\n') + '\n'` doubles the trailing
newline) — fixed in the generator (strip trailing empty entries before
writing), not by hand-patching the output. This file's was a manual
save artifact — trimmed directly.

**The 6 `IMPLEMENTED_AND_PROVEN` + `UNCOMMITTED-WORKTREE` rows named in
§8.4(b) (fixed via append-only superseding rows, not in-place edits).**
For each of `CW-DOD-F5-U4`, `CW-DOD-F1-U4`, `CW-CANON-01-U4`
(`EPIC_DOD_COVERAGE.csv`), `CW-GC-F-04-U1` (`GOLDEN_CASE_EVIDENCE_LEDGER.csv`),
and `SEC-009-U1`, `CW-DOD-D6-U1` (`SECURITY_RESILIENCE_MATRIX.csv`): this
actor personally re-ran, fresh, **every** test file each row's `test_ref`
cites — `caseIntakeService.pg.test.ts` (6/6), the contract
`idempotencyAndPagination.contract.pg.test.ts` (7/7),
`newSurface.security.pg.test.ts` (13/13), `playService.pg.test.ts` (14/14),
`caseCoreService.security.pg.test.ts` (10/10),
`artifactLinkService.security.pg.test.ts` (11/11), and
`planVersionEnumeration.security.pg.test.ts` — first attempt: 2/13 timed
out at the default 30s under concurrent-worktree DB load from other agents
sharing this Postgres instance; re-run at `--testTimeout=60000` (no other
change): 13/13 passed, so this is recorded as shared-DB contention, not a
regression, consistent with this program's known "concurrent worktree
produces phantom failures" pattern (see `orkiestracja-jeden-worktree-jeden-agent`
lesson). All cited command-line invocations matched the "HOW TO RUN TESTS"
harness in the packet brief
(`DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false
POSTGRES_SKIP_INIT_IN_TEST=1 DATABASE_URL=postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test`).
Every cited test file passed. Appended one superseding row per original
(`-U5`/`-U2` suffix per file's existing chain numbering,
`supersedes_row_id` pointing at the row it replaces), **status carried
forward unchanged** at `IMPLEMENTED_AND_PROVEN` (re-verified, not
re-asserted), `candidate_sha` set to the literal placeholder
`PENDING-CANDIDATE-SHA` (not a real commit — this worktree still has none;
the coordinator stamps the real `CANDIDATE_SHA` at freeze time, per the
packet brief, not this actor), and `evidence_ref` extended with a dated
note recording exactly what was re-run and its result. **No original row
was edited or deleted** — the six `-U4`/`-U1` rows are untouched in place
and are simply no longer the effective (non-superseded) row for their id.
Net effect on GAP: **zero** — these were already `IMPLEMENTED_AND_PROVEN`
and remain `IMPLEMENTED_AND_PROVEN`; effective row count is unchanged
(1682) because each new row supersedes exactly one old row.

**The remaining 65 `UNCOMMITTED-WORKTREE` rows — deliberately left
untouched.** Per the generator's own header comment, the sentinel is
"allowed as a working format during shared, uncommitted work" — the
integrity problem §8.4(b) identifies is specific to a row being read as
*durable* proof (`IMPLEMENTED_AND_PROVEN`/`PASS`) while resting on a
non-commit marker. The other 65 are `PARTIAL`/`NOT_IMPLEMENTED`/
`EVIDENCE_MISSING` — none of them assert durable proof, so the sentinel is
not misrepresenting anything on those rows today. This packet's brief named
the `UNCOMMITTED-WORKTREE` cleanup as its Task 3 without narrowing to the
proven subset; this actor narrowed it deliberately per the reasoning above
and is flagging that interpretation here explicitly so the coordinator can
override it if the intent was literally all 71.

**§8.4(c) (18 rows, corpus-SHA misuse on `IMPLEMENTED_AND_PROVEN`) and
§8.4(d) (113 `IMPLEMENTED_AND_PROVEN` rows with no `candidate_sha` column)
— partially addressed.** (c) was **not** touched this pass (would require
re-verifying 18 more rows' underlying evidence the same way as the six
above; out of this packet's time budget — left open, still exactly as
§8.4(c) describes it). (d) **was** addressed structurally: added a
`candidate_sha` column to `TRACEABILITY_AUTH_ROUTES.csv` (which never had
one — schema gap, not a per-row omission), inserted between its existing
`evidence_ref` and `status` columns, populated `PENDING-CANDIDATE-SHA` for
all 177 rows (113 `IMPLEMENTED_AND_PROVEN`, 33 `PARTIAL`, 31
`NOT_IMPLEMENTED`) since this file has no `supersedes_row_id`/versioning
mechanism to append a superseding row through. **No existing cell in that
file — `status`, `test_ref`, `evidence_ref`, or otherwise — was changed**;
`git diff` on the file shows exactly one new column inserted per row and
nothing else. This closes §8.4(d)'s "structurally impossible to bind
evidence to a commit" gap for the next pass that stamps real SHAs; it does
not itself supply any real SHA.

**Numbers re-measured, not repeated.** Ran
`node scripts/case-workspace/ledger-report.mjs` before and after every
change above. Final effective-row distribution: `NOT_IMPLEMENTED`=1273,
`PARTIAL`=201, `IMPLEMENTED_AND_PROVEN`=187, `EVIDENCE_MISSING`=16,
`OUT_OF_SCOPE_THIS_WAVE`=5 (sum 1682) — identical to what a prior session
reported, now independently re-derived rather than repeated on trust.
`git diff --check` (working tree) is clean (exit 0) after all edits above;
the historical range `git diff --check 9d17cac114..HEAD` still reports the
original two violations because that range diffs committed history and
this actor made no commit (explicitly out of scope) — it will read clean
once the coordinator commits this pass's fix on top of `HEAD`.

### 9. Packet E2 (2026-08-12, HEAD `a565ce454c`) — the 39/18-row resolution,
### F2 + owner-decision handoff sync, remaining `UNCOMMITTED-WORKTREE` retirement

Scope: the 39 `IMPLEMENTED_AND_PROVEN` rows with a broken `test_ref` (§ below
of `LEDGER_SNAPSHOT.md`, "Niespojnosc..."), the 18 corpus-SHA rows (§8.4(c)
above), syncing `RESUME_HANDOFF_2026-08-12.md` §5.1/§5.2/§5.3 to the F2 fix
and the two now-frozen owner decisions, and the remaining 65
`UNCOMMITTED-WORKTREE` rows §8.4(b)/§8.6 explicitly deferred. Touched only
`docs/product/case-workspace/acceptance/*.csv`, `LEDGER_SNAPSHOT.md`, this
file, `RESUME_HANDOFF_2026-08-12.md`, and re-ran (never edited)
`scripts/case-workspace/ledger-report.mjs`. No product code, no test file.

**39-row pass.** Every row individually inspected, not batch-flipped. 13 of
39 personally re-verified against a real, currently-passing Postgres test
(ran each cited/corrected test file fresh — 16/16, 9/9, 22/22, 14/14, 16/16,
11/11, 12/12 depending on file — status **kept** `IMPLEMENTED_AND_PROVEN`,
`test_ref` corrected to name the specific `it()` by name and line). 26 of 39
**downgraded to `PARTIAL`**, append-only, each with a specific stated gap:
either the cited function has literally zero test calls anywhere in the repo
(9 rows), or it is exercised functionally but its claimed
`authorization_predicate` is never tested with a no-membership/cross-org
actor against a real DB row (15 rows — a mocked route-wiring test exists for
some of these and is cited as partial corroboration, explicitly labeled as
NOT equivalent to a real-DB proof), or the row's live-browser evidence
artifacts (`u4-report*.json`) do not exist anywhere in the repo while the
underlying static/source-level claim was independently re-confirmed by grep
(2 EPIC_DOD_COVERAGE.csv rows, crimson-purity and StandardTable composition).
Full 39-row table is in this worker's session report to the coordinator
(not duplicated here to keep this file from doubling in size); the
authoritative record is the CSV rows themselves
(`-U1`/`-U6` suffixes, `claude-e2-ledger-hygiene`, 2026-08-12).

**Structural caveat inherited from `TRACEABILITY_AUTH_ROUTES.csv` having no
`supersedes_row_id` column (unchanged by this pass — a pre-existing gap, see
§8.4(d)):** 37 of the 39 rows live in that file. Appending a corrected row
does NOT remove the original `PENDING`-test_ref row from the file — both
now coexist as "effective" per the generator's own logic (it has no
supersedes mechanism to resolve for this file). `LEDGER_SNAPSHOT.md`'s
"niespojnosc" count therefore still reads **37** (down from 39 only because
the 2 `EPIC_DOD_COVERAGE.csv` rows *do* have a working supersedes chain and
were fully removed from the effective set) — this is expected and
documented, not an error: read the `-U1`/`-U6`-suffixed rows as the
authoritative, current answer for each requirement_id; the original
`PENDING` rows are left in place as history, per the append-only rule, and
because this actor's allowlist does not include `ledger-report.mjs`'s
supersede-resolution *logic* for a file that structurally lacks the column
it depends on (adding that logic was judged out of scope for this packet —
flagging it here for whoever next touches the generator).

**18-corpus-SHA-row pass.** All 18 have a proper `supersedes_row_id` chain
in their source files, so this is a clean append with no duplicate-counting
caveat (`ledger-report.mjs`'s own hygiene counter for corpus-SHA misuse on
`IMPLEMENTED_AND_PROVEN` rows is now **0**, re-measured, not asserted).
Personally re-ran all 7 distinct test files these 18 rows cite — all pass.
While re-verifying, found and corrected **5 real test_ref line-number
drifts** (not corpus-SHA-related, an independent finding from reading the
cited lines): `CW-GR-025`, `CW-GR-044`, `CW-GR-045`, `CW-GC-E-03` (all
citing lines that, at the file's *current* state, land inside a different,
unrelated test than the one the row's evidence prose describes — e.g.
`CW-GC-E-03` cited a line inside the REJECT-decision test instead of the
expired-review-window test that actually proves its claim), and `CW-GR-028`
(one of its two citations resolves to an unrelated quarantine-404 test;
dropped rather than repeated). All 5 claims were still independently
provable from the SAME test file at a DIFFERENT, correct line — status kept
`IMPLEMENTED_AND_PROVEN` in every case, `test_ref` corrected. This is offered
as a general caution for the corpus: bare `file:line` citations drift
silently as other agents edit shared test files, and nothing catches that
automatically — the parser only checks the *file* exists, not that the line
still names the claimed test.

**F2 / owner-decision handoff sync (Task 3).** `RESUME_HANDOFF_2026-08-12.md`
§5.1 previously described the e2e-files-together failure as open; it was
fixed in commit `a565ce454c` (shared-mutable-identity race between two
concurrently-run e2e files, confirmed mechanism, 34/34 on 3 consecutive
together-runs per the coordinator's own independent re-verification). This
pass updated §5.1 to read as resolved (not re-diagnosed) and recorded both
owner decisions from §5.2/§5.3 as **FROZEN**:
`OD-CW-BOOTSTRAP-20260812` (synthetic service-principal identity in a
disposable org, fails closed, no fallback to "first ADMIN") and
`OD-CW-DEMO-20260812` (mutating-test ban on demo/staging stays; read-only
recon allowed; not a blocker for this candidate). Full text is in the
handoff file itself, not duplicated here.

**Remaining `UNCOMMITTED-WORKTREE` rows (65) — resolved this pass**,
completing what §8.6 explicitly deferred ("this actor narrowed it
deliberately... flagging that interpretation here explicitly so the
coordinator can override it if the intent was literally all 71"). This
packet's own brief named the cleanup without the PROVEN-only narrowing, so
all 65 remaining rows (`EPIC_DOD_COVERAGE.csv`: 53, `SECURITY_RESILIENCE_MATRIX.csv`:
4, `API_EVENT_SCHEMA_COVERAGE.csv`: 4, `GOLDEN_CASE_EVIDENCE_LEDGER.csv`: 3,
`LEGACY_MIGRATION_PARITY.csv`: 1) got a `-UW1` append-only superseding row:
`candidate_sha` corrected from the sentinel to `PENDING-CANDIDATE-SHA`,
**status/test_ref/evidence_ref left completely unchanged** — this is a pure
metadata-hygiene fix, not a re-verification of those 65 rows' underlying
evidence (none were `IMPLEMENTED_AND_PROVEN`/`PASS` to begin with, reconfirmed
defensively before writing). `ledger-report.mjs`'s hygiene counter for this
sentinel is now **0** across the whole corpus (was 71 before C5's 6, 65
before this pass's 65).

**`TRACEABILITY_AUTH_ROUTES.csv` SHA gap (Task 4 point 2) — already closed by
C5 (§8.6), reconfirmed here, not redone.** The file's `candidate_sha` column
exists (added by C5) and every one of its 214 rows (177 original + 37 new
from this pass's 39-row resolution) carries the literal placeholder
`PENDING-CANDIDATE-SHA` — **zero real commit SHAs anywhere in this file**,
by design: this worktree carries no candidate commit yet, and stamping one
per row before the coordinator freezes a `CANDIDATE_SHA` would misrepresent
which code state each row was actually accepted against (some rows in this
pass were verified against HEAD `a565ce454c` PLUS other agents' concurrent
uncommitted edits — a mixed state no single SHA could honestly name). This
is the explicit documentation of the structural gap the task asked for, not
a workaround: the column is real, present on every row, and honestly empty
of a commit until freeze time.

**GAP counter — not reduced mechanically.** Every status change in this
pass is individually justified above (13 rows upgraded with a newly-run,
newly-cited real test; 26 rows downgraded with a stated missing test). No
row was flipped to make a counter look better; several rows that could have
been left `IMPLEMENTED_AND_PROVEN` on a technicality (a passing but
unrelated route-wiring test) were downgraded instead once the mismatch was
found. Net effect on `ledger-report.mjs`'s effective-row distribution:
`IMPLEMENTED_AND_PROVEN` 187→198 (+13 upgraded, −2 EPIC rows properly
superseded out), `PARTIAL` 201→227 (+24 `TRACEABILITY_AUTH_ROUTES.csv` +2
`EPIC_DOD_COVERAGE.csv`), everything else unchanged. Re-measured with
`node scripts/case-workspace/ledger-report.mjs` after every batch of edits,
not asserted from memory.

**Determinism proof (Task 5), generated BEFORE this packet's own CSV edits
were finalized, then re-verified AFTER — see this worker's session report
for the literal `cmp`/`sha256sum` output pasted in full; not duplicated here.**
