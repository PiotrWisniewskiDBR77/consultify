---
doc_id: FIN-005-statement-ingestion-canonical-final-report
truth_type: operations
status: AWAITING_CODEX_REVIEW
owner: claude
process_owner: codex
product_owner: piotr
packet: FIN-005
branch: feat/fin-005-statement-ingestion-golden-flow
base_commit: 03f01021ac883e267c94485982a47abc7d7f98b0
implementation_head: 6f7fd2e08d19ef0efbae5b73fd7aa4dd2afb3faa
last_reviewed: 2026-08-02
supersedes:
  - FIN-005_STATEMENT_INGESTION_BLOCKER_FIX_COMPLETION_REPORT.md
  - FIN-005_STATEMENT_INGESTION_INDEPENDENT_ACCEPTANCE_ROUND_4.md
---

# FIN-005 — statement ingestion: canonical final report

This is the SINGLE canonical report for FIN-005 (statement upload→extract→
map→approve) on `feat/fin-005-statement-ingestion-golden-flow`. The two
prior reports in this directory are marked `superseded` in their own
frontmatter and kept only for history — do not read them as current truth.
This report is short by design; the superseded reports carry the full
narrative detail of how each defect was originally found.

No push, merge, deploy, Railway, or demo mutation was performed at any
point across any round on this branch. Everything below is
local-worktree / local-Postgres only.

## 1. Where this branch stands

Worktree `/private/tmp/consultify-fin-005-ingestion`, branch
`feat/fin-005-statement-ingestion-golden-flow`, implementation HEAD
`6f7fd2e08d19ef0efbae5b73fd7aa4dd2afb3faa`, clean tree. This document's own
commit (added after this file is written) will move HEAD one commit further
— see the confirmation block at the end for the true final HEAD.

Three rounds got this here:
1. **Round 3** (superseded report): built the reservation/result state
   machine and wired it into `POST /api/finance-statements/upload`.
2. **Round 4** (superseded report): found — via independent falsification,
   not by trusting round 3 — that the frontend never calls `/upload` at all
   (it calls the two `upload-and-analyze` endpoints), wired the same
   mechanism into those, and added orphan-*tracking* on reclaim.
3. **This round**: Codex reviewed round 4 and returned `FIX_REQUIRED` with
   four blockers. All four are fixed and independently re-verified below.

## 2. The four blockers and their fixes

### Blocker 1 — orphan *tracking* is not exactly-once (the critical one)

Round 4's fix recorded an abandoned attempt's `statement_id` into an
`orphaned_statement_ids` audit array before reclaiming, but the real
Statement+Pack row it pointed at stayed active and unreferenced — a genuine
duplicate, just a logged one. Codex correctly rejected "we know the ID of
the duplicate" as satisfying exactly-once.

**Fix**: `reserveIdempentUpload` (in `server/src/services/
financialStatementService.ts`) now, before reclaiming a `failed`/stale
`in_progress` row that references a prior `statement_id`:
- Re-confirms reclaim eligibility against the database's own clock (unchanged
  from before — no app/DB clock-skew risk introduced).
- Looks up that Statement. If `statement_pack_id IS NOT NULL` (i.e.
  `createStatement` + `syncStatementToPack` both actually completed for that
  attempt) → returns a new `{kind: 'recover', reservationId, statementId}`
  outcome. The route handler finalizes the SAME marker against that
  EXISTING Statement — no re-extraction, no new business write, no second
  Statement ever created. Verified live: the recovered response reflects the
  original Statement's real DB data, never the reclaiming request's own
  (different) file.
- If the Statement exists but is incomplete (no pack) → compensating
  hard-delete, reusing the exact pattern the pre-existing `DELETE
  /finance-statements/:id` route already uses (`detachStatementFromPack` +
  delete values + delete statement). This is safe because
  `reserveIdempotentUpload` is only ever called while holding the
  server-wide `pg_advisory_xact_lock` for that exact `(organizationId,
  idempotencyKey)` — no other caller can be touching this row at the same
  time, so a short sequence of statements here is still fully race-free.
- Only after recover-or-compensate does the pre-existing reclaim path run.

Wired into all three endpoints (`/upload`, legacy `/upload-and-analyze`, v8
`/statements/upload-and-analyze`), each with its own recovery
response-builder matching its own existing success-response shape.

**Known, disclosed limitation** (not a duplicate/data-loss risk, out of this
blocker's stated scope): if the original attempt was a multi-section
"smart" analysis, recovery can only reconstruct the response for the first
tracked (`primaryStatementId`) section — it honestly returns `mode:
'fallback'` with a single id, never fabricates multi-section data. The
other sections' Statements (if the original attempt reached them) are
neither lost nor duplicated, just not re-enumerated in the recovery
response body.

### Blocker 2 — `/upload` could lose a created statementId on notes-persist failure

`/upload`'s `performUpload()` read the statementId back out of
`result.body.statementId` for its failure-handling — but the notes-UPDATE-
failure branch's own returned body never included it, silently losing the
Statement's identity for that one path (worse than "orphaned and tracked" —
not tracked at all). The two `upload-and-analyze` endpoints never had this
bug; they already hoisted `primaryStatementId`/`anyStatementPersisted` set
immediately after `createStatement()` succeeds.

**Fix**: `/upload` now uses the identical hoisted-variable pattern, and
`cleanupUnpersistedUpload` is correctly gated on `!anyStatementPersisted` so
a notes-failure (which happens after the file already became a persisted
Statement's `sourceFilePath`) can never delete a file a real Statement still
references.

### Blocker 3 — no dedicated cross-tenant regression coverage on the two real endpoints

**Fix**: new file `tests/acceptance/odbior--fin005--statement-upload-
tenant-isolation.e2e.test.ts` (488 lines), covering both `upload-and-
analyze` endpoints: independent reservations under an identical literal
idempotency key across two orgs, no replay leak, spoofed
`organizationId`/`createdBy` body fields ignored (session-derived only),
and foreign-read denial without data leakage. Confirmed with a real
red→then→green negative control (see §4).

### Blocker 4 — v8 XLSX/XLS parse failure silently "succeeded" with an empty Statement

v8's own local `extractTextFromFile` had `catch { return { text: '',
parseMethod: 'manual' }; }` in its xlsx/xls branch — any parse error
(corrupt file, etc.) silently became a fake-empty success, which then
created a real, garbage-content Statement and returned 201. Legacy's
equivalent correctly throws on the identical failure class.

**Fix, scope-limited exactly as instructed** (no broader parser
unification): v8's xlsx/xls `catch` now throws instead of swallowing. The
pre-existing outer `try/catch` in `performUploadAndAnalyze` already turns
any thrown extraction error into a proper `422`; no other logic needed to
change.

## 3. Files changed this round (`66b72bdc0d..6f7fd2e08d`)

```
 server/src/routes/finance-statements.routes.ts                                | 258 +++++++++-
 server/src/routes/v8/finance.routes.ts                                        |  91 +++-
 server/src/services/financialStatementService.ts                              | 195 ++++++--
 tests/acceptance/odbior--fin005--statement-ingestion-golden-flow.e2e.test.ts  | 553 ++++++++++++++++++---
 tests/acceptance/odbior--fin005--statement-upload-tenant-isolation.e2e.test.ts| 488 ++++++++++++++++++
 5 files changed, 1450 insertions(+), 135 deletions(-)
```

`server/src/services/financialModelingService.ts` (FIN-01..04) has an empty
diff across the ENTIRE branch history (`03f01021ac..6f7fd2e08d`) — confirmed
fresh this round, not just carried forward from earlier reports.

## 4. Gate results (this round)

Re-run independently by a fresh-context reviewer with no memory of writing
any of the fixes, not accepted from the writer's own self-report:

1. **Full FIN-005 suite (both files) + FIN-003A, real Postgres, `--retry=0`,
   run twice**: 50/50 both times (golden-flow 40 + tenant-isolation 8 +
   FIN-003A 2), no flakiness.
2. **Fresh-schema strict real-PG**: PASS, 2/2, sanctioned migration path
   only.
3. **Frontend wizard component tests**: PASS, 16/16.
4. **Typecheck**: frontend `tsc --noEmit` project-wide — 0 errors. Server
   `tsc --noEmit -p server/tsconfig.json` — 0 errors in any of the three
   touched files (pre-existing unrelated errors elsewhere, untouched by this
   diff).
5. **`git diff --check`** — clean. **Secret scan** — no real matches
   (grep hits were test fixtures: a seed password column, a literal
   `"secret"` string used as a tenant-isolation test marker).
6. **`git status --short`** — empty throughout.

## 5. Negative controls — Codex's exact five, all red→green, all reverted

1. **Recovery-completeness bypass** (forced the `statement_pack_id IS NOT
   NULL` check to always fail): RED — the recovery test's retry produced a
   SECOND Statement instead of recovering the original id. Reverted → GREEN.
2. **Compensating-cleanup no-op**: RED — the incomplete orphan's row was
   still present after retry instead of being deleted. Reverted → GREEN.
3. **Tenant-predicate bypass** (legacy `getOrgId()` made to prefer a
   client-supplied body `organizationId`): RED — a real cross-tenant write
   landed (Statement's `organization_id` became the spoofed org). Reverted
   → GREEN.
4. **Restored v8's empty-text fallback**: RED — corrupt-xlsx upload returned
   `201` with a garbage Statement instead of `422`. Reverted → GREEN.
5. **Premature frontend success** (wizard advances past upload before/despite
   a failure): RED — all 4 idempotency component tests failed. Reverted →
   GREEN.

Each sabotage was applied, tested, reverted, and confirmed via
`git status --short` empty before the next — one at a time, never
concurrently.

## 6. Adversarial probes beyond the required list (no defects found)

- Recovery response body reflects the RECOVERED Statement's real, freshly
  re-read DB data — verified by making the orphaned Statement's stored
  content distinguishable from what the reclaiming request's own new file
  would produce, then confirming the response matched the original, not the
  new upload.
- Compensating-cleanup scope is architecturally bound to the exact
  `(organization_id, idempotency_key)` row being processed — no cross-key
  interaction is possible given each reservation's `statement_id` is only
  ever set from that same attempt's own `createStatement()` call.
- `finalize_failed` after a `recover` outcome is handled with the same
  defensive guarantee as a fresh create — never a false 201 without a
  confirmed finalize.
- The multi-statement sequence Blocker 1 added inside
  `reserveIdempotentUpload` remains fully serialized by the pre-existing
  `pg_advisory_xact_lock` (acquired before the callback runs, held until
  commit) — confirmed by re-reading the lock-acquisition code, not weakened.
- `/upload`'s Blocker-2 fix correctly feeds Blocker-1 recovery using
  `/upload`'s own (flat) response shape, not `upload-and-analyze`'s nested
  shape — exercised by an existing passing test, not just asserted.

## 7. Unresolved, disclosed (non-blocking) risks

1. Multi-section recovery only reconstructs a single-statement response
   (§2, Blocker 1) — honest, not lossy for the underlying data, but not a
   full re-enumeration of a multi-section original attempt. Candidate for a
   follow-up ticket if it matters to product.
2. Cross-endpoint idempotent replay (same key, v8 then legacy) still carries
   the ORIGINATING endpoint's response envelope shape rather than the
   responding endpoint's — low real-world likelihood (the wizard only falls
   back to legacy on 400/404/405/501, never on 409/timeout) but unaddressed;
   carried forward from the prior report, unaffected by this round's fixes.
3. `server/scripts/migrate.ts` (a DIFFERENT, non-sanctioned migration script
   from `migrate.postgres.ts`) mis-splits one unrelated SQL file on a
   genuinely empty fresh Postgres DB — pre-existing repo tooling issue,
   unrelated to FIN-005, noted only because test setup hit it.
4. The mandatory context documents referenced in earlier dispatch
   instructions (`docs/START_HERE.md` and siblings) still do not exist on
   this branch's git history — only as uncommitted files on a different
   branch's working tree. Unrelated to FIN-005's own correctness.

## 8. Explicit scope confirmation

- No push, no merge, no deploy, no Railway, no demo mutation at any point
  across any round on this branch.
- No FIN-01..04 file touched — confirmed empty diff across the full branch
  history, not just this round.
- No FIN-06 work started, no scope expansion into other Finance submodules.
- Every command targeted only local Postgres or disposable local databases;
  this repo's guarded-URL checks were never bypassed or modified.
- A stray `git stash pop` incident mid-round briefly touched an unrelated
  stash entry belonging to a different branch; it was caught immediately,
  cleanly reverted, and the original stash entry (`stash@{0}`, "SAFETY
  pre-demo-sync 2026-07-29") remains intact and untouched — verified
  directly (`git stash list`) as part of this report's own preparation, not
  just taken on the writer's word.
- This agent does not declare `CODE_GO` and has not updated any global
  board (`MVP_SUBMODULE_CONTROL_BOARD.md`, `CURRENT_MVP_CONTROL.md`) — both
  absent from this branch's history in any case; that decision belongs to
  Codex.

## 9. Final state

```
$ git status --short
(empty)
```

Implementation HEAD (all code/test fixes, no docs): `6f7fd2e08d19ef0efbae5b73fd7aa4dd2afb3faa`.
Documentation/final HEAD: whatever commit this file is checked in at —
by construction a file cannot state its own final commit hash inside
itself; run `git log -1 --oneline` on the branch for the true current HEAD
rather than trusting a hash written here.

AWAITING_CODEX_REVIEW
