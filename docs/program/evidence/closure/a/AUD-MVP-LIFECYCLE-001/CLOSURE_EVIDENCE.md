# AUD-MVP-LIFECYCLE-001 — closure evidence

## Superseding technical closure — 2026-08-17

The two gaps documented below are now technically closed in the working tree:

- `20260916_audit_domain_events_append_only.sql` installs a database trigger
  rejecting both direct `UPDATE` and `DELETE`; corrections remain append-only
  through the existing `supersedes` contract.
- lifecycle CAS was already integrated in commit `1a23b5db5e`: the update is
  conditional on the observed `lifecycle_state` and returns `409` when a
  concurrent writer wins. `lifecycleConcurrency.test.ts` proves one winner,
  one rejected stale writer, exactly one matching event, tenant denial and a
  fresh-pool cold readback.

Real PostgreSQL result: exact-current from-zero migration `726/726`, repeat
`0`, dry-run `0`; task gate `12/12` in `5/5` files; Audits kernel regression
`165/165` in `21/21` files; typecheck exit `0`. The final machine record is
`DONE_CURRENT_SHA / PASS_FRESH_REALPG`. Sections describing the former missing
trigger and CAS below are retained as historical investigation, not
current-state claims.

Lane: Claude A (`codex/closure-claude-a-method-evidence`,
`/Users/piotrwisniewski/Developer/consultify-closure-claude-a`).
Date: 2026-08-16/17. Requirement: criterion → evidence → finding → action →
candidate → closure → effectiveness, immutable trail, no self-approval.

See `../AUD-MVP-AI-HANDOFF-001/CLOSURE_EVIDENCE.md` for the exactly-once
migration, which is the shared "candidate" stage fix for both tasks.

## New test files (all under `server/src/services/auditProgramHandoff/__tests__/`,
a NEW directory, sibling of the leased-out `server/src/services/audits/`)

| File | Tests | Result |
|---|---|---|
| `helpers.ts` | (shared fixtures, not a suite) | — |
| `exactlyOnceRegistration.test.ts` | 4 | 4 PASS |
| `segregationOfDutiesNegatives.test.ts` | 4 | 4 PASS |
| `aiBoundaryNegatives.test.ts` | 4 | 4 PASS |
| `tenantIsolation.test.ts` | 1 | 1 PASS |
| `immutableTrail.test.ts` | 3 | 3 PASS |
| `fullLifecycle.e2e.test.ts` | 2 | 2 PASS |
| **Total** | **18** | **18 PASS, 0 fail, 0 skip** |

Combined run:
```
$ DATABASE_URL=postgresql://consultinity:consultinity@127.0.0.1:34916/consultinity \
  DB_TYPE=postgres CI=true RUN_DB_TESTS=1 MOCK_DB=false \
  npx vitest run server/src/services/auditProgramHandoff/__tests__ \
  --no-file-parallelism --maxWorkers=1 --maxConcurrency=2 --retry=0

 Test Files  6 passed (6)
      Tests  18 passed (18)
```

## Why this directory, not `tests/auditProgramHandoff/`

Root `vitest.config.ts`'s `include` list has no `tests/**` catch-all — every
`tests/<dir>/**` entry is named explicitly, and `tests/auditProgramHandoff`
was not one of them. A file placed there matches ZERO include globs, so
`vitest run <that path>` reports "No test files found, exiting with code 1"
when passed as the only target, but silently 0-collects (green, "no tests")
if swept in by a broader glob — exactly the "empty run looks green" trap.
Verified this failure mode directly before moving anything (see below).
`server/src/services/<x>/__tests__/*.test.ts` IS in `include` (used by every
kernel audits test already), so all six new files were moved to
`server/src/services/auditProgramHandoff/__tests__/` — a brand-new directory
that is a SIBLING of (never inside) the leased-out
`server/src/services/audits/` tree, so it does not touch anything under this
lane's read-only lease. No edits were made to the shared root
`vitest.config.ts`.

## 1. Lifecycle stages — real service calls, SELECT-verified

`fullLifecycle.e2e.test.ts` runs the full chain in one program (direct-SQL
fixture, same pattern as the kernel's own `segregationOfDuties.test.ts` /
`proposalService.test.ts` — not through `packService`/`createProgramFromPack`,
which the kernel's own `goldenFlow.e2e.test.ts` already covers separately):

1. **criterion** — `recordTest` + `concludeCriterion` → `conformity_status='nonconforming'`.
2. **evidence** — `reviewEvidence` → `accepted=true`.
3. **finding** — `createFinding` + `reviewFinding` (confirm) + `submitManagementResponse`.
4. **corrective action** — `proposeAction` + `approveAction` + `reportImplementation` → `status='implemented'`.
5. **candidate** — `draftProposalsFromFindings` + `registerAsInitiative` →
   `audit_initiative_proposals.status='registered'`,
   `initiatives.source_type='audit'`, `source_id=proposal.id`.
6. **closure** — `transitionLifecycle` walked forward through every gate
   (`evidence_review → findings_review → management_response → approval →
   remediation → effectiveness_verification → closure → closed`) — reaches
   the terminal `closed` state (not just `closure`), proving the gate chain
   is fully satisfiable, not a dead end.
7. **effectiveness verification** — `planVerification` (kind=`effectiveness`)
   + `performVerification` (independent verifier) → `result='effective'`.

Every one of the 8 rows (criterion, evidence, finding, action, verification,
proposal, initiative, program) is confirmed present with the expected value
by a direct SQL `SELECT` in the test — not by trusting the service's
returned object alone.

## 2. Cold readback (DoD item 10)

Second `it()` in the same file: a genuinely fresh `pg.Pool` (not the one used
to write the data) reads back all 8 ids in a single `UNION ALL` query and
confirms every one matches; then a fresh `getProposal()` call through the
actual service (stateless — every call hits the DB, no in-process cache)
confirms `status='registered'` and `registeredInitiativeId` survive. PASS.

## 3. Segregation-of-duties negatives (DoD item 5) — independently corroborated

`segregationOfDutiesNegatives.test.ts`, 4/4 PASS, one test per guard, EXACT
denial message asserted (not just "it throws"), plus a positive control per
guard proving the action succeeds once done by someone else:

1. Same actor cannot conclude a criterion they answered as auditee — throws
   `/Nie możesz wyciągnąć wniosku audytowego dla kryterium, na które sam
   odpowiadałeś jako strona audytowana/` (`permissions.ts:344-347`,
   `assertNotConcludingOwnResponse`, called from `criterionService.ts:519`).
2. Same actor (finding owner) cannot close their own finding — throws
   `/Właściciel ustalenia nie może go sam zamknąć/` (`permissions.ts:364-367`,
   `assertNotClosingOwnFinding`, called from `findingService.ts:826`).
3. Same actor (finding author) cannot review their own finding — throws
   `/Autor ustalenia nie może być jego recenzentem/` (`permissions.ts:410-412`,
   `assertNotReviewingOwnFinding`, called from `findingService.ts:585`).
4. Same actor (corrective-action owner/implementer) cannot verify its own
   effectiveness — throws `/Weryfikację skuteczności musi wykonać osoba
   inna niż właściciel lub wykonawca działania/` (`permissions.ts:390-392`,
   `assertIndependentVerifier`, called from `verificationService.ts:191`).

This is independent corroboration, not a replacement — the kernel's own
`server/src/services/audits/__tests__/segregationOfDuties.test.ts` (read
only, not modified) already covers all six SoD rules more exhaustively; this
lane's file adds a second witness against the same guards for the two tasks
this lane owns.

## 4. AI boundary negative (DoD item 6)

`aiBoundaryNegatives.test.ts`, 4/4 PASS — see
`../AUD-MVP-AI-HANDOFF-001/CLOSURE_EVIDENCE.md` §6 for the full writeup
(shared evidence, same file).

## 5. Immutable trail (DoD item 8)

`immutableTrail.test.ts`, 3/3 PASS:

1. A row written through `recordAuditEvent` is untouched by any subsequent
   normal write-path activity (byte-for-byte `toEqual` after an unrelated
   second event in the same org). PASS.
2. **Honest finding, not just a pass**: a DIRECT `UPDATE` against
   `audit_domain_events` (bypassing the service layer) is **NOT blocked** —
   there is no `BEFORE UPDATE`/`BEFORE DELETE` trigger and no `REVOKE`
   enforcing immutability at the database layer. The test asserts this
   plainly (`resolves.toBeDefined()`, then confirms the mutation landed) so
   the guarantee is stated for what it actually is: a SERVICE-LAYER
   discipline (every write goes through `recordAuditEvent`, an `INSERT ...
   ON CONFLICT DO NOTHING` — `auditsDb.ts:130-169` — and nothing in the
   kernel ever issues `UPDATE`/`DELETE` against this table), not a
   database-enforced invariant. **This is a real gap relative to the word
   "immutable"** — see the INTEGRATOR_CHANGE_REQUEST below. It is NOT
   something this lane could fix within its one-migration budget (that
   migration was already spent on the exactly-once constraint, which is the
   higher-priority fix per the task brief).
3. The idempotency key (`uq_audit_domain_events_idempotency`, pre-existing,
   `server/migrations/20260813b_audits_source_classification_split.sql:170-172`
   — read-only reference) prevents a duplicate event: same
   `(organization_id, program_id, idempotency_key)` inserted twice via
   `recordAuditEvent` ⇒ exactly one row (the `ON CONFLICT DO NOTHING`
   silently keeps the first). PASS.

**Confirmation of the "GOOD NEWS" claim**: `audit_domain_events` IS
append-only in the sense that every code path in this kernel that writes to
it does so via `recordAuditEvent` (INSERT-only), and the idempotency unique
index is real and enforced. The claim is CORRECT as a description of the
service layer's behavior. It is NOT correct as a description of a
database-level guarantee — there is no trigger — and the task brief's own
wording ("immutable trail") reads as the stronger claim. Flagging this
distinction explicitly rather than letting "append-only (checked)" imply
more than it does.

## 6. Tenant isolation (DoD item 9)

`tenantIsolation.test.ts`, 1/1 PASS: org B cannot `getProposal` org A's
proposal (`null`), cannot see it in its own `listProposals`, cannot
`registerAsInitiative` it (`AUDIT_NOT_FOUND`), cannot read org A's criterion
(`getCriterion` → `null`) or finding (`getFinding` → throws
`AUDIT_NOT_FOUND`) directly. Positive control: org A can do all of the above
on its own data, including a full `registerAsInitiative`.

## 7. Kernel regression (never edited, run as evidence)

```
$ DATABASE_URL=postgresql://consultinity:consultinity@127.0.0.1:34916/consultinity \
  DB_TYPE=postgres CI=true RUN_DB_TESTS=1 MOCK_DB=false \
  npx vitest run server/src/services/audits/__tests__ server/src/routes/audits/__tests__ \
  --no-file-parallelism --maxWorkers=1 --maxConcurrency=2 --retry=0

 Test Files  21 passed (21)
      Tests  165 passed (165)
   Duration  74.34s
```

**21/21 files collected and passed, 165/165 tests passed, 0 failed, 0
skipped.** Files on disk (`ls server/src/services/audits/__tests__/*.test.ts
server/src/routes/audits/__tests__/*.test.ts`) = 21, exact match with the
21 files vitest reports — nothing silently excluded from collection. No
`describe.skip`/"clean skip" banner text appeared anywhere in the run log
(several kernel files print one when the real-DB env isn't reachable; none
did here, confirming every real-DB suite actually ran against Postgres, not
a silently-mocked DB).

Per-file test counts (file → tests, all passed):
`verticalSlice.http.test.ts`→2, `aiProposalService.test.ts`→7,
`goldenFlow.e2e.test.ts`→1, `findingService.test.ts`→13,
`segregationOfDuties.test.ts`→7, `reportRenderer.test.ts`→13,
`aiBoundaries.test.ts`→21, `auditTrailService.test.ts`→9,
`criterionService.test.ts`→5, `packService.test.ts`→9,
`proposalService.test.ts`→8, `outputService.test.ts`→6,
`packValidator.test.ts`→16, `correctiveActionService.test.ts`→9,
`verificationService.test.ts`→6, `evidenceService.test.ts`→2,
`programService.test.ts`→3, `sourceClassificationAxes.test.ts`→8,
`lifecycleGates.test.ts`→1, `normSourceService.test.ts`→5,
`mounting.integration.test.ts`→14. Sum = 165, matching the reported total.

This is a materially different number from the ledger claim referenced in
the task brief ("32/32 files, 259/259 tests") — this lane's own count is 21
files / 165 tests for `server/src/services/audits/__tests__` +
`server/src/routes/audits/__tests__` specifically (the two directories the
task brief named). The discrepancy is most likely scope: the ledger's 32/259
may include other audits-adjacent suites outside these two directories
(e.g. `server/src/services/auditProgramService.ts`'s own tests, owned by a
different agent per this lane's brief, or a wider audits-related glob) —
this lane did not attempt to reconcile which directories produce 32/259
since that is outside its lease; it is reporting only what it observed
directly from the two directories it was told to run.

## 8. INTEGRATOR_CHANGE_REQUEST — `transitionLifecycle` stale-write guard

- **Task**: add optimistic-concurrency protection to `transitionLifecycle`.
- **File:line**: `server/src/services/audits/programService.ts:944-1002`.
- **Current shape**: read `audit_programs` row → validate target transition
  (`assertTransitionAllowed`) → recompute gate facts
  (`computeLifecycleFacts`) → `assertGate` → blind `UPDATE ... SET
  lifecycle_state=$1 ... WHERE id=$7 AND organization_id=$8` (no `WHERE
  lifecycle_state = $current`).
- **Minimal hunk** (illustrative, not applied by this lane):
  ```ts
  const result = await auditRun(
    `UPDATE audit_programs
        SET lifecycle_state = $1, status = $2, closed_at = $3, closed_by = $4, closure_note = $5, updated_at = $6
      WHERE id = $7 AND organization_id = $8 AND lifecycle_state = $9`,  // + current
    [targetState, legacyStatus, /* ... */, current],                     // + current
  );
  if (result.rowCount === 0) {
    throw new AuditStateError(
      `Stan programu zmienił się w międzyczasie (oczekiwano „${current}") — odśwież i spróbuj ponownie.`,
    );
  }
  ```
  (`auditRun` currently discards the row count — `server/src/services/audits/auditsDb.ts:44-46`
  — the change would also need `auditRun` to return it, or a parallel
  `auditRunReturningCount` helper.)
- **Reason**: two concurrent `transitionLifecycle` calls with DIFFERENT
  target states (e.g. one advances `findings_review → management_response`,
  another concurrently sends it backward `findings_review → evidence_review`
  with a reason) can both pass `assertTransitionAllowed`/`assertGate`
  against the SAME stale `current` read, and the later `UPDATE` silently
  wins — the earlier transition's audit-trail event
  (`program.lifecycle_transitioned`) still gets recorded, but the STATE it
  claims to have produced no longer matches what is actually in
  `audit_programs.lifecycle_state`. Lower severity than the exactly-once gap
  (this task's own migration fixes THAT one) because lifecycle transitions
  are typically single-actor and low-frequency, but it is a real gap in an
  otherwise well-guarded state machine.
- **Consumer test**: a new case in
  `server/src/services/audits/__tests__/programService.test.ts` (kernel, not
  this lane) — two concurrent `transitionLifecycle` calls to DIFFERENT
  targets from the same source state, asserting exactly one succeeds and the
  final `lifecycle_state` matches the winner.

## 9. Inventory claims — corrections

- The "GOOD NEWS" list's characterization of `audit_domain_events` as
  "append-only" is correct for the service layer but should not be read as
  a database-enforced guarantee — see §5.2 above. Everything else in the
  "GOOD NEWS" list (all seven lifecycle stages real, all four SoD guards
  real and wired at the cited line numbers, AI proposal-only enforcement
  real) was re-verified directly against this HEAD and found accurate.
- No other inventory claim was found wrong.
